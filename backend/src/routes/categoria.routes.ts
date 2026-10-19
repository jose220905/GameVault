// src/routes/categoria.routes.ts
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/categorias - Obtener todas las categorías
router.get('/', async (_req, res) => {
  try {
    const categorias = await prisma.categoria.findMany();
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

// POST /api/categorias - Crear una nueva categoría
router.post('/', async (req, res) => {
  try {
    const { nombreCategoria } = req.body;
    
    if (!nombreCategoria) {
      return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
    }

    const nuevaCategoria = await prisma.categoria.create({
      data: { nombreCategoria },
    });

    res.status(201).json(nuevaCategoria);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

export default router;