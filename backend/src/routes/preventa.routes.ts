// src/routes/preventa.routes.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/preventas - Listar todas las preventas
router.get('/', async (_req: Request, res: Response) => {
  try {
    const preventas = await prisma.preventa.findMany({
      include: {
        producto: true,
        cliente: true,
        venta: true,
      },
      orderBy: { id: 'desc' },
    });

    const preventasConSaldos = preventas.map((p) => {
      const precioProducto = parseFloat(p.producto?.precio ? String(p.producto.precio) : '0');
      const anticipo = parseFloat(String(p.montoAnticipo || 0));
      const saldoRestante = Math.max(0, precioProducto - anticipo);

      return {
        id: p.id,
        folio: `PREV-${String(p.id).padStart(4, '0')}`,
        fechaReserva: p.fechaReserva,
        idCliente: p.idCliente,
        idProducto: p.idProducto,
        idVenta: p.idVenta,
        montoTotal: precioProducto,
        anticipoPagado: anticipo,
        montoAnticipo: anticipo,
        saldoPendiente: saldoRestante,
        saldoRestante: saldoRestante,
        formaPago: p.formaPago,
        metodoPago: p.metodoPago,
        estado: p.estado,
        cliente: p.cliente,
        producto: p.producto,
        venta: p.venta,
      };
    });

    res.json(preventasConSaldos);
  } catch (error: any) {
    console.error('Error en GET /api/preventas:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la lista de preventas' });
  }
});

