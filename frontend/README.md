# GameVault - Portal de Autenticación & Punto de Venta (POS)

Sistema frontend de gestión comercial para tienda de videojuegos (**GameVault**), desarrollado con **HTML5**, **Tailwind CSS** y **JavaScript**.

---

## Módulos Implementados

### 1. Portal de Acceso & Registro de Cuentas (`index.html`)
- **Diseño Centrado & Minimalista**: Enfoque limpio en la tarjeta de autenticación con estética dark sobria y bordes sutiles.
- **Roles Diferenciados**:
  - **Empleado**: Orientado a cobros, ventas rápidas y atención en caja (`empleado` / `123`).
  - **Administrador**: Control total del negocio (inventario, métricas, personal) (`admin` / `admin`).
- **Clave Maestra de Administrador**: Para registrar una cuenta Admin se requiere ingresar la contraseña de seguridad (`1234`). El código se mantiene protegido y no se muestra en textos ni pistas en pantalla.

---

### 2. Terminal de Punto de Venta POS & Checkout (`pos.html`)
- **Lado Izquierdo (Catálogo de Artículos Disponibles)**:
  - Muestra los productos en stock listos para la venta con iconografía SVG vectorial categorizada (Consolas, Videojuegos, Accesorios, Coleccionables).
  - Filtros rápidos por categoría: *Todos*, *Consolas*, *Videojuegos*, *Accesorios*, *Coleccionables*.
  - Buscador reactivo y soporte para lector de código de barras (escaneo por SKU con tecla `Enter`).
  - Al hacer clic en cualquier artículo o en su botón `+ Agregar`, se añade inmediatamente al carrito de venta.
- **Lado Derecho (Resumen de Caja & Cobro)**:
  - **Carrito Dinámico**: Lista de productos seleccionados con controles para ajustar cantidades (`−`, `+`), subtotales y eliminación.
  - **Código de Ticket Dinámico**: Contador autoincrementable (ej. `#GV-0042`, `#GV-0043`...) que avanza automáticamente en cada venta realizada y se guarda en el navegador.
  - **Desglose Financiero**: Cálculo automático de Subtotal, IVA (16%), descuentos manuales o por cupón (`VIP10`).
  - **Total Destacado**: Tipografía prominente en cian sobre fondo slate dark.
  - **Métodos de Pago**:
    - **Efectivo**: Calculadora interactiva de monto recibido y cambio/vuelto.
    - **Tarjeta de Crédito / Débito**.
    - **Transferencia Bancaria**.
  - **Botón "COMPLETAR VENTA"**: Genera el comprobante/ticket modal con opción de impresión (`Ctrl+P`) e inicio de nueva venta.
- **Identidad de Cajero Dinámica**:
  - La barra superior lee la sesión iniciada en `index.html`.
  - Si ingresas como `empleado`, se muestra el distintivo cian de cajero.
  - Si ingresas como `admin`, se muestra el distintivo de administrador con acceso directo al Inventario.

---

## Cómo Ejecutar

1. Abre [`index.html`](file:///C:/Users/josec/OneDrive/Escritorio/Diseño_GameVault/index.html) para el Login y registro de usuarios. Cuentas por defecto:
   - **Administrador**: usuario `admin` | clave `admin`
   - **Empleado**: usuario `empleado` | clave `123`
2. Inicia sesión y haz clic en **"Punto de Venta POS →"** para acceder a [`pos.html`](file:///C:/Users/josec/OneDrive/Escritorio/Diseño_GameVault/pos.html) o **"Inventario Admin →"** para [`inventario.html`](file:///C:/Users/josec/OneDrive/Escritorio/Diseño_GameVault/inventario.html).
