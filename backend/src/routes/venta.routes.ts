// src/routes/venta.routes.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

interface DetalleItem {
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  esPreventa?: boolean;
}

// POST /api/ventas - Registrar una venta completa
router.post('/', async (req: Request, res: Response) => {
  try {
    const { usuarioId, clienteId, items, formaPago, metodoPago, paymentMethod } = req.body;

    if (!usuarioId) {
      return res.status(400).json({ error: 'El campo usuarioId es obligatorio' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La venta debe incluir al menos un ítem' });
    }

    // Resolver usuarioId numérico y validar existencia en BD
    let parsedUsuarioId = Number(usuarioId);
    if (isNaN(parsedUsuarioId) || parsedUsuarioId <= 0) {
      const defaultUser = await prisma.usuario.findFirst();
      if (defaultUser) {
        parsedUsuarioId = defaultUser.id;
      } else {
        return res.status(400).json({ error: 'Usuario obligatorio o ID inválido' });
      }
    } else {
      const uExists = await prisma.usuario.findUnique({ where: { id: parsedUsuarioId } });
      if (!uExists) {
        const defaultUser = await prisma.usuario.findFirst();
        if (defaultUser) {
          parsedUsuarioId = defaultUser.id;
        }
      }
    }

    // Normalizar forma de pago
    const rawForma = String(formaPago || metodoPago || paymentMethod || 'EFECTIVO').trim().toUpperCase();
    let formaPagoFinal = 'EFECTIVO';
    if (rawForma.includes('TARJETA') || rawForma.includes('CARD')) {
      formaPagoFinal = 'TARJETA';
    } else if (rawForma.includes('TRANSFER') || rawForma.includes('TRANSFERENCIA')) {
      formaPagoFinal = 'TRANSFERENCIA';
    }

    // Normalizar clienteId asegurando compatibilidad con clave foránea
    let validClienteId: number | null = null;
    if (clienteId !== undefined && clienteId !== null && clienteId !== 'publico') {
      const parsedCliId = Number(clienteId);
      if (!isNaN(parsedCliId) && parsedCliId > 0) {
        const clienteExistente = await prisma.cliente.findUnique({ where: { id: parsedCliId } });
        if (clienteExistente) {
          validClienteId = parsedCliId;
        }
      }
    }

    // Formatear y validar ítems numéricos y estado de preventa
    const isSalePreventaDeposit = Boolean(
      req.body.isPreventaDepositSale ||
      req.body.isPreventa ||
      req.body.preventa ||
      req.body.preventaData
    );
    const isLiquidation = Boolean(req.body.linkedPreventaId || req.body.isPreventaLiquidation);

    const formattedItems: (DetalleItem & { id?: number })[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const prodId = parseInt(it.productoId || it.id || it.idProducto, 10);
      const cantidad = Number(it.cantidad ?? it.qty ?? 1);
      const precioUnitario = Number(it.precioUnitario !== undefined ? it.precioUnitario : (it.precio ?? it.price ?? 0));
      const esPreventa = Boolean(
        it.esPreventa ||
        it.isPreventa ||
        it.isPreventaDeposit ||
        (isSalePreventaDeposit && !isLiquidation)
      );

      if (isNaN(prodId) || isNaN(cantidad) || isNaN(precioUnitario) || cantidad <= 0) {
        return res.status(400).json({ error: `Ítem #${i + 1} inválido: productoId, cantidad y precioUnitario deben ser numéricos` });
      }

      formattedItems.push({
        id: prodId,
        productoId: prodId,
        cantidad,
        precioUnitario,
        esPreventa,
      });
    }

    // Desglose financiero: Subtotal, Descuento, IVA y Total a Pagar
    const subtotalBruto = formattedItems.reduce(
      (sum: number, item: DetalleItem) => sum + item.cantidad * item.precioUnitario,
      0
    );
    const subtotalFinal = req.body.subtotal !== undefined ? Number(req.body.subtotal) : subtotalBruto;
    const descuentoFinal = req.body.descuento !== undefined
      ? Number(req.body.descuento)
      : (req.body.descuentoCliente !== undefined ? Number(req.body.descuentoCliente) : 0);

    const subtotalNeto = Math.max(0, subtotalFinal - descuentoFinal);
    const ivaFinal = req.body.iva !== undefined
      ? Number(req.body.iva)
      : Math.round(subtotalNeto * 0.16 * 100) / 100;

    const totalFinal = req.body.total !== undefined
      ? Number(req.body.total)
      : (req.body.montoTotal !== undefined ? Number(req.body.montoTotal) : Math.round((subtotalNeto + ivaFinal) * 100) / 100);

    // Transacción atómica
    const nuevaVenta = await prisma.$transaction(async (tx) => {

      // 1. Verificar stock y descontar para todos los productos
      for (const item of formattedItems) {
        const prodId = parseInt(String(item.productoId || item.id), 10);
        const producto = await tx.producto.findUnique({
          where: { id: prodId },
        });

        if (!producto) {
          throw new Error(`Producto con ID ${prodId} no encontrado en el catálogo`);
        }

        // EXCEPCIÓN DE STOCK EN PREVENTAS:
        // a) Si es anticipo de preventa, omitir verificación de stock > 0
        // b) NO descontar stock físico al cobrar el 50% de anticipo
        // c) Descontar únicamente al entregar el producto en venta regular o liquidación final
        if (item.esPreventa) {
          continue;
        }

        if (producto.stock < item.cantidad) {
          throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`);
        }

        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stock: producto.stock - item.cantidad,
          },
        });
      }

      // 2. Crear la venta con desglose financiero
      const venta = await tx.venta.create({
        data: {
          subtotal: subtotalFinal,
          descuento: descuentoFinal,
          iva: ivaFinal,
          montoTotal: totalFinal,
          idUsuario: parsedUsuarioId,
          idCliente: validClienteId,
          formaPago: formaPagoFinal,
          metodoPago: formaPagoFinal,
          detalles: {
            create: formattedItems.map((item: DetalleItem) => ({
              idProducto: item.productoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
            })),
          },
        },
        include: {
          detalles: {
            include: {
              producto: true,
            },
          },
        },
      });

      // 3. Si la venta corresponde a un anticipo de preventa
      const preventaIdFromReq = req.body.preventaId ? parseInt(String(req.body.preventaId), 10) : null;
      const isLiquidation = Boolean(req.body.linkedPreventaId || req.body.isPreventaLiquidation);
      const preventaInput = req.body.preventa || req.body.preventaData;

      if (preventaIdFromReq && !isNaN(preventaIdFromReq) && !isLiquidation) {
        const pExist = await tx.preventa.findUnique({ where: { id: preventaIdFromReq } });
        if (pExist) {
          await tx.preventa.update({
            where: { id: preventaIdFromReq },
            data: {
              idVenta: venta.id,
              formaPago: formaPagoFinal,
              metodoPago: formaPagoFinal,
            },
          });
        }
      } else if (preventaInput && validClienteId && !isLiquidation) {
        const prodIdTarget = parseInt(String(preventaInput.idProducto || preventaInput.productoId || formattedItems[0]?.productoId), 10);
        const anticipoVal = parseFloat(String(preventaInput.montoAnticipo || preventaInput.anticipoPagado || totalFinal));

        if (!isNaN(prodIdTarget) && !isNaN(anticipoVal)) {
          const prodCheck = await tx.producto.findUnique({ where: { id: prodIdTarget } });
          if (prodCheck) {
            await tx.preventa.create({
              data: {
                idCliente: validClienteId,
                idProducto: prodIdTarget,
                idVenta: venta.id,
                montoAnticipo: anticipoVal,
                formaPago: formaPagoFinal,
                metodoPago: formaPagoFinal,
                estado: 'PENDIENTE',
              },
            });
          }
        }
      }

      // 4. Si la venta es liquidación de una preventa previa
      const targetPreventaId = req.body.linkedPreventaId || req.body.preventaId;
      if (isLiquidation && targetPreventaId) {
        const pIdNum = parseInt(String(targetPreventaId), 10);
        if (!isNaN(pIdNum)) {
          const pLiqExist = await tx.preventa.findUnique({ where: { id: pIdNum } });
          if (pLiqExist) {
            await tx.preventa.update({
              where: { id: pIdNum },
              data: {
                estado: 'COMPLETADA',
                fechaEntrega: new Date(),
                idVenta: venta.id,
              },
            });
          }
        }
      }

      const ventaCompleta = await tx.venta.findUnique({
        where: { id: venta.id },
        include: {
          detalles: {
            include: {
              producto: true,
            },
          },
          preventas: true,
        },
      });

      return ventaCompleta;
    });

    res.status(201).json(nuevaVenta);
  } catch (error: any) {
    console.error('Error en POST /api/ventas:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la venta' });
  }
});

// GET /api/ventas - Historial de ventas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const ventas = await prisma.venta.findMany({
      include: {
        usuario: {
          select: { nombreCompleto: true, username: true },
        },
        cliente: true,
        detalles: {
          include: { producto: true },
        },
        preventas: true,
      },
      orderBy: { id: 'desc' },
    });
    res.json(ventas);
  } catch (error: any) {
    console.error('Error en GET /api/ventas:', error);
    res.status(500).json({ error: error.message || 'Error al obtener el historial de ventas' });
  }
});

export default router;