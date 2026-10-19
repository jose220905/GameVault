// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './prisma';
import categoriaRoutes from './routes/categoria.routes';
import authRoutes from './routes/auth.routes';
import productoRoutes from './routes/producto.routes';
import ventaRoutes from './routes/venta.routes';
import clienteRoutes from './routes/cliente.routes';
import preventaRoutes from './routes/preventa.routes';
import cajaRoutes from './routes/caja.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Ruta raíz
app.get('/', (_req, res) => {
  res.json({ message: 'Bienvenido a la API de GameVault POS 🎮🚀' });
});

// Health Check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error de conexión a PostgreSQL' });
  }
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/preventas', preventaRoutes);
app.use('/api/caja', cajaRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});