// GET /api/preventas/:id - Obtener una preventa por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const preventaId = parseInt(req.params.id as string, 10);
    if (isNaN(preventaId)) {
      return res.status(400).json({ error: 'ID de preventa inválido' });
    }

    const p = await prisma.preventa.findUnique({
      where: { id: preventaId },
      include: {
        producto: true,
        cliente: true,
        venta: true,
      },
    });

    if (!p) {
      return res.status(404).json({ error: `Preventa con ID ${preventaId} no encontrada` });
    }

    const precioProducto = parseFloat(p.producto?.precio ? String(p.producto.precio) : '0');
    const anticipo = parseFloat(String(p.montoAnticipo || 0));
    const saldoRestante = Math.max(0, precioProducto - anticipo);

    res.json({
      ...p,
      folio: `PREV-${String(p.id).padStart(4, '0')}`,
      montoTotal: precioProducto,
      anticipoPagado: anticipo,
      saldoPendiente: saldoRestante,
      saldoRestante: saldoRestante,
    });
  } catch (error: any) {
    console.error(`Error en GET /api/preventas/${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Error al obtener la preventa' });
  }
});

// POST /api/preventas - Registrar una nueva preventa/apartado
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      idProducto,
      idCliente,
      productoId,
      clienteId,
      idVenta,
      ventaId,
      montoAnticipo,
      anticipoPagado,
      montoAbono,
      estado,
      formaPago,
      metodoPago,
      paymentMethod,
    } = req.body;

    const prodIdTarget = parseInt(String(idProducto || productoId), 10);
    const cliIdTarget = parseInt(String(idCliente || clienteId), 10);
    const rawAnticipo = anticipoPagado !== undefined ? anticipoPagado : (montoAnticipo !== undefined ? montoAnticipo : montoAbono);
    const vIdTarget = (idVenta || ventaId) ? parseInt(String(idVenta || ventaId), 10) : null;

    if (isNaN(prodIdTarget) || isNaN(cliIdTarget) || rawAnticipo === undefined || isNaN(parseFloat(String(rawAnticipo)))) {
      return res.status(400).json({ error: 'idProducto, idCliente y montoAnticipo (anticipoPagado) son obligatorios y deben ser válidos' });
    }

    const rawForma = String(formaPago || metodoPago || paymentMethod || 'EFECTIVO').trim().toUpperCase();
    let formaPagoFinal = 'EFECTIVO';
    if (rawForma.includes('TARJETA') || rawForma.includes('CARD')) {
      formaPagoFinal = 'TARJETA';
    } else if (rawForma.includes('TRANSFER') || rawForma.includes('TRANSFERENCIA')) {
      formaPagoFinal = 'TRANSFERENCIA';
    }

    const clienteExistente = await prisma.cliente.findUnique({ where: { id: cliIdTarget } });
    if (!clienteExistente) {
      return res.status(404).json({ error: `Cliente con ID ${cliIdTarget} no encontrado` });
    }

    const productoExistente = await prisma.producto.findUnique({ where: { id: prodIdTarget } });
    if (!productoExistente) {
      return res.status(404).json({ error: `Producto con ID ${prodIdTarget} no encontrado` });
    }

    let validVentaId: number | null = null;
    if (vIdTarget && !isNaN(vIdTarget)) {
      const ventaExistente = await prisma.venta.findUnique({ where: { id: vIdTarget } });
      if (ventaExistente) {
        validVentaId = vIdTarget;
      }
    }

    // 3. FILTRADO DE PREVENTAS ACTIVAS POR CLIENTE:
    // Solo contar aquellas cuyo estado sea estrictamente 'PENDIENTE'. Si está 'COMPLETADA' o 'CANCELADA', permitir reservar sin restricción.
    const preventaPendiente = await prisma.preventa.findFirst({
      where: {
        idCliente: cliIdTarget,
        idProducto: prodIdTarget,
        estado: 'PENDIENTE',
      },
    });

    if (preventaPendiente) {
      return res.status(400).json({ error: 'El cliente ya cuenta con una preventa activa (PENDIENTE) para este producto' });
    }

    const nuevaPreventa = await prisma.preventa.create({
      data: {
        idProducto: prodIdTarget,
        idCliente: cliIdTarget,
        idVenta: validVentaId,
        montoAnticipo: parseFloat(String(rawAnticipo)),
        formaPago: formaPagoFinal,
        metodoPago: formaPagoFinal,
        estado: estado || 'PENDIENTE',
      },
      include: {
        producto: true,
        cliente: true,
        venta: true,
      },
    });

    const precioProducto = parseFloat(nuevaPreventa.producto?.precio ? String(nuevaPreventa.producto.precio) : '0');
    const anticipo = parseFloat(String(nuevaPreventa.montoAnticipo || 0));
    const saldoRestante = Math.max(0, precioProducto - anticipo);

    res.status(201).json({
      ...nuevaPreventa,
      folio: `PREV-${String(nuevaPreventa.id).padStart(4, '0')}`,
      montoTotal: precioProducto,
      anticipoPagado: anticipo,
      saldoPendiente: saldoRestante,
      saldoRestante: saldoRestante,
    });
  } catch (error: any) {
    console.error('Error en POST /api/preventas:', error);
    res.status(500).json({ error: error.message || 'Error al registrar la preventa' });
  }
});

// Controlador unificado para actualizar preventas (PATCH / PUT /api/preventas/:id)
const handleUpdatePreventa = async (req: Request, res: Response) => {
  try {
    // b) Convierte el ID recibido en la URL a entero
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de preventa inválido' });
    }

    const preventaExistente = await prisma.preventa.findUnique({
      where: { id },
    });

    if (!preventaExistente) {
      return res.status(404).json({ error: `Preventa con ID ${id} no encontrada` });
    }

    // a) Valida la presencia de req.body antes de desestructurar
    const estado = req.body?.estado || 'COMPLETADA';

    const dataToUpdate: any = {};
    if (estado) {
      const upper = String(estado).trim().toUpperCase();
      if (upper === 'COMPLETADA' || upper === 'LIQUIDADA') {
        dataToUpdate.estado = upper as any;
        dataToUpdate.fechaEntrega = new Date();
      } else if (upper === 'CANCELADA') {
        dataToUpdate.estado = 'CANCELADA';
      } else {
        dataToUpdate.estado = 'PENDIENTE';
      }
    }

    const {
      idVenta,
      ventaId,
      montoAnticipo,
      anticipoPagado,
      formaPago,
      metodoPago,
      paymentMethod,
      idCliente,
      clienteId,
      idProducto,
      productoId,
    } = req.body || {};

    const rawVentaId = idVenta !== undefined ? idVenta : ventaId;
    if (rawVentaId !== undefined) {
      if (rawVentaId === null || rawVentaId === '') {
        dataToUpdate.idVenta = null;
      } else {
        const parsedVentaId = parseInt(String(rawVentaId), 10);
        if (!isNaN(parsedVentaId) && parsedVentaId > 0) {
          const vExists = await prisma.venta.findUnique({ where: { id: parsedVentaId } });
          if (vExists) {
            dataToUpdate.idVenta = parsedVentaId;
          }
        }
      }
    }

    const rawAnticipo = anticipoPagado !== undefined ? anticipoPagado : montoAnticipo;
    if (rawAnticipo !== undefined && rawAnticipo !== null) {
      const pAnticipo = parseFloat(String(rawAnticipo));
      if (!isNaN(pAnticipo)) {
        dataToUpdate.montoAnticipo = pAnticipo;
      }
    }

    if (formaPago || metodoPago || paymentMethod) {
      const rawForma = String(formaPago || metodoPago || paymentMethod || '').trim().toUpperCase();
      let formaFinal = 'EFECTIVO';
      if (rawForma.includes('TARJETA') || rawForma.includes('CARD')) {
        formaFinal = 'TARJETA';
      } else if (rawForma.includes('TRANSFER')) {
        formaFinal = 'TRANSFERENCIA';
      }
      dataToUpdate.formaPago = formaFinal;
      dataToUpdate.metodoPago = formaFinal;
    }

    const cliId = idCliente !== undefined ? idCliente : clienteId;
    if (cliId) {
      const parsedCliId = parseInt(String(cliId), 10);
      if (!isNaN(parsedCliId)) {
        const cExists = await prisma.cliente.findUnique({ where: { id: parsedCliId } });
        if (cExists) {
          dataToUpdate.idCliente = parsedCliId;
        }
      }
    }

    const prodId = idProducto !== undefined ? idProducto : productoId;
    if (prodId) {
      const parsedProdId = parseInt(String(prodId), 10);
      if (!isNaN(parsedProdId)) {
        const pExists = await prisma.producto.findUnique({ where: { id: parsedProdId } });
        if (pExists) {
          dataToUpdate.idProducto = parsedProdId;
        }
      }
    }

    // c) Actualiza la preventa en Prisma cambiando su estado a 'COMPLETADA' (o 'LIQUIDADA') y registra la fecha de entrega
    const preventaActualizada = await prisma.preventa.update({
      where: { id },
      data: dataToUpdate,
      include: {
        producto: true,
        cliente: true,
        venta: true,
      },
    });

    const precioProducto = parseFloat(preventaActualizada.producto?.precio ? String(preventaActualizada.producto.precio) : '0');
    const anticipo = parseFloat(String(preventaActualizada.montoAnticipo || 0));
    const saldoRestante = Math.max(0, precioProducto - anticipo);

    // d) Devuelve res.json({ ok: true, mensaje: "Preventa liquidada con éxito" })
    res.json({
      ok: true,
      mensaje: 'Preventa liquidada con éxito',
      ...preventaActualizada,
      folio: `PREV-${String(preventaActualizada.id).padStart(4, '0')}`,
      montoTotal: precioProducto,
      anticipoPagado: anticipo,
      saldoPendiente: saldoRestante,
      saldoRestante: saldoRestante,
    });
  } catch (error: any) {
    console.error(`Error al actualizar preventa en ${req.method} /api/preventas/${req.params.id}:`, error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Violación de restricción única al actualizar la preventa' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'La preventa especificada no existe' });
    }
    res.status(500).json({ error: error.message || 'Error al actualizar la preventa' });
  }
};

// PATCH /api/preventas/:id - Liquidación / cambio de estado de preventa
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    // b) Convierte el ID recibido en la URL a entero: const id = parseInt(req.params.id, 10);
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'ID de preventa inválido' });
    }

    // a) Valida la presencia de req.body antes de desestructurar:
    const estado = req.body?.estado || 'COMPLETADA';
    const upperEstado = String(estado).trim().toUpperCase();
    const estadoFinal = (upperEstado === 'COMPLETADA' || upperEstado === 'LIQUIDADA')
      ? upperEstado
      : (upperEstado === 'CANCELADA' ? 'CANCELADA' : 'PENDIENTE');

    // c) Actualiza la preventa en Prisma cambiando su estado a 'COMPLETADA' (o 'LIQUIDADA') y registra la fecha de entrega:
    const preventaActualizada = await prisma.preventa.update({
      where: { id },
      data: {
        estado: estadoFinal as any,
        fechaEntrega: new Date(),
      },
      include: {
        producto: true,
        cliente: true,
        venta: true,
      },
    });

    // d) Devuelve res.json({ ok: true, mensaje: "Preventa liquidada con éxito" })
    return res.json({
      ok: true,
      mensaje: 'Preventa liquidada con éxito',
      preventa: preventaActualizada,
    });
  } catch (error: any) {
    console.error(`Error en PATCH /api/preventas/${req.params.id}:`, error);
    if (error.code === 'P2025') {
      return res.status(404).json({ ok: false, error: 'La preventa especificada no existe' });
    }
    return res.status(500).json({ ok: false, error: error.message || 'Error al liquidar la preventa' });
  }
});

router.put('/:id', handleUpdatePreventa);

export default router;