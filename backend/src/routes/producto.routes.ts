// src/routes/producto.routes.ts
import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/productos - Obtener todos los productos con su categoría (activos)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
      },
      include: {
        categoria: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
});

// POST /api/productos - Registrar un nuevo producto
router.post('/', async (req: Request, res: Response) => {
  try {
    const { codigo, nombre, precio, stock, idCategoria, esDigital } = req.body;

    if (!codigo || !nombre || precio === undefined || !idCategoria) {
      return res.status(400).json({ error: 'Código, nombre, precio e idCategoria son obligatorios' });
    }

    const nuevoProducto = await prisma.producto.create({
      data: {
        codigo,
        nombre,
        precio: parseFloat(precio),
        stock: stock ? parseInt(stock) : 0,
        esDigital: Boolean(esDigital),
        idCategoria: parseInt(idCategoria),
        activo: true,
      },
      include: {
        categoria: true,
      },
    });

    res.status(201).json(nuevoProducto);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El código de barras/SKU ya se encuentra registrado' });
    }
    res.status(500).json({ error: 'Error al registrar el producto' });
  }
});

// PATCH /api/productos/:id/stock - Reabastecer stock de un producto
router.patch('/:id/stock', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de producto inválido' });
    }

    const { cantidad, stock, cantidadAgregar } = req.body;
    const incremento = parseInt(cantidadAgregar !== undefined ? cantidadAgregar : (cantidad !== undefined ? cantidad : 0));

    if (isNaN(incremento) && stock === undefined) {
      return res.status(400).json({ error: 'Debes proporcionar una cantidad válida para reabastecer' });
    }

    const productoExistente = await prisma.producto.findUnique({ where: { id } });
    if (!productoExistente) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const nuevoStock = stock !== undefined ? Math.max(0, parseInt(stock)) : Math.max(0, productoExistente.stock + incremento);

    const productoActualizado = await prisma.producto.update({
      where: { id },
      data: { stock: nuevoStock },
      include: { categoria: true },
    });

    res.json({
      success: true,
      mensaje: 'Stock actualizado exitosamente',
      producto: productoActualizado,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al actualizar el stock del producto' });
  }
});

// PUT /api/productos/:id - Editar datos de un producto existente
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de producto inválido' });
    }

    const { nombre, precio, stock, idCategoria, codigo, esDigital } = req.body;

    const dataToUpdate: any = {};
    if (nombre !== undefined) dataToUpdate.nombre = String(nombre).trim();
    if (precio !== undefined) dataToUpdate.precio = parseFloat(precio);
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
    if (idCategoria !== undefined && !isNaN(parseInt(idCategoria))) dataToUpdate.idCategoria = parseInt(idCategoria);
    if (codigo !== undefined) dataToUpdate.codigo = String(codigo).trim();
    if (esDigital !== undefined) dataToUpdate.esDigital = Boolean(esDigital);

    const productoActualizado = await prisma.producto.update({
      where: { id },
      data: dataToUpdate,
      include: { categoria: true },
    });

    res.json({
      success: true,
      mensaje: 'Producto actualizado exitosamente',
      producto: productoActualizado,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'El código de barras/SKU ya pertenece a otro producto' });
    }
    res.status(500).json({ error: error.message || 'Error al actualizar el producto' });
  }
});

// DELETE /api/productos/:id - Desactivar o eliminar producto
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de producto inválido' });
    }

    // Desactivar el producto (soft-delete mediante activo = false)
    const productoDesactivado = await prisma.producto.update({
      where: { id },
      data: { activo: false },
    });

    res.json({
      success: true,
      mensaje: 'Producto desactivado exitosamente del inventario',
      producto: productoDesactivado,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.status(500).json({ error: error.message || 'Error al desactivar el producto' });
  }
});

export default router;