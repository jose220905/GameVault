// src/routes/caja.routes.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

function normalizarMetodoPago(item: any): 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' {
  const raw = String(item.formaPago || item.metodoPago || item.paymentMethod || 'EFECTIVO').trim().toUpperCase();
  if (raw === 'TARJETA' || raw === 'CARD' || raw === 'TARJETA DE CRÉDITO' || raw === 'TARJETA DE DÉBITO') {
    return 'TARJETA';
  }
  if (raw === 'TRANSFERENCIA' || raw === 'TRANSFER' || raw === 'TRANSFERENCIA BANCARIA') {
    return 'TRANSFERENCIA';
  }
  return 'EFECTIVO';
}

// GET /api/caja/resumen-hoy - Resumen de ventas y preventas de la jornada activa (hoy)
router.get('/resumen-hoy', async (_req: Request, res: Response) => {
  try {
    // Fecha actual del sistema en formato YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Rango de fechas para el día de hoy (soporta zona horaria UTC y local)
    const startUtc = new Date(`${todayStr}T00:00:00.000Z`);
    const endUtc = new Date(`${todayStr}T23:59:59.999Z`);
    const startLocal = new Date(`${todayLocalStr}T00:00:00.000Z`);
    const endLocal = new Date(`${todayLocalStr}T23:59:59.999Z`);

    const gteDate = startUtc < startLocal ? startUtc : startLocal;
    const lteDate = endUtc > endLocal ? endUtc : endLocal;

    // Buscar el último CierreCaja registrado el día de hoy
    const ultimosCierresHoy = await prisma.cierreCaja.findMany({
      where: {
        fecha: {
          gte: gteDate,
          lte: lteDate,
        },
      },
      orderBy: { fecha: 'desc' },
      take: 10,
    });

    const ultimoCierreHoy = ultimosCierresHoy.find((c) => {
      const cFechaStr = c.fecha.toISOString().split('T')[0];
      const cLocalStr = `${c.fecha.getFullYear()}-${String(c.fecha.getMonth() + 1).padStart(2, '0')}-${String(c.fecha.getDate()).padStart(2, '0')}`;
      return cFechaStr === todayStr || cFechaStr === todayLocalStr || cLocalStr === todayLocalStr;
    });

    // La fecha a partir de la cual consultar ventas: después del último cierre de hoy o desde el inicio del día
    const fechaFiltroVentas = ultimoCierreHoy ? ultimoCierreHoy.fecha : gteDate;

    // Fondo inicial por defecto $500.00 MXN
    const fondoInicial = 500.00;

    // Consultar las ventas filtrando por fecha posterior al último cierre de hoy (o inicio del día)
    const todasLasVentas = await prisma.venta.findMany({
      where: {
        fecha: {
          gt: ultimoCierreHoy ? ultimoCierreHoy.fecha : undefined,
          gte: !ultimoCierreHoy ? gteDate : undefined,
          lte: lteDate,
        },
      },
      include: {
        usuario: { select: { nombreCompleto: true, username: true } },
        cliente: { select: { nombre: true, telefono: true } },
        detalles: { include: { producto: true } },
      },
      orderBy: { fecha: 'asc' },
    });

    // Filtro adicional de seguridad para asegurar que la fecha coincide con hoy y es posterior al cierre
    const ventasHoy = todasLasVentas.filter((v) => {
      const vFechaStr = v.fecha.toISOString().split('T')[0];
      const vLocalStr = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}-${String(v.fecha.getDate()).padStart(2, '0')}`;
      const esHoy = vFechaStr === todayStr || vFechaStr === todayLocalStr || vLocalStr === todayLocalStr;
      if (!esHoy) return false;
      if (ultimoCierreHoy && v.fecha.getTime() <= ultimoCierreHoy.fecha.getTime()) {
        return false;
      }
      return true;
    });

    // Consultar las preventas filtrando por fecha posterior al último cierre de hoy
    const todasLasPreventas = await prisma.preventa.findMany({
      where: {
        fechaReserva: {
          gt: ultimoCierreHoy ? ultimoCierreHoy.fecha : undefined,
          gte: !ultimoCierreHoy ? gteDate : undefined,
          lte: lteDate,
        },
      },
      include: {
        cliente: true,
        producto: true,
      },
      orderBy: { fechaReserva: 'asc' },
    });

    const preventasHoy = todasLasPreventas.filter((p) => {
      const pFechaStr = p.fechaReserva.toISOString().split('T')[0];
      const pLocalStr = `${p.fechaReserva.getFullYear()}-${String(p.fechaReserva.getMonth() + 1).padStart(2, '0')}-${String(p.fechaReserva.getDate()).padStart(2, '0')}`;
      const esHoy = pFechaStr === todayStr || pFechaStr === todayLocalStr || pLocalStr === todayLocalStr;
      if (!esHoy) return false;
      if (ultimoCierreHoy && p.fechaReserva.getTime() <= ultimoCierreHoy.fecha.getTime()) {
        return false;
      }
      return true;
    });

    // Sumar ventas según formaPago / metodoPago
    let ventasEfectivo = 0;
    let ventasTarjeta = 0;
    let ventasTransferencia = 0;

    for (const v of ventasHoy) {
      const monto = Number(v.montoTotal) || 0;
      const metodo = normalizarMetodoPago(v);
      if (metodo === 'EFECTIVO') {
        ventasEfectivo += monto;
      } else if (metodo === 'TARJETA') {
        ventasTarjeta += monto;
      } else if (metodo === 'TRANSFERENCIA') {
        ventasTransferencia += monto;
      }
    }

    // Sumar anticipos de preventas cobrados hoy según su respectiva forma de pago
    let totalAnticipos = 0;
    let anticiposEfectivo = 0;
    let anticiposTarjeta = 0;
    let anticiposTransferencia = 0;

    for (const p of preventasHoy) {
      const monto = Number(p.montoAnticipo) || 0;
      totalAnticipos += monto;
      const metodo = normalizarMetodoPago(p);
      if (metodo === 'EFECTIVO') {
        anticiposEfectivo += monto;
      } else if (metodo === 'TARJETA') {
        anticiposTarjeta += monto;
      } else if (metodo === 'TRANSFERENCIA') {
        anticiposTransferencia += monto;
      }
    }

    // Redondear a 2 decimales
    ventasEfectivo = Math.round(ventasEfectivo * 100) / 100;
    ventasTarjeta = Math.round(ventasTarjeta * 100) / 100;
    ventasTransferencia = Math.round(ventasTransferencia * 100) / 100;
    totalAnticipos = Math.round(totalAnticipos * 100) / 100;
    anticiposEfectivo = Math.round(anticiposEfectivo * 100) / 100;
    anticiposTarjeta = Math.round(anticiposTarjeta * 100) / 100;
    anticiposTransferencia = Math.round(anticiposTransferencia * 100) / 100;

    // Total Cobrado = X + Y + Z (ventasEfectivo + ventasTarjeta + ventasTransferencia)
    const totalCobrado = Math.round((ventasEfectivo + ventasTarjeta + ventasTransferencia) * 100) / 100;

    // Efectivo Esperado = Fondo Inicial + Ventas en Efectivo (500.00 + X)
    const efectivoEsperado = Math.round((fondoInicial + ventasEfectivo) * 100) / 100;

    res.json({
      fondoInicial,
      ventasEfectivo,
      ventasTarjeta,
      ventasTransferencia,
      totalCobrado,
      efectivoEsperado,
      totalAnticipos,
      totalAnticiposPreventa: totalAnticipos,
      anticiposEfectivo,
      anticiposTarjeta,
      anticiposTransferencia,
      fecha: todayStr,
      totalVentas: ventasHoy.length,
      ticketsCount: ventasHoy.length,
      transacciones: ventasHoy,
      preventas: preventasHoy,
      ultimoCierre: ultimoCierreHoy ? {
        id: ultimoCierreHoy.id,
        fecha: ultimoCierreHoy.fecha,
        diferencia: Number(ultimoCierreHoy.diferencia),
        totalEfectivo: Number(ultimoCierreHoy.totalEfectivo),
        totalTarjeta: Number(ultimoCierreHoy.totalTarjeta),
        totalTransferencia: Number(ultimoCierreHoy.totalTransferencia),
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el resumen de caja del día' });
  }
});

// POST /api/caja/cierre - Registrar cierre de turno y arqueo final
router.post('/cierre', async (req: Request, res: Response) => {
  try {
    const {
      usuarioId,
      idUsuario,
      userId: reqUserId,
      totalEfectivo,
      ventasEfectivo,
      totalTarjeta,
      ventasTarjeta,
      totalTransferencia,
      ventasTransferencia,
      diferencia,
      efectivoReal,
      efectivoEsperado,
      fondoInicial,
      totalCobrado,
      notas,
    } = req.body;

    let userId = parseInt(usuarioId || idUsuario || reqUserId);
    if (isNaN(userId)) {
      const admin = await prisma.usuario.findFirst({
        where: { rol: 'ADMINISTRADOR' },
      });
      userId = admin ? admin.id : 1;
    }

    const diffValue = parseFloat(diferencia || 0);
    const efectivoVal = parseFloat(totalEfectivo !== undefined ? totalEfectivo : (ventasEfectivo || 0));
    const tarjetaVal = parseFloat(totalTarjeta !== undefined ? totalTarjeta : (ventasTarjeta || 0));
    const transfVal = parseFloat(totalTransferencia !== undefined ? totalTransferencia : (ventasTransferencia || 0));

    const cierre = await prisma.cierreCaja.create({
      data: {
        idUsuario: userId,
        totalEfectivo: efectivoVal,
        totalTarjeta: tarjetaVal,
        totalTransferencia: transfVal,
        diferencia: diffValue,
        fecha: new Date(),
      },
      include: {
        usuario: {
          select: { nombreCompleto: true, username: true, rol: true },
        },
      },
    });

    try {
      await prisma.bitacoraAuditoria.create({
        data: {
          idUsuario: userId,
          accion: `CIERRE DE CAJA: Efectivo: $${efectivoVal.toFixed(2)}, Tarjeta: $${tarjetaVal.toFixed(2)}, Transferencia: $${transfVal.toFixed(2)}, Diferencia: $${diffValue.toFixed(2)}. Efectivo Real: $${parseFloat(efectivoReal || 0).toFixed(2)}. Notas: ${notas || 'Sin notas'}`,
          fecha: new Date(),
        },
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      mensaje: 'Cierre de turno y arqueo guardado exitosamente',
      cierre: {
        id: cierre.id,
        fecha: cierre.fecha,
        usuarioId: cierre.idUsuario,
        totalEfectivo: Number(cierre.totalEfectivo),
        totalTarjeta: Number(cierre.totalTarjeta),
        totalTransferencia: Number(cierre.totalTransferencia),
        diferencia: Number(cierre.diferencia),
        usuario: cierre.usuario.nombreCompleto,
        fondoInicial: parseFloat(fondoInicial || 500),
        efectivoEsperado: parseFloat(efectivoEsperado || 0),
        efectivoReal: parseFloat(efectivoReal || 0),
        totalCobrado: parseFloat(totalCobrado || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al guardar el cierre de caja' });
  }
});

export default router;