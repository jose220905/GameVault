# GameVault - Memory

## Descripción
GameVault es un sistema integral de punto de venta (POS) y gestión de inventario para tiendas retail de videojuegos, consolas, pines digitales y merchandising. Incluye control de roles (Admin y Empleado), fidelización de clientes (descuento 5%), gestión de preventas/apartados con anticipo del 50%, y arqueo contable con corte de caja.

## Stack
- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JavaScript ES6+, FontAwesome 6, Web Audio API.
- **Backend**: Node.js / Bun runtime, Express 5, TypeScript.
- **Base de Datos & ORM**: PostgreSQL / SQLite con Prisma ORM 6.
- **Librerías Clave**: `jsonwebtoken` (Auth JWT), `cors`, `dotenv`.

## Estructura de Carpetas
```text
GameVault/
├── backend/
│   ├── prisma/             # schema.prisma y seed.ts
│   └── src/
│       ├── index.ts        # Servidor Express y montaje de rutas
│       ├── prisma.ts       # Instancia singleton de PrismaClient
│       ├── middlewares/    # auth.middleware.ts (verificación JWT y roles)
│       └── routes/         # auth, caja, categoria, cliente, pin, preventa, producto, venta
└── frontend/
    ├── index.html          # Login / Registro de usuarios con clave Admin
    ├── pos.html            # Terminal POS de ventas, carrito, preventas y corte de caja
    ├── inventario.html     # Panel de auditoría de stock y reabastecimiento (Solo Admin)
    ├── css/style.css       # Estilos cyber-grid, temas, fuentes y media queries de impresión
    ├── js/
    │   ├── app.js          # Auth en cliente, persistencia y modal HUD
    │   ├── pos.js          # Lógica POS, carrito, clientes, preventas y arqueo
    │   └── inventario.js   # Tabla de inventario, KPIs, altas y restock
    └── fonts/              # Tipografía Inter local
```

## Estado Actual y TODO
- **Completado en esta sesión**:
  - Corrección de error 500 en liquidación de preventas (`PATCH /api/preventas/:id` y `pos.js`) con validación de payload, casting de ID numérico y registro de fecha de entrega.
  - Reparación de modales y acciones de Reabastecer, Editar y Eliminar productos en el módulo de Inventario (`inventario.html` e `inventario.js`).
  - Lógica de reabastecimiento adaptativo para productos Físicos vs PIN Digital con textarea de múltiples códigos y endpoints `POST /api/productos/:id/pines`, `GET /api/productos/:id/pines` y `DELETE /api/pines/:id`.
  - Parseo a entero de `productoId`, búsqueda con `findFirst` y logging de depuración de Pines Digitales en `POST /api/ventas`. Asignación atómica de códigos a detalles, actualización a `VENDIDO` y recálculo de stock en `Producto`.
  - Estandarización de `productoId`, `esDigital` y `categoria` al agregar tarjetas/pines (como Steam Wallet Card) al carrito en `pos.js`.
- **TODO**:
  - Implementar paginación en tabla de ventas y preventas para alto volumen de registros.
  - Conectar tests e2e automatizados entre frontend y backend.
  - Generación de tickets PDF descargables nativos además del flujo de impresión del navegador.

## Comandos
```bash
# Backend
cd backend
bun install            # Instalar dependencias
bun run dev            # Iniciar servidor en desarrollo (http://localhost:3000)
bunx prisma generate   # Generar cliente de Prisma
bunx prisma db push    # Sincronizar esquema de base de datos
bun prisma/seed.ts     # Poblar datos iniciales

# Frontend
# Servir estáticamente frontend/ (ej. con Live Server o servidor estático local en puerto libre)
npx serve frontend
```
