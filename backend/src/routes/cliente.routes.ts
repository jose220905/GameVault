// src/routes/cliente.routes.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/clientes - Obtener todos los clientes
router.get('/', async (_req: Request, res: Response) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { id: 'desc' },
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la lista de clientes' });
  }
});

// POST /api/clientes - Crear un cliente
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, telefono, email } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre,
        telefono: telefono || '',
      },
    });

    res.status(201).json(nuevoCliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el cliente' });
  }
});

export default router;