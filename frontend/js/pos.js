const API_URL = "http://localhost:3000/api";

/**
 * Función centralizada para gestionar peticiones a la API del backend
 * - Adjunta automáticamente 'Authorization: Bearer <token>'
 * - Establece 'Content-Type: application/json' para POST y PUT
 * - Maneja errores 401 redirigiendo a index.html
 */
async function apiFetch(endpoint, opciones = {}) {
  let url = endpoint;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    let cleanEndpoint = endpoint;
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.substring(5);
    } else if (cleanEndpoint.startsWith('/api')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    } else if (cleanEndpoint.startsWith('api/')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    }
    if (cleanEndpoint.startsWith('/')) {
      cleanEndpoint = cleanEndpoint.substring(1);
    }
    url = cleanEndpoint ? `${API_URL}/${cleanEndpoint}` : API_URL;
  }

  const method = (opciones.method || 'GET').toUpperCase();
  const headers = { ...(opciones.headers || {}) };

  const token = localStorage.getItem('token');
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && !headers['Content-Type'] && !headers['content-type']) {
    if (!(opciones.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const fetchOptions = {
    ...opciones,
    method,
    headers
  };

  const response = await fetch(url, fetchOptions);

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('gamevault_active_user');
    const path = window.location.pathname.toLowerCase();
    if (!path.endsWith('index.html') && path !== '/' && !path.endsWith('/')) {
      window.location.href = 'index.html';
    }
  }

  return response;
}

/**
 * GameVault - Terminal Punto de Venta (POS) Checkout Logic
 * Catálogo de artículos disponibles a la izquierda, Carrito & Resumen de caja a la derecha.
 * Módulos integrados: Control de Roles, Clientes con Descuento VIP 5%, y Ciclo Completo de Preventas/Reservas.
 */

// Helper para generar iconos SVG por categoría
function getCategoryIcon(category, className = "w-5 h-5") {
  switch (category) {
    case 'consoles':
      return `<svg class="${className} text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4m-2-2v4m10-2h.01m-3-2h.01"/></svg>`;
    case 'games':
      return `<svg class="${className} text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/></svg>`;
    case 'accessories':
      return `<svg class="${className} text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>`;
    case 'merch':
      return `<svg class="${className} text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;
    case 'pines':
    case 'pin':
      return `<svg class="${className} text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 14h4"/><path d="M6 17h2"/><circle cx="17" cy="15" r="1"/></svg>`;
    default:
      return `<svg class="${className} text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  }
}


const DEFAULT_CATALOG = [
  // Consolas
  { id: 'c_ps5', name: 'PlayStation 5 Slim 1TB Digital', category: 'consoles', platform: 'PS5', sku: 'SS5-SLIM-01', price: 449.99, stock: 5 },
  { id: 'c_switch', name: 'Nintendo Switch OLED Blanco 64GB', category: 'consoles', platform: 'Switch', sku: 'NSW-OLED-02', price: 349.99, stock: 7 },
  { id: 'c_xbox', name: 'Xbox Series X 1TB Black Edition', category: 'consoles', platform: 'Xbox', sku: 'XSX-1TB-03', price: 499.99, stock: 4 },

  // Videojuegos
  { id: 'g_zelda', name: 'The Legend of Zelda: Tears of the Kingdom', category: 'games', platform: 'Switch', sku: 'S645507000000', price: 69.99, stock: 12 },
  { id: 'g_cyber', name: 'Cyberpunk 2077 Collector\'s Edition', category: 'games', platform: 'PC', sku: 'S349500S00000', price: 249.99, stock: 2 },
  { id: 'g_spiderman', name: 'Marvel\'s Spider-Man 2 Launch Edition', category: 'games', platform: 'PS5', sku: 'SM2-PS5-04', price: 69.99, stock: 14 },
  { id: 'g_gta', name: 'Grand Theft Auto VI - Pre-Order Edition', category: 'games', status: 'preventa', isPreventa: true, releaseDate: '2026-11-20', platform: 'Multi', sku: 'GTA6-PRE-05', price: 79.99, stock: 25 },
  { id: 'g_elden', name: 'Elden Ring: Shadow of the Erdtree Edition', category: 'games', platform: 'Multi', sku: 'ER-SHADOW-06', price: 59.99, stock: 9 },
  { id: 'g_mario', name: 'Super Mario Bros. Wonder', category: 'games', platform: 'Switch', sku: 'SMB-WONDER-07', price: 59.99, stock: 16 },
  { id: 'g_starfield', name: 'Starfield Premium Edition', category: 'games', platform: 'PC/Xbox', sku: 'STAR-PREM-08', price: 69.99, stock: 3 },

  // Accesorios
  { id: 'a_dualsense', name: 'PlayStation 5 DualSense Wireless Controller', category: 'accessories', platform: 'PS5', sku: 'SSXS8B0600000', price: 69.99, stock: 15 },
  { id: 'a_elite', name: 'Xbox Elite Wireless Controller Series 2', category: 'accessories', platform: 'Xbox/PC', sku: 'SSAS887000000', price: 179.99, stock: 6 },
  { id: 'a_pulse', name: 'Auriculares Gaming Pulse 3D Wireless', category: 'accessories', platform: 'PS5/PC', sku: 'PULSE-3D-08', price: 99.99, stock: 8 },
  { id: 'a_pro_switch', name: 'Nintendo Switch Pro Controller Original', category: 'accessories', platform: 'Switch', sku: 'NSW-PRO-09', price: 69.99, stock: 11 },


  // Coleccionables
  { id: 'm_sephiroth', name: 'Estatua Coleccionista Sephiroth FFVII 30cm', category: 'merch', platform: 'Merch', sku: 'SEPH-FIG-10', price: 129.99, stock: 1 },
  { id: 'm_amiibo', name: 'Figura Amiibo Link Tears of the Kingdom', category: 'merch', platform: 'Amiibo', sku: 'AMB-LINK-11', price: 29.99, stock: 18 }
];

let CATALOG = [];

function loadCatalogFromInventory() {
  const saved = localStorage.getItem('gamevault_inventory');
  if (saved) {
    try {
      CATALOG = JSON.parse(saved);
      CATALOG.forEach(item => {
        item.icon = item.category;
        if (item.id === 'g_gta' && !item.releaseDate) {
          item.isPreventa = true;
          item.status = 'preventa';
          item.releaseDate = '2026-11-20';
        }
      });
    } catch (e) {
      CATALOG = [...DEFAULT_CATALOG];
    }
  } else {
    CATALOG = [...DEFAULT_CATALOG];
    localStorage.setItem('gamevault_inventory', JSON.stringify(CATALOG));
  }
}

// ==========================================
// CLIENTES & PREVENTAS MOCK DATA & PERSISTENCE
// ==========================================
const DEFAULT_CLIENTS = [
  { id: 'cli_1', name: 'Alejandro Morales', phone: '5512345678', email: 'alex.gamer@gmail.com', createdAt: '2026-09-15' },
  { id: 'cli_2', name: 'Valeria Gómez', phone: '5598765432', email: 'valeria.g@outlook.com', createdAt: '2026-10-01' },
  { id: 'cli_3', name: 'Carlos Mendoza', phone: '5544332211', email: 'carlos.m@yahoo.com', createdAt: '2026-10-05' },
  { id: 'cli_4', name: 'Mariana Torres', phone: '5588776655', email: 'mariana.t@gmail.com', createdAt: '2026-10-08' }
];

// Anticipos fijados estrictamente al 50% (sin registros de prueba iniciales)
const DEFAULT_PREVENTAS = [];

// Estado global de Cliente y Preventa para la Venta Activa
let clienteActual = {
  id: 'publico',
  name: 'Público General',
  phone: '',
  email: '',
  isGeneral: true
};
let currentClient = clienteActual;
window.clienteActual = clienteActual;
window.currentClient = currentClient;

// Variables para el ciclo de vida de preventas
let activePreventaCredit = 0;       // Saldo a favor por anticipo en Fase B (Liquidación)
let linkedPreventaId = null;        // ID de la preventa que se está liquidando en Fase B
let pendingPreventaOrder = null;    // Datos de la preventa en Fase A pendiente de cobro en caja
let isPreventaClientModalContext = false;

// ==========================================
// REST API HELPERS WITH LOCALSTORAGE PERSISTENCE
// ==========================================
function getLocalClientes() {
  const saved = localStorage.getItem('gamevault_clientes');
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  localStorage.setItem('gamevault_clientes', JSON.stringify(DEFAULT_CLIENTS));
  return [...DEFAULT_CLIENTS];
}

function saveLocalCliente(clientData) {
  const clients = getLocalClientes();
  const newClient = {
    id: 'cli_' + Date.now(),
    name: clientData.name,
    phone: clientData.phone,
    email: clientData.email || '',
    createdAt: new Date().toISOString().split('T')[0]
  };
  clients.unshift(newClient);
  localStorage.setItem('gamevault_clientes', JSON.stringify(clients));
  return newClient;
}

async function apiGetClientes() {
  try {
    const res = await apiFetch('/clientes');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(c => ({
          id: c.id,
          name: c.nombre || c.name,
          phone: c.telefono || c.phone || '',
          email: c.email || '',
          createdAt: (c.createdAt || new Date().toISOString()).split('T')[0]
        }));
      }
    }
  } catch (e) {
    console.warn('Error al obtener clientes desde el backend:', e);
  }
  return getLocalClientes();
}

async function apiPostCliente(clientData) {
  try {
    const res = await apiFetch('/clientes', {
      method: 'POST',
      body: JSON.stringify({
        nombre: clientData.name || clientData.nombre,
        telefono: clientData.phone || clientData.telefono || '5550000000',
        email: clientData.email || ''
      })
    });
    if (res.ok) {
      const data = await res.json();
      const newClient = {
        id: data.id,
        name: data.nombre,
        phone: data.telefono,
        email: data.email || '',
        createdAt: new Date().toISOString().split('T')[0]
      };
      const clients = getLocalClientes();
      clients.unshift(newClient);
      localStorage.setItem('gamevault_clientes', JSON.stringify(clients));
      return newClient;
    }
  } catch (e) {
    console.warn('Error al guardar cliente en el backend:', e);
  }
  return saveLocalCliente(clientData);
}

// Helper para formatear fechas a DD/MM/AAAA
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
}

// Helper para calcular estado y días de entrega / llegada
function getReleaseStatusBadge(releaseDate) {
  if (!releaseDate) {
    return `<span class="text-slate-500 text-[10px] font-mono italic">Por definir</span>`;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(releaseDate + 'T00:00:00');
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono">
      <i class="fa-solid fa-check text-[9px]"></i>
      <span>¡Ya llegó a tienda!</span>
    </span>`;
  } else if (diffDays === 1) {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
      <i class="fa-regular fa-clock text-[9px]"></i>
      <span>Falta 1 día</span>
    </span>`;
  } else {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono">
      <i class="fa-regular fa-calendar text-[9px]"></i>
      <span>Faltan ${diffDays} días</span>
    </span>`;
  }
}

function getLocalPreventas() {
  const saved = localStorage.getItem('gamevault_preventas');
  if (saved) {
    try {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        // Limpiar registros iniciales de prueba generados por el seed (prev_1, prev_2, prev_3)
        const cleaned = list.filter(p => !['prev_1', 'prev_2', 'prev_3'].includes(p.id) && !p.isSeed);
        if (cleaned.length !== list.length) {
          localStorage.setItem('gamevault_preventas', JSON.stringify(cleaned));
        }
        return cleaned;
      }
    } catch(e) {}
  }
  localStorage.setItem('gamevault_preventas', JSON.stringify([]));
  return [];
}

function saveLocalPreventa(preventaData) {
  const preventas = getLocalPreventas();
  const newPrev = {
    id: 'prev_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    idCliente: preventaData.idCliente,
    clientName: preventaData.clientName || 'Cliente',
    clientPhone: preventaData.clientPhone || '',
    idProducto: preventaData.idProducto,
    productName: preventaData.productName || 'Producto',
    productPrice: parseFloat(preventaData.productPrice) || 0,
    montoAnticipo: parseFloat(preventaData.montoAnticipo) || 0,
    releaseDate: preventaData.releaseDate || '',
    estado: preventaData.estado || 'PENDIENTE'
  };
  preventas.unshift(newPrev);
  localStorage.setItem('gamevault_preventas', JSON.stringify(preventas));
  return newPrev;
}

async function apiGetPreventas() {
  try {
    const res = await apiFetch('/preventas');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(p => {
          const precioProd = parseFloat(p.montoTotal !== undefined ? p.montoTotal : (p.producto?.precio || p.productPrice || 0));
          const anticipo = parseFloat(p.anticipoPagado !== undefined ? p.anticipoPagado : (p.montoAnticipo || 0));
          const saldo = p.saldoPendiente !== undefined 
            ? parseFloat(p.saldoPendiente) 
            : (p.saldoRestante !== undefined ? parseFloat(p.saldoRestante) : Math.max(0, precioProd - anticipo));

          return {
            id: p.id,
            folio: p.folio || `PREV-${String(p.id).padStart(4, '0')}`,
            date: (p.fechaReserva || p.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
            idCliente: p.idCliente || p.cliente?.id,
            clientName: p.cliente?.nombre || p.clientName || 'Cliente',
            clientPhone: p.cliente?.telefono || p.clientPhone || '',
            idProducto: p.idProducto || p.producto?.id,
            productName: p.producto?.nombre || p.productName || 'Producto',
            productPrice: precioProd,
            montoTotal: precioProd,
            anticipoPagado: anticipo,
            montoAnticipo: anticipo,
            saldoPendiente: saldo,
            saldoRestante: saldo,
            releaseDate: p.releaseDate || '',
            estado: p.estado || 'PENDIENTE'
          };
        });
      }
    }
  } catch (e) {
    console.warn('Error al obtener preventas desde el backend:', e);
  }
  return getLocalPreventas().map(p => {
    const precioProd = parseFloat(p.productPrice || (p.montoAnticipo * 2) || 0);
    const anticipo = parseFloat(p.montoAnticipo || 0);
    const saldo = Math.max(0, precioProd - anticipo);
    return {
      ...p,
      folio: p.folio || `PREV-${String(p.id).padStart(4, '0')}`,
      montoTotal: precioProd,
      anticipoPagado: anticipo,
      saldoPendiente: saldo,
      saldoRestante: saldo,
    };
  });
}

// Función global requerida para consultar activamente las preventas desde el modal
window.cargarPreventas = async function() {
  await renderPreventasList();
};

async function apiPostPreventa(preventaData) {
  try {
    let targetProdId = !isNaN(parseInt(preventaData.idProducto)) ? parseInt(preventaData.idProducto) : null;
    if (!targetProdId && preventaData.idProducto) {
      const catProd = CATALOG.find(p => p.id === preventaData.idProducto || p.sku === preventaData.sku);
      if (catProd && !isNaN(parseInt(catProd.id))) {
        targetProdId = parseInt(catProd.id);
      }
    }

    let targetCliId = !isNaN(parseInt(preventaData.idCliente)) ? parseInt(preventaData.idCliente) : null;
    if (!targetCliId && preventaData.idCliente) {
      const allClients = getLocalClientes();
      const cFound = allClients.find(c => c.id === preventaData.idCliente);
      if (cFound && !isNaN(parseInt(cFound.id))) {
        targetCliId = parseInt(cFound.id);
      }
    }

    const anticipoNum = parseFloat(preventaData.montoAnticipo !== undefined ? preventaData.montoAnticipo : (preventaData.anticipoPagado || 0)) || 0;

    let formaPagoStr = 'EFECTIVO';
    const rawMethod = String(preventaData.formaPago || preventaData.metodoPago || preventaData.paymentMethod || selectedPaymentMethod || 'cash').toLowerCase();
    if (rawMethod === 'card' || rawMethod === 'tarjeta') {
      formaPagoStr = 'TARJETA';
    } else if (rawMethod === 'transfer' || rawMethod === 'transferencia') {
      formaPagoStr = 'TRANSFERENCIA';
    }

    const res = await apiFetch('/preventas', {
      method: 'POST',
      body: JSON.stringify({
        idProducto: targetProdId !== null ? targetProdId : preventaData.idProducto,
        idCliente: targetCliId !== null ? targetCliId : preventaData.idCliente,
        montoAnticipo: anticipoNum,
        anticipoPagado: anticipoNum,
        formaPago: formaPagoStr,
        metodoPago: formaPagoStr,
        estado: preventaData.estado || 'PENDIENTE'
      })
    });
    if (res.ok) {
      const data = await res.json();
      const newPrev = {
        id: data.id,
        folio: data.folio || `PREV-${String(data.id).padStart(4, '0')}`,
        date: (data.fechaReserva || '').split('T')[0] || new Date().toISOString().split('T')[0],
        fechaReserva: data.fechaReserva || new Date().toISOString(),
        idCliente: data.idCliente,
        clientName: data.cliente?.nombre || preventaData.clientName || 'Cliente',
        clientPhone: data.cliente?.telefono || preventaData.clientPhone || '',
        idProducto: data.idProducto,
        productName: data.producto?.nombre || preventaData.productName || 'Producto',
        productPrice: parseFloat(data.producto?.precio || preventaData.productPrice || data.montoTotal || 0),
        montoAnticipo: parseFloat(data.montoAnticipo || anticipoNum),
        anticipoPagado: parseFloat(data.anticipoPagado || data.montoAnticipo || anticipoNum),
        saldoPendiente: data.saldoPendiente !== undefined ? parseFloat(data.saldoPendiente) : Math.max(0, parseFloat(data.producto?.precio || preventaData.productPrice || 0) - anticipoNum),
        saldoRestante: data.saldoRestante !== undefined ? parseFloat(data.saldoRestante) : Math.max(0, parseFloat(data.producto?.precio || preventaData.productPrice || 0) - anticipoNum),
        formaPago: data.formaPago || formaPagoStr,
        metodoPago: data.metodoPago || formaPagoStr,
        releaseDate: preventaData.releaseDate || '',
        estado: data.estado || 'PENDIENTE'
      };
      const preventas = getLocalPreventas();
      preventas.unshift(newPrev);
      localStorage.setItem('gamevault_preventas', JSON.stringify(preventas));
      return newPrev;
    } else {
      let errorMsg = 'Error al registrar preventa';
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
      } catch (_) {}
      console.error(`[POST /api/preventas] Error HTTP ${res.status}:`, errorMsg);
    }
  } catch (e) {
    console.warn('Error al registrar preventa en el backend:', e);
  }
  return saveLocalPreventa(preventaData);
}

async function apiUpdatePreventa(id, patch) {
  const preventas = getLocalPreventas();
  const p = preventas.find(item => item.id === id || String(item.id) === String(id) || (!isNaN(item.id) && !isNaN(id) && Number(item.id) === Number(id)));
  const payload = patch || { estado: 'COMPLETADA' };
  if (p) {
    Object.assign(p, payload);
    localStorage.setItem('gamevault_preventas', JSON.stringify(preventas));
  }
  try {
    const res = await apiFetch(`/preventas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let errorMsg = 'Error al actualizar preventa';
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) errorMsg = errJson.error;
      } catch (_) {}
      console.error(`[PATCH /api/preventas/${id}] Error HTTP ${res.status}:`, errorMsg);
    }
  } catch (e) {
    console.warn(`Error en apiUpdatePreventa(${id}):`, e);
  }
}

async function apiGetProductos() {
  try {
    const res = await apiFetch('/productos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(p => {
          let catSlug = 'games';
          const catName = (p.categoria?.nombreCategoria || p.category || '').toLowerCase();
          if (catName.includes('consola')) catSlug = 'consoles';
          else if (catName.includes('videojuego') || catName.includes('juego')) catSlug = 'games';
          else if (catName.includes('accesorio')) catSlug = 'accessories';
          else if (catName.includes('pin') || p.esDigital) catSlug = 'pines';
          else if (catName.includes('merch') || catName.includes('colecc')) catSlug = 'merch';
          else if (p.category) catSlug = p.category;

          return {
            id: p.id,
            name: p.nombre || p.name,
            category: catSlug,
            platform: p.platform || (p.categoria?.nombreCategoria || 'General'),
            sku: p.codigo || p.sku || `SKU-${p.id}`,
            codigo: p.codigo || p.sku || `SKU-${p.id}`,
            price: parseFloat(p.precio !== undefined ? p.precio : p.price) || 0,
            stock: parseInt(p.stock !== undefined ? p.stock : 0),
            esDigital: Boolean(p.esDigital),
            isPin: Boolean(p.esDigital || catSlug === 'pines'),
            isPreventa: Boolean(p.isPreventa || (p.codigo && p.codigo.includes('PRE'))),
            status: p.status || (p.isPreventa ? 'preventa' : 'regular'),
            releaseDate: p.releaseDate || (p.codigo === 'GTA6-PRE-05' ? '2026-11-20' : '')
          };
        });
      }
    }
  } catch (e) {
    console.warn('Error al obtener productos desde el backend:', e);
  }
  return CATALOG;
}

// ==========================================
// CORTE DE CAJA / ARQUEO DE TURNO API & STATE
// ==========================================
let currentCorteResumen = null;
let lastCorteCierreSaved = null;

function getLocalCajaResumenHoy() {
  const sales = JSON.parse(localStorage.getItem('gamevault_ventas') || '[]');
  const todayStr = new Date().toISOString().split('T')[0];
  const lastCorteTime = localStorage.getItem('gamevault_last_corte_timestamp');

  // Sumar ÚNICAMENTE las ventas cuya fecha coincida con la fecha actual del sistema (YYYY-MM-DD)
  // y que pertenezcan a la jornada activa actual (posteriores al último corte si se realizó hoy)
  const todaySales = sales.filter(s => {
    const sDate = (s.createdAt || s.fecha || '').split('T')[0];
    if (sDate !== todayStr) return false;
    if (lastCorteTime) {
      const sTime = new Date(s.createdAt || s.fecha || 0).getTime();
      return sTime > parseInt(lastCorteTime, 10);
    }
    return true;
  });
  
  // 1. Fondo inicial de apertura de caja por defecto $500.00 MXN
  const fondoInicial = parseFloat(localStorage.getItem('gamevault_fondo_inicial') || '500.00');
  
  // Iniciar métricas en 0.00 para la jornada activa
  let ventasEfectivo = 0.00;
  let ventasTarjeta = 0.00;
  let ventasTransferencia = 0.00;
  let totalAnticiposPreventa = 0.00;
  let anticiposEfectivo = 0.00;

  todaySales.forEach(s => {
    const total = parseFloat(s.total) || parseFloat(s.montoTotal) || 0;
    const isAnticipo = s.isPreventaDepositSale || (s.items && s.items.some(i => i.isPreventaDeposit));
    const rawMethod = String(s.formaPago || s.metodoPago || s.paymentMethod || 'cash').toLowerCase();
    const isCard = rawMethod === 'card' || rawMethod === 'tarjeta';
    const isTransfer = rawMethod === 'transfer' || rawMethod === 'transferencia';
    
    if (isAnticipo) {
      totalAnticiposPreventa += total;
      if (isCard) {
        ventasTarjeta += total;
      } else if (isTransfer) {
        ventasTransferencia += total;
      } else {
        anticiposEfectivo += total;
      }
    } else {
      if (isCard) {
        ventasTarjeta += total;
      } else if (isTransfer) {
        ventasTransferencia += total;
      } else {
        ventasEfectivo += total;
      }
    }
  });

  ventasEfectivo = Math.round(ventasEfectivo * 100) / 100;
  ventasTarjeta = Math.round(ventasTarjeta * 100) / 100;
  ventasTransferencia = Math.round(ventasTransferencia * 100) / 100;
  totalAnticiposPreventa = Math.round(totalAnticiposPreventa * 100) / 100;
  anticiposEfectivo = Math.round(anticiposEfectivo * 100) / 100;

  // Total General Cobrado = suma total cobrada en la jornada activa (X + Y + Z)
  const totalCobrado = Math.round((ventasEfectivo + ventasTarjeta + ventasTransferencia) * 100) / 100;

  // Efectivo Esperado en Cajón = ÚNICAMENTE (Fondo Inicial + Ventas en Efectivo)
  const efectivoEsperado = Math.round((fondoInicial + ventasEfectivo) * 100) / 100;

  return {
    fecha: todayStr,
    fechaFormateada: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
    ticketsCount: todaySales.length,
    fondoInicial,
    ventasEfectivo,
    ventasTarjeta,
    ventasTransferencia,
    totalAnticiposPreventa,
    anticiposEfectivo,
    totalCobrado,
    efectivoEsperado
  };
}

async function apiGetCajaResumenHoy() {
  try {
    const res = await apiFetch('/caja/resumen-hoy');
    if (res.ok) {
      const data = await res.json();
      const fondoInicial = parseFloat(data.fondoInicial !== undefined ? data.fondoInicial : (localStorage.getItem('gamevault_fondo_inicial') || '500.00'));
      
      const vEfectivo = parseFloat(data.ventasEfectivo || 0);
      const vTarjeta = parseFloat(data.ventasTarjeta || 0);
      const vTransfer = parseFloat(data.ventasTransferencia || 0);
      const antPreventa = parseFloat(data.totalAnticipos !== undefined ? data.totalAnticipos : (data.totalAnticiposPreventa || 0));
      const antEfectivo = parseFloat(data.anticiposEfectivo || 0);
      const totalCob = data.totalCobrado !== undefined ? parseFloat(data.totalCobrado) : Math.round((vEfectivo + vTarjeta + vTransfer) * 100) / 100;
      
      // Efectivo Esperado en Cajón = ÚNICAMENTE (Fondo Inicial + Ventas en Efectivo)
      // No debe sumar tarjeta ni transferencia al efectivo en cajón para evitar faltantes falsos.
      const efEsperado = Math.round((fondoInicial + vEfectivo) * 100) / 100;

      return {
        fecha: data.fecha || new Date().toISOString().split('T')[0],
        fechaFormateada: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
        ticketsCount: data.ticketsCount !== undefined ? data.ticketsCount : (data.totalVentas || 0),
        fondoInicial,
        ventasEfectivo: vEfectivo,
        ventasTarjeta: vTarjeta,
        ventasTransferencia: vTransfer,
        totalAnticipos: antPreventa,
        totalAnticiposPreventa: antPreventa,
        anticiposEfectivo: antEfectivo,
        totalCobrado: totalCob,
        efectivoEsperado: efEsperado,
        backendData: data
      };
    }
  } catch (e) {
    console.warn('Error al consultar /api/caja/resumen-hoy, usando resumen local:', e);
  }
  return getLocalCajaResumenHoy();
}

async function apiPostCajaCierre(cierreData) {
  // Persistencia local en historial de cierres
  const cortes = JSON.parse(localStorage.getItem('gamevault_cortes') || '[]');
  cortes.unshift(cierreData);
  localStorage.setItem('gamevault_cortes', JSON.stringify(cortes));

  try {
    const res = await apiFetch('/caja/cierre', {
      method: 'POST',
      body: JSON.stringify(cierreData)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { success: true, ...cierreData };
}

async function apiPostVenta(ventaData) {
  // Asignación atómica de códigos PIN disponibles para cada unidad de PIN vendida
  const assignedPins = [];
  
  if (Array.isArray(ventaData.items)) {
    ventaData.items.forEach(item => {
      const isPinItem = item.isPin || item.category === 'pines' || DEFAULT_PIN_PRODUCTS.some(p => p.id === item.id);
      if (isPinItem) {
        for (let q = 0; q < item.qty; q++) {
          const pinRecord = allocatePinAtomically(item.id, ventaData.id, ventaData.ticketNumber);
          const pinProduct = DEFAULT_PIN_PRODUCTS.find(p => p.id === item.id) || CATALOG.find(p => p.id === item.id);
          assignedPins.push({
            pinId: pinRecord.id,
            productId: item.id,
            productName: item.name,
            platform: item.platform || pinProduct?.platform || 'Digital',
            montoSaldo: item.montoSaldo || pinProduct?.montoSaldo || '',
            code: pinRecord.code
          });
        }
      }
    });
  }

  const enrichedVentaData = {
    ...ventaData,
    assignedPins: assignedPins
  };

  const sales = JSON.parse(localStorage.getItem('gamevault_ventas') || '[]');
  sales.push(enrichedVentaData);
  localStorage.setItem('gamevault_ventas', JSON.stringify(sales));

  try {
    const userJson = localStorage.getItem('gamevault_active_user');
    let usuarioActual = userJson ? JSON.parse(userJson) : (window.usuarioActual || { id: 1 });
    if (!usuarioActual || !usuarioActual.id) {
      usuarioActual = { id: 1, ...(usuarioActual || {}) };
    }

    const clienteRef = (typeof clienteActual !== 'undefined' && clienteActual) 
      ? clienteActual 
      : (typeof currentClient !== 'undefined' && currentClient ? currentClient : (window.clienteActual || { id: null }));

    const clienteIdNum = (clienteRef && !clienteRef.isGeneral && clienteRef.id && clienteRef.id !== 'publico')
      ? Number(clienteRef.id)
      : (clienteRef && !isNaN(Number(clienteRef.id)) ? Number(clienteRef.id) : null);

    let formaPago = 'EFECTIVO';
    const pm = String(ventaData.paymentMethod || selectedPaymentMethod || '').trim().toLowerCase();
    if (pm === 'card' || pm === 'tarjeta') {
      formaPago = 'TARJETA';
    } else if (pm === 'transfer' || pm === 'transferencia') {
      formaPago = 'TRANSFERENCIA';
    }

    const itemsPayload = (ventaData.items || []).map(item => {
      let prodId = Number(item.productoId || item.id);
      if (isNaN(prodId) || prodId <= 0) {
        const cat = CATALOG.find(c => c.id === item.id || c.sku === item.sku || c.codigo === item.sku || c.name === item.name);
        prodId = (cat && !isNaN(Number(cat.id))) ? Number(cat.id) : 1;
      }
      return {
        productoId: Number(prodId),
        id: Number(prodId),
        cantidad: Number(item.cantidad || item.qty || 1),
        precioUnitario: Number(item.precioUnitario !== undefined ? item.precioUnitario : (item.price || item.precio || 0)),
        esDigital: Boolean(item.esDigital || item.isPin || item.category === 'pines'),
        categoria: item.categoria || item.category || 'pines',
        esPreventa: Boolean(item.esPreventa || item.isPreventa || item.isPreventaDeposit || ventaData.isPreventaDepositSale)
      };
    });

    const montoDescuento = Number(ventaData.descuento !== undefined ? ventaData.descuento : (ventaData.descuentoCliente || 0));
    const subtotalVal = Number(ventaData.subtotal || 0);
    const ivaVal = Number(ventaData.iva !== undefined ? ventaData.iva : Math.round(Math.max(0, subtotalVal - montoDescuento) * 0.16 * 100) / 100);
    const totalVal = Number(ventaData.total || 0);

    const backendPayload = {
      usuarioId: Number(usuarioActual.id),
      clienteId: clienteIdNum !== null && !isNaN(clienteIdNum) ? Number(clienteIdNum) : null,
      formaPago: String(formaPago),
      metodoPago: String(formaPago),
      items: itemsPayload,
      subtotal: subtotalVal,
      descuento: montoDescuento,
      iva: ivaVal,
      total: totalVal,
      montoTotal: totalVal,
      isPreventaDepositSale: Boolean(ventaData.isPreventaDepositSale),
      isPreventa: Boolean(ventaData.isPreventa),
      preventa: ventaData.preventaData || (ventaData.isPreventaDepositSale && ventaData.pendingPreventa ? ventaData.pendingPreventa : null),
      preventaId: ventaData.preventaId || ventaData.linkedPreventaId || null,
      linkedPreventaId: ventaData.linkedPreventaId || null
    };

    const res = await apiFetch('/ventas', {
      method: 'POST',
      body: JSON.stringify(backendPayload)
    });

    if (res.ok) {
      const serverResult = await res.json();
      return {
        ...enrichedVentaData,
        backendId: serverResult.id,
        detalles: serverResult.detalles
      };
    } else {
      let errorMsg = 'Error al registrar venta en el backend';
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch (_) {}
      console.error(`[POST /api/ventas] Error HTTP ${res.status}:`, errorMsg);
    }
  } catch (e) {
    console.warn('Error al registrar venta en el backend:', e);
  }

  return enrichedVentaData;
}

// Carrito de ventas (inicia vacío o con muestra básica)
let cart = [
  { id: 'a_dualsense', name: 'PlayStation 5 DualSense Wireless Controller', category: 'accessories', platform: 'PS5', sku: 'SSXS8B0600000', price: 69.99, qty: 1 },
  { id: 'g_zelda', name: 'The Legend of Zelda: Tears of the Kingdom', category: 'games', platform: 'Switch', sku: 'S645507000000', price: 69.99, qty: 1 }
];

let selectedCategory = 'all';
let searchQuery = '';
let selectedPaymentMethod = 'cash'; // 'cash' | 'card' | 'transfer'
let currentDiscount = 0; // Descuento manual o cupón

// Función para calcular el consecutivo de ticket según las ventas procesadas en la jornada activa
function getJornadaTicketCounter() {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastCorteTime = localStorage.getItem('gamevault_last_corte_timestamp');
  
  const sales = JSON.parse(localStorage.getItem('gamevault_ventas') || '[]');
  const activeSales = sales.filter(s => {
    const sDate = (s.createdAt || s.fecha || '').split('T')[0];
    if (sDate !== todayStr) return false;
    if (lastCorteTime) {
      const sTime = new Date(s.createdAt || s.fecha || 0).getTime();
      return sTime > parseInt(lastCorteTime, 10);
    }
    return true;
  });

  return activeSales.length + 1;
}

// Estado del Ticket y última venta para WhatsApp
let ticketCounter = getJornadaTicketCounter();
let lastCompletedSale = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Establece por defecto el Fondo Inicial de Caja en $500.00 MXN si no está definido
  if (!localStorage.getItem('gamevault_fondo_inicial')) {
    localStorage.setItem('gamevault_fondo_inicial', '500.00');
  }

  // Limpieza proactiva de registros de prueba iniciales generados por el seed
  try {
    const rawPrev = localStorage.getItem('gamevault_preventas');
    if (rawPrev) {
      const list = JSON.parse(rawPrev);
      if (Array.isArray(list)) {
        const cleaned = list.filter(p => !['prev_1', 'prev_2', 'prev_3'].includes(p.id) && !p.isSeed);
        localStorage.setItem('gamevault_preventas', JSON.stringify(cleaned));
      }
    }
  } catch(e) {}

  loadCatalogFromInventory();
  getLocalClientes();
  getLocalPreventas();
  loadActiveUser();
  updateTicketBadge();
  updateClientDisplay();
  renderCatalog();
  renderCart();
  setupEventListeners();
  setupAdminToolsDropdown();
  setupClientModule();
  setupPreventasModule();
  setupCorteCajaModule();

  // Sincronizar catálogo real desde backend
  try {
    const backendProducts = await apiGetProductos();
    if (Array.isArray(backendProducts) && backendProducts.length > 0) {
      CATALOG = backendProducts;
      localStorage.setItem('gamevault_inventory', JSON.stringify(CATALOG));
      renderCatalog();
    }
  } catch (err) {
    console.warn('Usando catálogo local:', err);
  }
});

// ========================================================
// 1. LIMPIEZA DEL HEADER & CONTROL DE ROLES
// ========================================================
function isCurrentUserAdmin() {
  const savedUserJson = localStorage.getItem('gamevault_active_user');
  if (!savedUserJson) return false;
  try {
    const user = JSON.parse(savedUserJson);
    const role = (user.role || '').toLowerCase();
    return role === 'admin' || role === 'administrador';
  } catch (e) {
    return false;
  }
}

function loadActiveUser() {
  const cashierNameEl = document.getElementById('pos-cashier-name');
  const cashierRoleEl = document.getElementById('pos-cashier-role');
  const adminToolsContainer = document.getElementById('admin-tools-container');
  const employeeToolsContainer = document.getElementById('employee-tools-container');

  const savedUserJson = localStorage.getItem('gamevault_active_user');
  let activeUser = null;

  if (savedUserJson) {
    try {
      activeUser = JSON.parse(savedUserJson);
    } catch (e) {}
  }

  // Si no hay usuario guardado, por defecto es el Empleado original (José Cabrales)
  if (!activeUser) {
    activeUser = {
      id: 1,
      fullname: 'José Cabrales',
      role: 'empleado',
      username: 'empleado'
    };
    localStorage.setItem('gamevault_active_user', JSON.stringify(activeUser));
  } else if (!activeUser.id) {
    activeUser.id = 1;
    localStorage.setItem('gamevault_active_user', JSON.stringify(activeUser));
  }
  window.usuarioActual = activeUser;

  // Si el usuario actual es empleado, respaldarlo como el empleado original para cuando regrese de admin
  const currentRole = (activeUser.role || '').toLowerCase();
  if (currentRole !== 'admin' && currentRole !== 'administrador') {
    localStorage.setItem('gamevault_original_employee', JSON.stringify(activeUser));
  }

  const cleanFullname = (activeUser.fullname || activeUser.nombreCompleto || '').replace(/\s*\(\s*admin vault\s*\)/i, '').trim();
  if (cashierNameEl) cashierNameEl.textContent = cleanFullname;

  const roleLower = (activeUser.role || activeUser.rol || '').toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'administrador';

  if (cashierRoleEl) {
    cashierRoleEl.textContent = isAdmin ? 'ADMINISTRADOR' : (roleLower === 'cajero' ? 'CAJERO' : 'EMPLEADO');
    cashierRoleEl.className = isAdmin ? 'text-[10px] font-mono text-purple-300 font-bold' : 'text-[10px] font-mono text-cyan-300 font-semibold';
  }

  // Control de visibilidad según rol:
  // - SI EL ROL ES 'ADMINISTRADOR': Menú desplegable 'Herramientas'
  // - SI EL ROL ES 'CAJERO' / 'EMPLEADO': Botones directos 'Preventas' y 'Clientes'
  if (isAdmin) {
    if (adminToolsContainer) adminToolsContainer.classList.remove('hidden');
    if (employeeToolsContainer) {
      employeeToolsContainer.classList.add('hidden');
      employeeToolsContainer.classList.remove('flex');
    }
  } else {
    if (adminToolsContainer) {
      adminToolsContainer.classList.add('hidden');
      const adminMenu = document.getElementById('admin-tools-menu');
      if (adminMenu) adminMenu.classList.add('hidden');
    }
    if (employeeToolsContainer) {
      employeeToolsContainer.classList.remove('hidden');
      employeeToolsContainer.classList.add('flex');
    }
  }
}

function setupAdminToolsDropdown() {
  const btnAdminTools = document.getElementById('btn-admin-tools');
  const adminToolsMenu = document.getElementById('admin-tools-menu');
  const adminToolsChevron = document.getElementById('admin-tools-chevron');
  const adminToolsContainer = document.getElementById('admin-tools-container');

  if (btnAdminTools && adminToolsMenu) {
    btnAdminTools.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = adminToolsMenu.classList.contains('hidden');
      if (isHidden) {
        adminToolsMenu.classList.remove('hidden');
        if (adminToolsChevron) adminToolsChevron.classList.add('rotate-180');
      } else {
        adminToolsMenu.classList.add('hidden');
        if (adminToolsChevron) adminToolsChevron.classList.remove('rotate-180');
      }
    });

    // Cerrar menú al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (adminToolsContainer && !adminToolsContainer.contains(e.target)) {
        adminToolsMenu.classList.add('hidden');
        if (adminToolsChevron) adminToolsChevron.classList.remove('rotate-180');
      }
    });
  }

  // Opciones del Menú Desplegable Admin:
  // 1. Inventario (enlace directo a inventario.html)
  // 2. Preventas y Reservas
  const btnMenuPreventas = document.getElementById('btn-menu-preventas');
  if (btnMenuPreventas) {
    btnMenuPreventas.addEventListener('click', () => {
      if (adminToolsMenu) adminToolsMenu.classList.add('hidden');
      openPreventasModal();
    });
  }

  // 3. Corte de Caja (Restringido a usuarios con rol Administrador)
  const btnMenuCorteCaja = document.getElementById('btn-menu-corte-caja');
  if (btnMenuCorteCaja) {
    btnMenuCorteCaja.addEventListener('click', () => {
      if (!isCurrentUserAdmin()) {
        showToast('Acceso Denegado: Solo usuarios con rol de Administrador pueden realizar el Corte de Caja.', 'error');
        return;
      }
      if (adminToolsMenu) adminToolsMenu.classList.add('hidden');
      openCorteCajaModal();
    });
  }

  // 4. Clientes
  const btnMenuClientes = document.getElementById('btn-menu-clientes');
  if (btnMenuClientes) {
    btnMenuClientes.addEventListener('click', () => {
      if (adminToolsMenu) adminToolsMenu.classList.add('hidden');
      openClientModal(false);
    });
  }

  // Botones directos para CAJERO / EMPLEADO
  const btnEmployeePreventas = document.getElementById('btn-employee-preventas');
  if (btnEmployeePreventas) {
    btnEmployeePreventas.addEventListener('click', () => {
      openPreventasModal();
    });
  }

  const btnEmployeeClientes = document.getElementById('btn-employee-clientes');
  if (btnEmployeeClientes) {
    btnEmployeeClientes.addEventListener('click', () => {
      openClientModal(false);
    });
  }

  // Conmutador de rol autenticado en el badge de cajero
  setupRoleSwitchModal();
}

function setupRoleSwitchModal() {
  const cashierBadge = document.getElementById('cashier-container');
  const modal = document.getElementById('role-switch-modal');
  const form = document.getElementById('role-switch-form');
  const pinInput = document.getElementById('role-switch-pin');
  const titleEl = document.getElementById('role-switch-title');
  const subtitleEl = document.getElementById('role-switch-subtitle');
  const labelEl = document.getElementById('role-switch-label');
  const hintEl = document.getElementById('role-switch-hint');
  const iconEl = document.getElementById('role-switch-icon');
  const btnClose = document.getElementById('btn-close-role-switch');
  const btnCancel = document.getElementById('btn-cancel-role-switch');
  const btnSubmit = document.getElementById('btn-submit-role-switch');

  if (!cashierBadge || !modal) return;

  let targetRole = 'admin'; // 'admin' o 'empleado'

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (form) form.reset();
  };

  const openModal = () => {
    const savedUserJson = localStorage.getItem('gamevault_active_user');
    let currentRole = 'empleado';
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        currentRole = (parsed.role || parsed.rol || 'empleado').toLowerCase();
      } catch (e) {}
    }

    const isCurrentlyAdmin = currentRole === 'admin' || currentRole === 'administrador';

    if (isCurrentlyAdmin) {
      // Regreso a Empleado Original
      targetRole = 'empleado';
      let originalEmployee = { fullname: 'José Cabrales', username: 'empleado' };
      const origJson = localStorage.getItem('gamevault_original_employee');
      if (origJson) {
        try { originalEmployee = JSON.parse(origJson); } catch (e) {}
      }

      if (titleEl) titleEl.textContent = 'REGRESAR A MODO EMPLEADO';
      if (subtitleEl) subtitleEl.textContent = `Restaurar sesión: ${originalEmployee.fullname || 'José Cabrales'}`;
      if (labelEl) labelEl.textContent = `Contraseña o PIN de ${originalEmployee.fullname || 'José Cabrales'} *`;
      if (hintEl) hintEl.textContent = 'Ingresa el PIN (ej. 123 o 1234) o contraseña para restaurar tu sesión.';
      if (iconEl) {
        iconEl.className = 'w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400';
        iconEl.innerHTML = '<i class="fa-solid fa-user-check text-xs"></i>';
      }
      if (btnSubmit) {
        btnSubmit.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5';
      }
    } else {
      // Cambio a Administrador
      targetRole = 'admin';
      if (titleEl) titleEl.textContent = 'AUTORIZACIÓN DE ADMINISTRADOR';
      if (subtitleEl) subtitleEl.textContent = 'Acceso a herramientas avanzadas y corte de caja';
      if (labelEl) labelEl.textContent = 'Contraseña o PIN de Administrador *';
      if (hintEl) hintEl.textContent = 'Ingresa la contraseña de cuenta administrativa o clave maestra (ej. 1234).';
      if (iconEl) {
        iconEl.className = 'w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400';
        iconEl.innerHTML = '<i class="fa-solid fa-shield-halved text-xs"></i>';
      }
      if (btnSubmit) {
        btnSubmit.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5';
      }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      if (pinInput) pinInput.focus();
    }, 100);
  };

  cashierBadge.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pinValue = (pinInput ? pinInput.value : '').trim();
      if (!pinValue) {
        showToast('Por favor introduce tu contraseña o PIN', 'error');
        return;
      }

      if (btnSubmit) btnSubmit.disabled = true;

      try {
        if (targetRole === 'admin') {
          // POST /api/auth/verify-admin
          const res = await apiFetch('/auth/verify-admin', {
            method: 'POST',
            body: JSON.stringify({ password: pinValue, pin: pinValue })
          });

          if (res && res.success && res.usuario) {
            const adminUser = {
              id: res.usuario.id,
              fullname: res.usuario.nombreCompleto || res.usuario.fullname || 'Administrador GameVault',
              role: 'admin',
              rol: 'ADMINISTRADOR',
              username: res.usuario.username || 'admin'
            };
            localStorage.setItem('gamevault_active_user', JSON.stringify(adminUser));
            if (res.token) localStorage.setItem('gamevault_auth_token', res.token);

            showToast('Modo Administrador activado con éxito', 'success');
            closeModal();
            loadActiveUser();
          } else {
            // Fallback offline si el backend no responde o modo demo offline
            if (pinValue === '1234' || pinValue === 'admin123') {
              const adminUser = {
                id: 1,
                fullname: 'Administrador GameVault',
                role: 'admin',
                rol: 'ADMINISTRADOR',
                username: 'admin'
              };
              localStorage.setItem('gamevault_active_user', JSON.stringify(adminUser));
              showToast('Modo Administrador activado con éxito', 'success');
              closeModal();
              loadActiveUser();
            } else {
              showToast(res && res.error ? res.error : 'Contraseña o PIN de Administrador incorrecto', 'error');
            }
          }
        } else {
          // targetRole === 'empleado' -> Restaurar empleado original
          let orig = { fullname: 'José Cabrales', username: 'empleado', id: 2 };
          const origJson = localStorage.getItem('gamevault_original_employee');
          if (origJson) {
            try { orig = JSON.parse(origJson); } catch (e) {}
          }

          const res = await apiFetch('/auth/verify-employee', {
            method: 'POST',
            body: JSON.stringify({
              username: orig.username || 'empleado',
              id: orig.id,
              password: pinValue,
              pin: pinValue
            })
          });

          if (res && res.success && res.usuario) {
            const empUser = {
              id: res.usuario.id || orig.id,
              fullname: res.usuario.nombreCompleto || orig.fullname || 'José Cabrales',
              role: 'empleado',
              rol: 'EMPLEADO',
              username: res.usuario.username || orig.username || 'empleado'
            };
            localStorage.setItem('gamevault_active_user', JSON.stringify(empUser));
            localStorage.setItem('gamevault_original_employee', JSON.stringify(empUser));
            if (res.token) localStorage.setItem('gamevault_auth_token', res.token);

            showToast(`Sesión de ${empUser.fullname} restaurada con éxito`, 'success');
            closeModal();
            loadActiveUser();
          } else {
            // Fallback offline si backend no responde
            if (pinValue === '123' || pinValue === '1234') {
              const empUser = {
                id: orig.id || 2,
                fullname: orig.fullname || 'José Cabrales',
                role: 'empleado',
                rol: 'EMPLEADO',
                username: orig.username || 'empleado'
              };
              localStorage.setItem('gamevault_active_user', JSON.stringify(empUser));
              localStorage.setItem('gamevault_original_employee', JSON.stringify(empUser));
              showToast(`Sesión de ${empUser.fullname} restaurada con éxito`, 'success');
              closeModal();
              loadActiveUser();
            } else {
              showToast(res && res.error ? res.error : 'Contraseña o PIN de Empleado incorrecto', 'error');
            }
          }
        }
      } catch (err) {
        // Fallback en caso de desconexión completa
        if (targetRole === 'admin' && (pinValue === '1234' || pinValue === 'admin123')) {
          const adminUser = { id: 1, fullname: 'Administrador GameVault', role: 'admin', rol: 'ADMINISTRADOR', username: 'admin' };
          localStorage.setItem('gamevault_active_user', JSON.stringify(adminUser));
          showToast('Modo Administrador activado (modo sin conexión)', 'info');
          closeModal();
          loadActiveUser();
        } else if (targetRole === 'empleado' && (pinValue === '123' || pinValue === '1234')) {
          let orig = { fullname: 'José Cabrales', username: 'empleado', role: 'empleado' };
          try { orig = JSON.parse(localStorage.getItem('gamevault_original_employee')) || orig; } catch (e) {}
          localStorage.setItem('gamevault_active_user', JSON.stringify(orig));
          showToast(`Sesión de ${orig.fullname} restaurada (modo sin conexión)`, 'info');
          closeModal();
          loadActiveUser();
        } else {
          showToast('Error al verificar credenciales', 'error');
        }
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });
  }
}

// Formato de Ticket dinámico (ej. #GV-0042)
function getFormattedTicket(counter) {
  return `GV-${String(counter).padStart(4, '0')}`;
}

function updateTicketBadge() {
  ticketCounter = getJornadaTicketCounter();
  localStorage.setItem('gamevault_ticket_counter', ticketCounter.toString());
  const badge = document.getElementById('ticket-number-badge');
  if (badge) {
    badge.textContent = `TICKET #${getFormattedTicket(ticketCounter)}`;
  }
}

// ========================================================
// 2. MÓDULO DE CLIENTES & DESCUENTO AUTOMÁTICO DEL 5%
// ========================================================
function updateClientDisplay() {
  const nameEl = document.getElementById('pos-client-name');
  const phoneEl = document.getElementById('pos-client-phone');
  const discountBadge = document.getElementById('pos-client-discount-badge');
  const removeBtn = document.getElementById('btn-remove-client');

  const client = clienteActual || currentClient;
  const isGeneral = !client || client.isGeneral || client.id === 'publico';

  if (isGeneral) {
    if (nameEl) nameEl.textContent = 'Público General';
    if (phoneEl) phoneEl.textContent = 'Venta Mostrador Estándar';
    if (discountBadge) discountBadge.classList.add('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
  } else {
    if (nameEl) nameEl.textContent = client.name || client.nombre || 'Cliente';
    if (phoneEl) {
      const phone = client.phone || client.telefono || '';
      const email = client.email || '';
      phoneEl.innerHTML = phone 
        ? `<i class="fa-solid fa-phone text-[9px] mr-1 text-slate-400"></i>${phone}${email ? ' • ' + email : ''}`
        : (email ? `<i class="fa-solid fa-envelope text-[9px] mr-1 text-slate-400"></i>${email}` : 'Cliente Frecuente');
    }
    if (discountBadge) discountBadge.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  }
}

function establecerClienteActual(cliente) {
  clienteActual = cliente || { id: 'publico', name: 'Público General', isGeneral: true };
  currentClient = clienteActual;
  window.clienteActual = clienteActual;
  window.currentClient = currentClient;

  // a) Actualiza el banner del cliente en el resumen de caja
  updateClientDisplay();

  // b) Recalcula los totales del carrito aplicando el 5% de descuento automático
  calculateTotals();

  // c) Cierra el modal de selección de cliente
  closeClientModal();
}

function setClient(client) {
  establecerClienteActual(client);
}

function setupClientModule() {
  const clientModal = document.getElementById('client-modal');
  const btnOpenClientModal = document.getElementById('btn-open-client-modal');
  const btnCloseClientModal = document.getElementById('btn-close-client-modal');
  const btnCancelClientCreate = document.getElementById('btn-cancel-client-create');
  const btnRemoveClient = document.getElementById('btn-remove-client');
  const btnAssignGeneral = document.getElementById('btn-assign-general');
  const clientSearchInput = document.getElementById('client-search-input');
  const clientSearchResults = document.getElementById('client-search-results');
  const clientCreateForm = document.getElementById('client-create-form');

  // Abrir modal desde Resumen de Caja
  if (btnOpenClientModal) {
    btnOpenClientModal.addEventListener('click', () => {
      openClientModal(false);
    });
  }

  // Quitar cliente y volver a Público General
  if (btnRemoveClient) {
    btnRemoveClient.addEventListener('click', () => {
      establecerClienteActual({ id: 'publico', name: 'Público General', isGeneral: true });
      showToast('Cliente desvinculado. Venta como Público General (Sin descuento)', 'info');
    });
  }

  // Cerrar modal
  if (btnCloseClientModal) {
    btnCloseClientModal.addEventListener('click', closeClientModal);
  }
  if (btnCancelClientCreate) {
    btnCancelClientCreate.addEventListener('click', closeClientModal);
  }

  // Asignar Público General desde el modal
  if (btnAssignGeneral) {
    btnAssignGeneral.addEventListener('click', () => {
      establecerClienteActual({ id: 'publico', name: 'Público General', isGeneral: true });
      showToast('Asignado: Público General (Sin descuento)', 'info');
    });
  }

  // Delegación de clic para botones Asignar en la lista de resultados
  if (clientSearchResults) {
    clientSearchResults.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-client-id]');
      if (btn) {
        const id = btn.getAttribute('data-client-id');
        await window.asignarCliente(id);
      }
    });
  }

  // Búsqueda de clientes en tiempo real
  if (clientSearchInput) {
    clientSearchInput.addEventListener('input', () => {
      renderClientSearchResults(clientSearchInput.value);
    });
  }

  // Formulario de Alta Rápida de Cliente (POST /api/clientes)
  if (clientCreateForm) {
    clientCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('client-name-input');
      const phoneInput = document.getElementById('client-phone-input');
      const emailInput = document.getElementById('client-email-input');

      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const email = emailInput.value.trim();

      if (!name || !phone) {
        showToast('Nombre y Teléfono son obligatorios', 'warning');
        return;
      }

      const newClient = await apiPostCliente({ name, phone, email });

      // Reset de campos del formulario
      clientCreateForm.reset();

      // Si fue abierto desde el formulario de Preventas:
      if (isPreventaClientModalContext) {
        await populatePreventasClients();
        const preventaSelect = document.getElementById('preventa-client-select');
        if (preventaSelect) preventaSelect.value = newClient.id;
        closeClientModal();
        showToast(`Cliente "${newClient.name}" registrado y seleccionado para la preventa`, 'success');
      } else {
        // Asignar inmediatamente a la venta activa
        establecerClienteActual(newClient);
        showToast(`Cliente "${newClient.name}" registrado y asignado (Descuento 5% activo)`, 'success');
      }
    });
  }
}

function openClientModal(fromPreventaContext = false) {
  isPreventaClientModalContext = fromPreventaContext;
  const clientModal = document.getElementById('client-modal');
  const clientSearchInput = document.getElementById('client-search-input');
  if (!clientModal) return;

  if (clientSearchInput) {
    clientSearchInput.value = '';
  }
  renderClientSearchResults('');

  clientModal.classList.remove('hidden');
  clientModal.classList.add('flex');
}

function closeClientModal() {
  const clientModal = document.getElementById('client-modal');
  if (clientModal) {
    clientModal.classList.add('hidden');
    clientModal.classList.remove('flex');
  }
  isPreventaClientModalContext = false;
}

async function renderClientSearchResults(query = '') {
  const container = document.getElementById('client-search-results');
  if (!container) return;

  const clients = await apiGetClientes();
  const q = query.trim().toLowerCase();

  const filtered = clients.filter(c => {
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-center text-xs text-slate-500 font-mono">
        No se encontraron clientes con "${query}". Utiliza el formulario de abajo para registrarlo.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between gap-2.5 transition-colors">
      <div class="overflow-hidden">
        <div class="flex items-center gap-2">
          <span class="font-bold text-slate-100 text-xs truncate">${c.name || c.nombre}</span>
          <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">5% OFF</span>
        </div>
        <div class="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
          <span class="flex items-center gap-1"><i class="fa-solid fa-phone text-[10px]"></i> ${c.phone || c.telefono || 'S/T'}</span>
          ${c.email ? `<span class="truncate flex items-center gap-1">• <i class="fa-solid fa-envelope text-[10px]"></i> ${c.email}</span>` : ''}
        </div>
      </div>
      <button 
        type="button" 
        onclick="asignarCliente('${c.id}')"
        data-client-id="${c.id}"
        class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white transition-all shrink-0 cursor-pointer shadow-sm btn-asignar-cliente inline-flex items-center gap-1"
      >
        <span>Asignar</span>
        <i class="fa-solid fa-check text-[10px]"></i>
      </button>
    </div>
  `).join('');
}

window.asignarCliente = async function(clientOrId) {
  let client = null;
  if (clientOrId && typeof clientOrId === 'object') {
    client = clientOrId;
  } else {
    const clients = await apiGetClientes();
    client = clients.find(c => 
      c.id === clientOrId || 
      String(c.id) === String(clientOrId) || 
      (!isNaN(c.id) && !isNaN(clientOrId) && Number(c.id) === Number(clientOrId))
    );
  }
  if (!client) return;

  if (isPreventaClientModalContext) {
    const preventaSelect = document.getElementById('preventa-client-select');
    if (preventaSelect) {
      preventaSelect.value = client.id;
    }
    closeClientModal();
    showToast(`Cliente "${client.name || client.nombre}" seleccionado para la preventa`, 'success');
  } else {
    establecerClienteActual(client);
    showToast(`Cliente "${client.name || client.nombre}" asignado a la venta actual (5% de descuento activo)`, 'success');
  }
};

window.selectClient = window.asignarCliente;
window.establecerClienteActual = establecerClienteActual;

// ========================================================
// 3. MÓDULO DE PREVENTAS Y RESERVAS (CICLO REAL)
// ========================================================
function setupPreventasModule() {
  const preventasModal = document.getElementById('preventas-modal');
  const btnClosePreventasModal = document.getElementById('btn-close-preventas-modal');
  const btnCancelPreventa = document.getElementById('btn-cancel-preventa');
  const tabNew = document.getElementById('tab-preventas-new');
  const tabList = document.getElementById('tab-preventas-list');
  const form = document.getElementById('preventas-form');
  const btnQuickClient = document.getElementById('btn-preventa-quick-client');
  const productSelect = document.getElementById('preventa-product-select');
  const anticipoInput = document.getElementById('preventa-anticipo-input');
  const preventaHelperText = document.getElementById('preventa-helper-text');
  const btnRemovePreventaCredit = document.getElementById('btn-remove-preventa-credit');

  if (btnClosePreventasModal) {
    btnClosePreventasModal.addEventListener('click', closePreventasModal);
  }
  if (btnCancelPreventa) {
    btnCancelPreventa.addEventListener('click', closePreventasModal);
  }

  // Botón [X] para remover anticipo de preventa aplicado en el desglose de totales
  if (btnRemovePreventaCredit) {
    btnRemovePreventaCredit.addEventListener('click', () => {
      removePreventaCredit();
    });
  }

  // Pestañas
  if (tabNew) {
    tabNew.addEventListener('click', () => setPreventasTab('new'));
  }
  if (tabList) {
    tabList.addEventListener('click', () => setPreventasTab('list'));
  }

  // Botón "+ Nuevo Cliente" en el formulario de preventas (no pierde datos)
  if (btnQuickClient) {
    btnQuickClient.addEventListener('click', () => {
      openClientModal(true);
    });
  }

  // REGLA DE ANTICIPO FIJO AL 50%:
  // Al seleccionar producto, se calcula automáticamente el 50% y el campo es readonly
  if (productSelect && anticipoInput) {
    productSelect.addEventListener('change', () => {
      const prodId = productSelect.value;
      const releaseInfoEl = document.getElementById('preventa-release-date-info');
      const releaseValEl = document.getElementById('preventa-release-date-val');

      if (!prodId) {
        anticipoInput.value = '';
        anticipoInput.readOnly = true;
        anticipoInput.setAttribute('readonly', 'true');
        if (preventaHelperText) {
          preventaHelperText.textContent = 'Selecciona un producto para calcular automáticamente el 50% de anticipo.';
        }
        if (releaseInfoEl) {
          releaseInfoEl.classList.add('hidden');
          releaseInfoEl.classList.remove('flex');
        }
        return;
      }

      // Parsea el ID usando Number(idProducto) o String(idProducto) para asegurar coincidencia exacta con el catálogo
      const idProductoNum = Number(prodId);
      const idProductoStr = String(prodId);
      let prod = CATALOG.find(p => 
        p.id === idProductoNum || 
        p.id === idProductoStr || 
        String(p.id) === idProductoStr || 
        (!isNaN(p.id) && !isNaN(idProductoNum) && Number(p.id) === idProductoNum)
      );

      let precio = 0;
      if (prod) {
        precio = parseFloat(prod.precio !== undefined ? prod.precio : prod.price) || 0;
      } else {
        const selectedOpt = productSelect.options[productSelect.selectedIndex];
        const dataPrice = selectedOpt ? parseFloat(selectedOpt.getAttribute('data-price')) : 0;
        if (dataPrice > 0) precio = dataPrice;
      }

      // montoAnticipo = producto.precio * 0.50
      const montoAnticipo = Math.round(precio * 0.50 * 100) / 100;
      anticipoInput.value = montoAnticipo.toFixed(2);
      anticipoInput.readOnly = true;
      anticipoInput.setAttribute('readonly', 'true');

      if (preventaHelperText) {
        preventaHelperText.innerHTML = `Precio de lista: <strong class="text-slate-300">$${precio.toFixed(2)}</strong> • Anticipo 50% requerido: <strong class="text-emerald-400 font-bold">$${montoAnticipo.toFixed(2)}</strong>`;
      }

      if (releaseInfoEl && releaseValEl) {
        const relDate = prod?.releaseDate || '';
        if (relDate) {
          releaseValEl.innerHTML = `${formatDisplayDate(relDate)} &nbsp; ${getReleaseStatusBadge(relDate)}`;
          releaseInfoEl.classList.remove('hidden');
          releaseInfoEl.classList.add('flex');
        } else {
          releaseInfoEl.classList.add('hidden');
          releaseInfoEl.classList.remove('flex');
        }
      }
    });
  }

  // FASE A: REGISTRO Y COBRO DEL ANTICIPO (DÍA DEL APARTADO)
  // Al presionar "Registrar Preventa":
  // 1. NO guarda directo en BD como pendiente.
  // 2. Carga automáticamente al carrito: cliente, producto con "Concepto: Anticipo Preventa (50%)", total a cobrar = 50%.
  // 3. El cajero procesa el pago y al presionar "COMPLETAR VENTA", se guarda en BD como PENDIENTE.
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientSelect = document.getElementById('preventa-client-select');
      const prodId = productSelect.value;
      const idCliente = clientSelect.value;

      if (!idCliente) {
        showToast('Selecciona o registra un cliente para la reserva', 'warning');
        return;
      }
      if (!prodId) {
        showToast('Selecciona un producto para la preventa', 'warning');
        return;
      }

      // Parsea el ID usando Number(idProducto) o String(idProducto) para asegurar coincidencia exacta con el catálogo
      const idProductoNum = Number(prodId);
      const idProductoStr = String(prodId);
      let prod = CATALOG.find(p => 
        p.id === idProductoNum || 
        p.id === idProductoStr || 
        String(p.id) === idProductoStr || 
        (!isNaN(p.id) && !isNaN(idProductoNum) && Number(p.id) === idProductoNum)
      );

      if (!prod) {
        showToast('Producto no encontrado en catálogo', 'error');
        return;
      }

      // 3. FILTRADO DE PREVENTAS ACTIVAS POR CLIENTE:
      // Solo restringir si existe una preventa cuyo estado sea estrictamente 'PENDIENTE'. Si está 'COMPLETADA' o 'CANCELADA', permitir sin restricción.
      const todasPreventas = await apiGetPreventas();
      const preventaPendienteMismoProducto = todasPreventas.find(p => {
        const idCliCoincide = (p.idCliente === idCliente || String(p.idCliente) === String(idCliente) || (!isNaN(p.idCliente) && !isNaN(idCliente) && Number(p.idCliente) === Number(idCliente)));
        const idProdCoincide = (p.idProducto === prod.id || String(p.idProducto) === String(prod.id) || (!isNaN(p.idProducto) && !isNaN(prod.id) && Number(p.idProducto) === Number(prod.id)));
        const estadoUpper = String(p.estado || '').toUpperCase();
        return idCliCoincide && idProdCoincide && estadoUpper === 'PENDIENTE';
      });

      if (preventaPendienteMismoProducto) {
        showToast(`El cliente ya cuenta con una preventa activa (PENDIENTE) para "${prod.name || prod.nombre}".`, 'warning');
        return;
      }

      const clients = await apiGetClientes();
      const selectedClient = clients.find(c => 
        c.id === idCliente || 
        String(c.id) === String(idCliente) || 
        (!isNaN(c.id) && !isNaN(idCliente) && Number(c.id) === Number(idCliente))
      );
      const prodPrice = parseFloat(prod.precio !== undefined ? prod.precio : prod.price) || 0;
      const anticipoMonto = Math.round(prodPrice * 0.50 * 100) / 100;

      // 1. Guardar en memoria la preventa pendiente de cobro
      pendingPreventaOrder = {
        idCliente,
        clientName: selectedClient ? (selectedClient.name || selectedClient.nombre) : 'Cliente',
        clientPhone: selectedClient ? (selectedClient.phone || selectedClient.telefono) : '',
        idProducto: prod.id,
        productName: prod.name || prod.nombre,
        productPrice: prodPrice,
        montoAnticipo: anticipoMonto,
        releaseDate: prod.releaseDate || '',
        date: new Date().toISOString().split('T')[0]
      };

      // 2. Asignar el cliente seleccionado a la venta activa
      if (selectedClient) {
        establecerClienteActual(selectedClient);
      }

      // 3. Cargar al carrito como concepto de anticipo del 50%
      activePreventaCredit = 0;
      linkedPreventaId = null;

      cart = [
        {
          id: 'prev_dep_' + prod.id,
          originalProductId: prod.id,
          name: prod.name || prod.nombre,
          category: prod.category || 'games',
          platform: prod.platform || 'General',
          sku: prod.sku || prod.codigo || ('SKU-' + prod.id),
          price: anticipoMonto, // 50% exacto del valor del juego
          fullPrice: prodPrice,
          qty: 1,
          isPreventaDeposit: true,
          releaseDate: prod.releaseDate || '',
          badge: 'Concepto: Anticipo Preventa (50%)'
        }
      ];

      closePreventasModal();
      renderCart();

      showToast(`¡Preventa cargada a caja! Procesa el cobro del anticipo ($${anticipoMonto.toFixed(2)}) para formalizar el apartado.`, 'info');
    });
  }
}

// Remover manualmente el anticipo de preventa de los totales sin limpiar todo el carrito
function removePreventaCredit() {
  activePreventaCredit = 0;
  linkedPreventaId = null;
  // Quitar marcas de liquidación en el carrito
  cart.forEach(i => {
    if (i.isPreventaLiquidation) delete i.isPreventaLiquidation;
  });
  renderCart();
  calculateTotals();
  showToast('Anticipo de preventa removido de la orden', 'info');
}

async function openPreventasModal() {
  const modal = document.getElementById('preventas-modal');
  if (!modal) return;

  await populatePreventasClients();
  await populatePreventasProducts();
  updatePreventasBadgeCount();
  setPreventasTab('new');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePreventasModal() {
  const modal = document.getElementById('preventas-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function setPreventasTab(tab) {
  const viewNew = document.getElementById('view-preventas-new');
  const viewList = document.getElementById('view-preventas-list');
  const btnNew = document.getElementById('tab-preventas-new');
  const btnList = document.getElementById('tab-preventas-list');

  if (tab === 'new') {
    if (viewNew) viewNew.classList.remove('hidden');
    if (viewList) viewList.classList.add('hidden');
    if (btnNew) {
      btnNew.className = 'flex-1 py-2 px-3 rounded-lg font-bold transition-all bg-purple-600 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer';
    }
    if (btnList) {
      btnList.className = 'flex-1 py-2 px-3 rounded-lg font-bold transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer';
    }
  } else {
    if (viewNew) viewNew.classList.add('hidden');
    if (viewList) viewList.classList.remove('hidden');
    if (btnList) {
      btnList.className = 'flex-1 py-2 px-3 rounded-lg font-bold transition-all bg-purple-600 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer';
    }
    if (btnNew) {
      btnNew.className = 'flex-1 py-2 px-3 rounded-lg font-bold transition-all text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer';
    }
    renderPreventasList();
  }
}

async function populatePreventasClients() {
  const select = document.getElementById('preventa-client-select');
  if (!select) return;

  const currentVal = select.value;
  const clients = await apiGetClientes();

  select.innerHTML = `
    <option value="">-- Selecciona un Cliente Registrado --</option>
    ${clients.map(c => `
      <option value="${c.id}">${c.name} (${c.phone || 'Sin tel.'})</option>
    `).join('')}
  `;

  if (currentVal && clients.some(c => c.id === currentVal)) {
    select.value = currentVal;
  }
}

async function populatePreventasProducts() {
  const select = document.getElementById('preventa-product-select');
  const anticipoInput = document.getElementById('preventa-anticipo-input');
  const helperText = document.getElementById('preventa-helper-text');
  const releaseInfoEl = document.getElementById('preventa-release-date-info');
  if (!select) return;

  const products = await apiGetProductos();
  select.innerHTML = `
    <option value="">-- Selecciona un Producto o Videojuego --</option>
    ${products.map(p => `
      <option value="${p.id}" data-price="${p.price}">[${p.platform}] ${p.name} - $${p.price.toFixed(2)}${p.releaseDate ? ` (Estreno: ${formatDisplayDate(p.releaseDate)})` : ''}</option>
    `).join('')}
  `;

  if (anticipoInput) anticipoInput.value = '';
  if (helperText) helperText.textContent = 'Selecciona un producto para calcular automáticamente el 50% de anticipo.';
  if (releaseInfoEl) {
    releaseInfoEl.classList.add('hidden');
    releaseInfoEl.classList.remove('flex');
  }
}

async function updatePreventasBadgeCount() {
  const badge = document.getElementById('badge-preventas-count');
  if (!badge) return;
  const preventas = await apiGetPreventas();
  badge.textContent = preventas.length;
}

async function renderPreventasList() {
  const tbody = document.getElementById('preventas-table-body');
  if (!tbody) return;

  const preventas = await apiGetPreventas();
  updatePreventasBadgeCount();

  if (preventas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-8 text-center text-slate-500 font-mono text-xs">
          No hay reservas ni apartados registrados actualmente.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = preventas.map(p => {
    const anticipo = parseFloat(p.anticipoPagado !== undefined ? p.anticipoPagado : (p.montoAnticipo || 0));
    const saldo = parseFloat(p.saldoPendiente !== undefined ? p.saldoPendiente : (p.saldoRestante || 0));
    const isPendiente = p.estado === 'PENDIENTE';

    return `
      <tr class="hover:bg-slate-900/50 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">${p.folio || `PREV-${p.id}`}</td>
        <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${p.date || '2026-10-11'}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-200 font-sans">${p.clientName || 'Cliente'}</div>
          <div class="text-[10px] text-slate-500 font-mono">${p.clientPhone || ''}</div>
        </td>
        <td class="py-2.5 px-3 text-slate-300 font-sans">
          <div class="font-medium">${p.productName || p.idProducto}</div>
          ${p.montoTotal ? `<div class="text-[10px] text-slate-500 font-mono">Total: $${p.montoTotal.toFixed(2)}</div>` : ''}
        </td>

        <!-- Columnas financieras: Anticipo Pagado y Saldo Restante -->
        <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">$${anticipo.toFixed(2)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400">$${saldo.toFixed(2)}</td>
        
        <td class="py-2.5 px-3 text-center">
          ${isPendiente 
            ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">PENDIENTE</span>`
            : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">LIQUIDADA</span>`
          }
        </td>
        <td class="py-2.5 px-3 text-right">
          ${isPendiente
            ? `<button 
                type="button" 
                onclick="liquidarEnCaja('${p.id}')"
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
                title="Cobrar la segunda mitad ($${saldo.toFixed(2)}) al entregar el juego"
              >
                <i class="fa-solid fa-bolt text-[10px]"></i>
                <span>Liquidar en Caja</span>
              </button>`
            : `<span class="text-[10px] text-slate-500 font-mono italic">Liquidada</span>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

// FASE B: LIQUIDACIÓN Y ENTREGA (DÍA DEL LANZAMIENTO)
// Al presionar "Liquidar en Caja" sobre una preventa existente:
// 1. Carga producto al carrito a su precio total (100%).
// 2. Asigna cliente correspondiente.
// 3. Aplica renglón "Anticipo Preventa: -50%" descontando lo que ya pagó.
// 4. Total a cobrar será el 50% restante (saldo pendiente).
// 5. Al presionar COMPLETAR VENTA, se liquida y pasa a LIQUIDADA.
window.cargarPreventaACaja = async function(preventaId) {
  const preventas = await apiGetPreventas();
  const p = preventas.find(item => item.id === preventaId || String(item.id) === String(preventaId));
  if (!p) return;

  if (p.estado === 'COMPLETADO' || p.estado === 'LIQUIDADA') {
    showToast('Esta preventa ya ha sido liquidada anteriormente', 'warning');
    return;
  }

  // 1. Buscar producto en catálogo a precio total (100%)
  // Parsea el ID usando Number(idProducto) o String(idProducto) para asegurar coincidencia exacta con el catálogo
  const idProductoNum = Number(p.idProducto);
  const idProductoStr = String(p.idProducto);
  let prod = CATALOG.find(item => 
    item.id === idProductoNum || 
    item.id === idProductoStr || 
    String(item.id) === idProductoStr || 
    (!isNaN(item.id) && !isNaN(idProductoNum) && Number(item.id) === idProductoNum)
  );

  if (!prod) {
    prod = {
      id: !isNaN(idProductoNum) && idProductoStr !== '' ? idProductoNum : idProductoStr,
      name: p.productName || 'Producto en Preventa',
      category: 'games',
      platform: 'Preventa',
      sku: 'PREV-' + p.id,
      price: parseFloat(p.productPrice || p.montoTotal) || (parseFloat(p.montoAnticipo) * 2),
      stock: 5
    };
  }

  const prodPrice = parseFloat(prod.precio !== undefined ? prod.precio : prod.price) || 0;

  // 2. Cargar producto al carrito a su precio total (100%)
  cart = [
    {
      id: prod.id,
      name: prod.name || prod.nombre,
      category: prod.category || 'games',
      platform: prod.platform || 'General',
      sku: prod.sku || prod.codigo || ('SKU-' + prod.id),
      price: prodPrice, // 100% Precio total de lista
      qty: 1,
      isPreventaLiquidation: true,
      preventaId: p.id,
      badge: 'Entrega / Liquidación'
    }
  ];

  // 3. Aplicar renglón de anticipo abonado (-50%)
  activePreventaCredit = parseFloat(p.anticipoPagado !== undefined ? p.anticipoPagado : p.montoAnticipo) || (prodPrice * 0.50);
  linkedPreventaId = p.id;
  pendingPreventaOrder = null;

  // 4. Asignar cliente correspondiente
  const clients = await apiGetClientes();
  const associatedClient = clients.find(c => 
    c.id === p.idCliente || 
    String(c.id) === String(p.idCliente) || 
    (!isNaN(c.id) && !isNaN(p.idCliente) && Number(c.id) === Number(p.idCliente))
  );
  if (associatedClient) {
    establecerClienteActual(associatedClient);
  }

  // 5. Renderizar y cerrar modal
  renderCart();
  closePreventasModal();

  const restante = Math.max(0, prodPrice - activePreventaCredit);
  showToast(`¡Preventa ${p.folio || `#${p.id}`} cargada! Anticipo: -$${activePreventaCredit.toFixed(2)}. Saldo restante: $${restante.toFixed(2)}`, 'success');
};

window.liquidarEnCaja = window.cargarPreventaACaja;

// ========================================================
// 4. CORTE DE CAJA / ARQUEO DE TURNO (GET /api/caja/resumen-hoy & POST /api/caja/cierre)
// ========================================================

function getCurrentCorteSnapshot() {
  const realInput = document.getElementById('corte-efectivo-real');
  const realVal = realInput && realInput.value.trim() !== '' ? parseFloat(realInput.value) || 0 : (currentCorteResumen?.efectivoEsperado || 0);
  const esperado = currentCorteResumen ? currentCorteResumen.efectivoEsperado : 0;
  const dif = Math.round((realVal - esperado) * 100) / 100;
  
  let estadoArqueo = 'CAJA CUADRADA';
  if (dif < 0) estadoArqueo = `FALTANTE (-$${Math.abs(dif).toFixed(2)})`;
  else if (dif > 0) estadoArqueo = `SOBRANTE (+$${dif.toFixed(2)})`;

  const activeUserJson = localStorage.getItem('gamevault_active_user');
  let adminName = 'Daniela Blanco';
  if (activeUserJson) {
    try {
      const u = JSON.parse(activeUserJson);
      if (u.fullname) adminName = u.fullname.replace(/\s*\(\s*admin vault\s*\)/i, '').trim();
    } catch (e) {}
  }

  const notas = document.getElementById('corte-notas')?.value.trim() || '';

  return {
    id: 'corte_' + Date.now(),
    fecha: new Date().toISOString(),
    fechaFormateada: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
    responsable: adminName,
    responsableRol: 'ADMINISTRADOR',
    ticketsCount: currentCorteResumen?.ticketsCount || ticketCounter,
    fondoInicial: currentCorteResumen?.fondoInicial || 500.00,
    ventasEfectivo: currentCorteResumen?.ventasEfectivo || 0,
    ventasTarjeta: currentCorteResumen?.ventasTarjeta || 0,
    ventasTransferencia: currentCorteResumen?.ventasTransferencia || 0,
    totalAnticiposPreventa: currentCorteResumen?.totalAnticiposPreventa || 0,
    anticiposEfectivo: currentCorteResumen?.anticiposEfectivo || 0,
    totalCobrado: currentCorteResumen?.totalCobrado || 0,
    efectivoEsperado: esperado,
    efectivoReal: realVal,
    diferencia: dif,
    estadoArqueo: estadoArqueo,
    notas: notas
  };
}

function generateCorteTextReport(corte) {
  const line = '============================================================';
  const sep =  '------------------------------------------------------------';
  return `${line}
                 GAMEVAULT RETAIL SYSTEM
              CORTE DE CAJA / ARQUEO DE TURNO
${line}
Fecha y Hora:       ${corte.fechaFormateada || new Date().toLocaleString('es-MX')}
Responsable Admin:  ${corte.responsable || 'Daniela Blanco'} (${corte.responsableRol || 'ADMINISTRADOR'})
Terminal:           POS 01 - Caja Principal Retail
Tickets Emitidos:   ${corte.ticketsCount || ticketCounter} ventas
${sep}
RESUMEN DE INGRESOS DEL DÍA (GET /api/caja/resumen-hoy):
- Fondo Inicial de Caja:                  $ ${Number(corte.fondoInicial || 0).toFixed(2).padStart(10)}
- Ventas Totales en Efectivo:             $ ${Number(corte.ventasEfectivo || 0).toFixed(2).padStart(10)}
- Ventas Totales en Tarjeta:              $ ${Number(corte.ventasTarjeta || 0).toFixed(2).padStart(10)}
- Ventas Totales por Transferencia:       $ ${Number(corte.ventasTransferencia || 0).toFixed(2).padStart(10)}
- Total Recaudado por Anticipos Preventa: $ ${Number(corte.totalAnticiposPreventa || 0).toFixed(2).padStart(10)}
  (Anticipos pagados en efectivo:         $ ${Number(corte.anticiposEfectivo || 0).toFixed(2).padStart(10)})
${sep}
TOTAL GENERAL COBRADO:                    $ ${Number(corte.totalCobrado || 0).toFixed(2).padStart(10)}
${sep}
REGISTRO DE ARQUEO FÍSICO DE CAJÓN:
- Efectivo Esperado en Caja:              $ ${Number(corte.efectivoEsperado || 0).toFixed(2).padStart(10)}
  (= Fondo Inicial + Ventas Efectivo)
- Efectivo Real en Cajón:                 $ ${Number(corte.efectivoReal || 0).toFixed(2).padStart(10)}
- Diferencia de Caja:                     $ ${Number(corte.diferencia || 0).toFixed(2).padStart(10)}
- Estado del Arqueo:                      ${corte.estadoArqueo}
${sep}
Observaciones de Cierre:
${corte.notas || 'Sin incidencias reportadas en el cierre de turno.'}
${line}

Firma del Administrador: _______________________________
${line}`;
}

function downloadCorteReport(corte) {
  const data = corte || lastCorteCierreSaved || getCurrentCorteSnapshot();
  const text = generateCorteTextReport(data);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `GameVault_Corte_Caja_${d}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function printCorteReport() {
  document.body.classList.add('printing-corte');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-corte');
  }, 1000);
}

function updateArqueoDiferencia() {
  const realInput = document.getElementById('corte-efectivo-real');
  const badgeEl = document.getElementById('corte-arqueo-badge');
  const diffValEl = document.getElementById('corte-diferencia-val');
  if (!realInput) return;

  const esperado = currentCorteResumen ? currentCorteResumen.efectivoEsperado : 0;
  const rawVal = realInput.value.trim();

  if (rawVal === '') {
    if (badgeEl) {
      badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5';
      badgeEl.innerHTML = `<span class="flex items-center gap-1.5"><i class="fa-regular fa-clock text-xs"></i> Ingrese el conteo en cajón</span>`;
    }
    if (diffValEl) {
      diffValEl.textContent = '$0.00';
      diffValEl.className = 'font-mono font-bold text-sm text-slate-400';
    }
    return;
  }

  const realVal = parseFloat(rawVal) || 0;
  const dif = Math.round((realVal - esperado) * 100) / 100;

  if (dif === 0) {
    if (badgeEl) {
      badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-1.5';
      badgeEl.innerHTML = `<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Caja Cuadrada</span>`;
    }
    if (diffValEl) {
      diffValEl.textContent = '$0.00';
      diffValEl.className = 'font-mono font-bold text-sm text-emerald-400';
    }
  } else if (dif < 0) {
    const formatted = Math.abs(dif).toFixed(2);
    if (badgeEl) {
      badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-rose-950/90 border border-rose-500/70 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)] flex items-center gap-1.5';
      badgeEl.innerHTML = `<svg class="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> <span>Faltante: -$${formatted}</span>`;
    }
    if (diffValEl) {
      diffValEl.textContent = `-$${formatted}`;
      diffValEl.className = 'font-mono font-bold text-sm text-rose-400';
    }
  } else {
    const formatted = dif.toFixed(2);
    if (badgeEl) {
      badgeEl.className = 'px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-950/90 border border-emerald-500/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-1.5';
      badgeEl.innerHTML = `<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> <span>Sobrante: +$${formatted}</span>`;
    }
    if (diffValEl) {
      diffValEl.textContent = `+$${formatted}`;
      diffValEl.className = 'font-mono font-bold text-sm text-emerald-400';
    }
  }
}

async function openCorteCajaModal() {
  if (!isCurrentUserAdmin()) {
    showToast('Acceso Restringido: El Corte de Caja solo está permitido para usuarios con rol de Administrador.', 'error');
    return;
  }

  const corteModal = document.getElementById('corte-caja-modal');
  if (!corteModal) return;

  // Realizar petición GET /api/caja/resumen-hoy
  const data = await apiGetCajaResumenHoy();
  currentCorteResumen = data;

  const activeUserJson = localStorage.getItem('gamevault_active_user');
  let uName = 'Daniela Blanco';
  if (activeUserJson) {
    try {
      const u = JSON.parse(activeUserJson);
      if (u.fullname) uName = u.fullname.replace(/\s*\(\s*admin vault\s*\)/i, '').trim();
    } catch (e) {}
  }

  // Poblar datos del modal
  const adminNameEl = document.getElementById('corte-admin-name');
  if (adminNameEl) adminNameEl.textContent = uName;

  const timestampEl = document.getElementById('corte-timestamp');
  if (timestampEl) timestampEl.textContent = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

  const ticketCountEl = document.getElementById('corte-ticket-count');
  if (ticketCountEl) ticketCountEl.textContent = `${data.ticketsCount || ticketCounter} ventas emitidas`;

  // 1. Fondo inicial de caja
  const fondoInicial = Number(data.fondoInicial !== undefined ? data.fondoInicial : 500);
  const fondoEl = document.getElementById('corte-fondo-inicial');
  if (fondoEl) fondoEl.textContent = `$${fondoInicial.toFixed(2)}`;

  // 2. Ventas Totales en Efectivo
  const ventasEfectivo = Number(data.ventasEfectivo || 0);
  const cashSalesEl = document.getElementById('corte-cash-sales');
  if (cashSalesEl) cashSalesEl.textContent = `$${ventasEfectivo.toFixed(2)}`;

  // 3. Ventas Totales en Tarjeta
  const ventasTarjeta = Number(data.ventasTarjeta || 0);
  const cardSalesEl = document.getElementById('corte-card-sales');
  if (cardSalesEl) cardSalesEl.textContent = `$${ventasTarjeta.toFixed(2)}`;

  // 4. Ventas Totales por Transferencia
  const ventasTransferencia = Number(data.ventasTransferencia || 0);
  const transferSalesEl = document.getElementById('corte-transfer-sales');
  if (transferSalesEl) transferSalesEl.textContent = `$${ventasTransferencia.toFixed(2)}`;

  // 5. Total Recaudado por Anticipos de Preventa
  const totalAnticipos = Number(data.totalAnticipos !== undefined ? data.totalAnticipos : (data.totalAnticiposPreventa || 0));
  const anticiposSalesEl = document.getElementById('corte-anticipos-sales');
  if (anticiposSalesEl) anticiposSalesEl.textContent = `$${totalAnticipos.toFixed(2)}`;

  const anticiposNoteEl = document.getElementById('corte-anticipos-cash-note');
  if (anticiposNoteEl) anticiposNoteEl.textContent = `Anticipos en efectivo: $${Number(data.anticiposEfectivo || 0).toFixed(2)}`;

  // 6. Total General Cobrado = (X + Y + Z)
  const totalCobrado = Number(data.totalCobrado !== undefined ? data.totalCobrado : Math.round((ventasEfectivo + ventasTarjeta + ventasTransferencia) * 100) / 100);
  const totalCobradoEl = document.getElementById('corte-total-cobrado');
  if (totalCobradoEl) totalCobradoEl.textContent = `$${totalCobrado.toFixed(2)}`;

  // 7. Efectivo Esperado en Cajón = ÚNICAMENTE (Fondo Inicial + Ventas en Efectivo)
  // Nota: No debe sumar tarjeta ni transferencia al efectivo en cajón para evitar faltantes falsos.
  const efectivoEsperado = Math.round((fondoInicial + ventasEfectivo) * 100) / 100;
  data.efectivoEsperado = efectivoEsperado;
  if (currentCorteResumen) currentCorteResumen.efectivoEsperado = efectivoEsperado;

  const efectivoEsperadoEl = document.getElementById('corte-efectivo-esperado');
  if (efectivoEsperadoEl) efectivoEsperadoEl.textContent = `$${efectivoEsperado.toFixed(2)}`;

  // Reset del registro de arqueo
  const realInput = document.getElementById('corte-efectivo-real');
  if (realInput) realInput.value = '';

  const notasInput = document.getElementById('corte-notas');
  if (notasInput) notasInput.value = '';

  const banner = document.getElementById('corte-success-banner');
  if (banner) banner.classList.add('hidden');

  const btnConfirm = document.getElementById('btn-confirm-corte');
  if (btnConfirm) {
    btnConfirm.disabled = false;
    btnConfirm.classList.remove('opacity-60', 'cursor-not-allowed');
    btnConfirm.innerHTML = `
      <svg class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span>Cerrar Turno y Guardar</span>
    `;
  }

  updateArqueoDiferencia();

  corteModal.classList.remove('hidden');
  corteModal.classList.add('flex');
  setTimeout(() => realInput?.focus(), 100);
}

function setupCorteCajaModule() {
  const corteModal = document.getElementById('corte-caja-modal');
  const btnCloseCorte = document.getElementById('btn-close-corte');
  const btnAutoCuadrar = document.getElementById('btn-corte-auto-cuadrar');
  const realInput = document.getElementById('corte-efectivo-real');
  const btnConfirmCorte = document.getElementById('btn-confirm-corte');
  const btnPrintCorte = document.getElementById('btn-print-corte');
  const btnDownloadCorte = document.getElementById('btn-download-corte');

  if (btnCloseCorte && corteModal) {
    btnCloseCorte.addEventListener('click', () => {
      corteModal.classList.add('hidden');
      corteModal.classList.remove('flex');
    });
  }

  if (btnAutoCuadrar && realInput) {
    btnAutoCuadrar.addEventListener('click', () => {
      if (currentCorteResumen) {
        realInput.value = Number(currentCorteResumen.efectivoEsperado).toFixed(2);
        updateArqueoDiferencia();
        showToast(`Monto esperado ($${Number(currentCorteResumen.efectivoEsperado).toFixed(2)}) copiado al cajón real`, 'info');
      }
    });
  }

  if (realInput) {
    realInput.addEventListener('input', updateArqueoDiferencia);
    realInput.addEventListener('keyup', updateArqueoDiferencia);
    realInput.addEventListener('change', updateArqueoDiferencia);
  }

  // Botón "Cerrar Turno y Guardar Corte": Envía POST /api/caja/cierre y genera resumen imprimible/descargable
  if (btnConfirmCorte) {
    btnConfirmCorte.addEventListener('click', async () => {
      if (!isCurrentUserAdmin()) {
        showToast('Acceso Denegado: Solo administradores pueden cerrar el turno.', 'error');
        return;
      }

      const valStr = realInput ? realInput.value.trim() : '';
      if (!valStr) {
        showToast('Por favor captura el "Efectivo Real en Cajón" para realizar el arqueo.', 'warning');
        realInput?.focus();
        return;
      }

      const realVal = parseFloat(valStr);
      if (isNaN(realVal) || realVal < 0) {
        showToast('Ingresa un monto numérico válido en efectivo real.', 'error');
        realInput?.focus();
        return;
      }

      if (!currentCorteResumen) {
        currentCorteResumen = await apiGetCajaResumenHoy();
      }

      const dif = Math.round((realVal - currentCorteResumen.efectivoEsperado) * 100) / 100;
      let estadoArqueo = 'CAJA CUADRADA';
      if (dif < 0) estadoArqueo = `FALTANTE (-$${Math.abs(dif).toFixed(2)})`;
      else if (dif > 0) estadoArqueo = `SOBRANTE (+$${dif.toFixed(2)})`;

      const activeUserJson = localStorage.getItem('gamevault_active_user');
      let adminName = 'Daniela Blanco';
      let adminId = 1;
      if (activeUserJson) {
        try {
          const u = JSON.parse(activeUserJson);
          if (u.fullname) adminName = u.fullname.replace(/\s*\(\s*admin vault\s*\)/i, '').trim();
          if (u.id && !isNaN(parseInt(u.id))) adminId = parseInt(u.id);
        } catch (e) {}
      }

      const notas = document.getElementById('corte-notas')?.value.trim() || '';

      const cierreData = {
        id: 'corte_' + Date.now(),
        fecha: new Date().toISOString(),
        fechaFormateada: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
        responsable: adminName,
        responsableRol: 'ADMINISTRADOR',
        usuarioId: adminId,
        idUsuario: adminId,
        ticketsCount: currentCorteResumen.ticketsCount || ticketCounter,
        fondoInicial: currentCorteResumen.fondoInicial,
        ventasEfectivo: currentCorteResumen.ventasEfectivo,
        ventasTarjeta: currentCorteResumen.ventasTarjeta,
        ventasTransferencia: currentCorteResumen.ventasTransferencia,
        totalEfectivo: currentCorteResumen.ventasEfectivo,
        totalTarjeta: currentCorteResumen.ventasTarjeta,
        totalTransferencia: currentCorteResumen.ventasTransferencia,
        totalAnticiposPreventa: currentCorteResumen.totalAnticiposPreventa,
        anticiposEfectivo: currentCorteResumen.anticiposEfectivo,
        totalCobrado: currentCorteResumen.totalCobrado,
        efectivoEsperado: currentCorteResumen.efectivoEsperado,
        efectivoReal: realVal,
        diferencia: dif,
        estadoArqueo: estadoArqueo,
        notas: notas
      };

      btnConfirmCorte.disabled = true;
      btnConfirmCorte.classList.add('opacity-60', 'cursor-not-allowed');
      btnConfirmCorte.innerHTML = `<span>Procesando Cierre...</span>`;

      // a) Registra el arqueo final en la base de datos
      await apiPostCajaCierre(cierreData);
      lastCorteCierreSaved = cierreData;

      // b) Limpia el carrito de ventas activo
      cart = [];
      activePreventaCredit = 0;
      linkedPreventaId = null;
      pendingPreventaOrder = null;
      currentDiscount = 0;
      establecerClienteActual({ id: 'publico', name: 'Público General', isGeneral: true });
      renderCart();
      calculateTotals();

      // c) Reinicia los contadores visuales de ventas totales, tarjetas, transferencias y efectivo acumulado del día a $0.00
      const cashSalesEl = document.getElementById('corte-cash-sales');
      const cardSalesEl = document.getElementById('corte-card-sales');
      const transferSalesEl = document.getElementById('corte-transfer-sales');
      const anticiposSalesEl = document.getElementById('corte-anticipos-sales');
      const anticiposNoteEl = document.getElementById('corte-anticipos-cash-note');
      const totalCobradoEl = document.getElementById('corte-total-cobrado');
      const ticketCountEl = document.getElementById('corte-ticket-count');

      if (cashSalesEl) cashSalesEl.textContent = '$0.00';
      if (cardSalesEl) cardSalesEl.textContent = '$0.00';
      if (transferSalesEl) transferSalesEl.textContent = '$0.00';
      if (anticiposSalesEl) anticiposSalesEl.textContent = '$0.00';
      if (anticiposNoteEl) anticiposNoteEl.textContent = 'Anticipos en efectivo: $0.00';
      if (totalCobradoEl) totalCobradoEl.textContent = '$0.00';
      if (ticketCountEl) ticketCountEl.textContent = '0 ventas emitidas';

      // d) Inicia la nueva jornada con el Fondo Inicial base de $500.00 MXN
      localStorage.setItem('gamevault_fondo_inicial', '500.00');
      localStorage.setItem('gamevault_last_corte_timestamp', Date.now().toString());
      localStorage.setItem('gamevault_last_corte_date', new Date().toISOString().split('T')[0]);

      const fondoEl = document.getElementById('corte-fondo-inicial');
      if (fondoEl) fondoEl.textContent = '$500.00';

      const efectivoEsperadoEl = document.getElementById('corte-efectivo-esperado');
      if (efectivoEsperadoEl) efectivoEsperadoEl.textContent = '$500.00';

      currentCorteResumen = {
        fecha: new Date().toISOString().split('T')[0],
        fechaFormateada: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
        ticketsCount: 0,
        fondoInicial: 500.00,
        ventasEfectivo: 0.00,
        ventasTarjeta: 0.00,
        ventasTransferencia: 0.00,
        totalAnticiposPreventa: 0.00,
        anticiposEfectivo: 0.00,
        totalCobrado: 0.00,
        efectivoEsperado: 500.00
      };

      // Reiniciar el consecutivo de ticket para la nueva jornada a #GV-0001
      updateTicketBadge();

      // Limpiar campos de arqueo en el modal
      if (realInput) realInput.value = '';
      const notasInput = document.getElementById('corte-notas');
      if (notasInput) notasInput.value = '';
      updateArqueoDiferencia();

      btnConfirmCorte.innerHTML = `<span class="flex items-center justify-center gap-1.5"><i class="fa-solid fa-check"></i> Turno Cerrado</span>`;
      const banner = document.getElementById('corte-success-banner');
      if (banner) banner.classList.remove('hidden');

      showToast(`¡Turno cerrado y arqueo guardado! (${estadoArqueo})`, 'success');

      // Descarga automática del reporte contable (.txt)
      downloadCorteReport(cierreData);
    });
  }

  if (btnDownloadCorte) {
    btnDownloadCorte.addEventListener('click', () => {
      const report = lastCorteCierreSaved || getCurrentCorteSnapshot();
      downloadCorteReport(report);
      showToast('Descargando reporte de corte de caja (.txt)...', 'info');
    });
  }

  if (btnPrintCorte) {
    btnPrintCorte.addEventListener('click', () => {
      printCorteReport();
    });
  }
}

// ========================================================
// CATÁLOGO Y CARRITO CORE POS
// ========================================================

// Renderizar el catálogo de artículos disponibles a la izquierda
function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  const emptyNotice = document.getElementById('catalog-empty-notice');
  const countBadge = document.getElementById('catalog-count-badge');
  if (!grid) return;

  const filtered = CATALOG.filter(item => {
    let matchesCat = false;
    if (selectedCategory === 'all') {
      matchesCat = true;
    } else if (selectedCategory === 'preventa') {
      matchesCat = item.category === 'preventa' || item.isPreventa || item.status === 'preventa';
    } else if (selectedCategory === 'pines') {
      matchesCat = item.category === 'pines' || item.isPin || item.type === 'PIN';
    } else {
      matchesCat = item.category === selectedCategory;
    }

    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery) ||
      item.sku.toLowerCase().includes(searchQuery) ||
      item.platform.toLowerCase().includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  if (countBadge) {
    countBadge.textContent = `Mostrando: ${filtered.length} artículos`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyNotice) {
      emptyNotice.classList.remove('hidden');
      emptyNotice.classList.add('flex');
    }
    return;
  }

  if (emptyNotice) {
    emptyNotice.classList.add('hidden');
    emptyNotice.classList.remove('flex');
  }

  grid.innerHTML = filtered.map(item => {
    const isPrev = item.isPreventa || item.status === 'preventa' || item.category === 'preventa';
    const isPin = item.category === 'pines' || item.isPin || item.type === 'PIN';
    const formattedReleaseDate = formatDisplayDate(item.releaseDate);
    const isOutOfStock = isPin && item.stock <= 0;

    return `
      <div 
        onclick="${isOutOfStock ? '' : `addItemToCart('${item.id}')`}"
        class="p-3.5 rounded-2xl bg-slate-900/70 border ${isPin ? 'border-emerald-500/30 hover:border-emerald-400' : 'border-slate-800 hover:border-cyan-500/50'} hover:bg-slate-900/90 transition-all duration-200 ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} group flex flex-col justify-between relative overflow-hidden select-none hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:scale-[1.01]"
        title="${isOutOfStock ? 'PIN digital agotado' : 'Clic para agregar a la venta'}"
      >
        <div class="space-y-2">
          <!-- Top row: Platform & Stock -->
          <div class="flex items-center justify-between text-[10px] font-mono">
            <span class="px-2 py-0.5 rounded-md ${isPin ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'} border font-semibold uppercase">
              ${item.platform}
            </span>
            <span class="text-slate-400">
              Stock: <strong class="${item.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}">${isPin ? `${item.stock} códigos` : `${item.stock} uds`}</strong>
            </span>
          </div>

          <!-- Product preview & details -->
          <div class="flex items-center gap-3 pt-1">
            <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              ${getCategoryIcon(item.category, 'w-6 h-6')}
            </div>
            <div class="overflow-hidden flex-1">
              <h4 class="font-bold text-xs sm:text-sm text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                ${item.name}
              </h4>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] font-mono text-slate-500 tracking-wider">SKU: ${item.sku}</span>
              </div>

              <!-- Etiqueta visible de Saldo o Tiempo para Pines Digitales -->
              ${isPin ? `
                <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    <i class="fa-solid fa-credit-card text-[10px] text-emerald-400"></i>
                    Saldo / Tiempo: ${item.montoSaldo}
                  </span>
                  <span class="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                    <i class="fa-solid fa-bolt text-[10px]"></i> PIN Digital
                  </span>
                </div>
              ` : ''}

              <!-- Etiqueta visible con la fecha de llegada para productos en Preventa -->
              ${(isPrev || item.releaseDate) ? `
                <div class="mt-1.5">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    <i class="fa-regular fa-calendar text-[10px] text-purple-400"></i>
                    Estreno: ${formattedReleaseDate || 'Próximamente'}
                  </span>
                </div>
              ` : ''}

            </div>
          </div>
        </div>

        <!-- Price & Quick Add Button -->
        <div class="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80">
          <span class="font-mono font-bold text-sm sm:text-base text-cyan-400">
            $${item.price.toFixed(2)}
          </span>
          ${isOutOfStock ? `
            <button 
              type="button" 
              disabled
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed flex items-center gap-1"
            >
              Agotado
            </button>
          ` : `
            <button 
              type="button" 
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 group-hover:bg-cyan-400 group-hover:text-slate-950 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>Agregar</span>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar el carrito de venta a la derecha
function renderCart() {
  const container = document.getElementById('cart-items-container');
  const emptyNotice = document.getElementById('cart-empty-message');
  const countBadge = document.getElementById('cart-item-count');
  if (!container) return;

  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
  if (countBadge) countBadge.textContent = totalQty;

  // REGLA: Si el carrito queda en 0 artículos, limpiar estado de preventa
  if (cart.length === 0) {
    activePreventaCredit = 0;
    linkedPreventaId = null;
    pendingPreventaOrder = null;

    container.innerHTML = '';
    if (emptyNotice) {
      emptyNotice.classList.remove('hidden');
      emptyNotice.classList.add('flex');
    }
  } else {
    if (emptyNotice) {
      emptyNotice.classList.add('hidden');
      emptyNotice.classList.remove('flex');
    }

    container.innerHTML = cart.map((item, index) => {
      const subtotal = (item.price * item.qty).toFixed(2);
      return `
        <div class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2.5 hover:border-slate-700 transition-colors">
          <!-- Item info -->
          <div class="flex items-center gap-2.5 overflow-hidden flex-1">
            <div class="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              ${getCategoryIcon(item.category, 'w-4 h-4')}
            </div>
            <div class="overflow-hidden">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h5 class="text-xs font-semibold text-slate-100 truncate">${item.name}</h5>
                ${(item.isPin || item.category === 'pines') ? `
                  <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shrink-0 inline-flex items-center gap-1">
                    <i class="fa-solid fa-bolt text-[9px]"></i> PIN: ${item.montoSaldo || 'Digital'}
                  </span>
                ` : ''}
                ${item.isPreventaDeposit ? `
                  <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 shrink-0">
                    Anticipo Preventa (50%)
                  </span>
                ` : ''}
                ${item.isPreventaLiquidation ? `
                  <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shrink-0">
                    Entrega / Liquidación
                  </span>
                ` : ''}
              </div>
              <div class="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span class="text-cyan-400">$${item.price.toFixed(2)} c/u</span>
                <span>•</span>
                <span>${item.platform}</span>
                ${item.fullPrice ? `<span>• (Total juego: $${item.fullPrice.toFixed(2)})</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Quantity Controls -->
          <div class="flex items-center border border-slate-700 bg-slate-950/80 rounded-lg p-0.5 shrink-0">
            <button onclick="updateItemQty('${item.id}', -1)" class="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors" title="Disminuir cantidad">
              <i class="fa-solid fa-minus text-[10px]"></i>
            </button>
            <span class="w-6 text-center text-xs font-mono font-bold text-slate-100">${item.qty}</span>
            <button onclick="updateItemQty('${item.id}', 1)" class="w-6 h-6 flex items-center justify-center rounded text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors" title="Aumentar cantidad">
              <i class="fa-solid fa-plus text-[10px]"></i>
            </button>
          </div>

          <!-- Subtotal & Remove -->
          <div class="flex items-center gap-2 shrink-0 text-right">
            <span class="font-mono font-bold text-xs text-slate-100 w-16">$${subtotal}</span>
            <button onclick="eliminarDelCarrito(${index})" class="text-slate-500 hover:text-rose-400 p-1 transition-colors flex items-center justify-center cursor-pointer" title="Eliminar item">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  calculateTotals();
}

window.agregarAlCarrito = function(productoId) {
  const idNum = Number(productoId);
  const idStr = String(productoId);
  const producto = CATALOG.find(p => p.id === productoId || p.id === idNum || p.id === idStr || String(p.id) === idStr || (!isNaN(p.id) && !isNaN(idNum) && Number(p.id) === idNum));
  if (!producto) return;

  const stockDisponible = parseInt(producto.stock !== undefined ? producto.stock : 0);
  const isPin = Boolean(producto.isPin || producto.category === 'pines' || producto.categoria === 'Pines Digitales' || producto.esDigital);

  if (stockDisponible <= 0) {
    showToast(`Stock máximo disponible alcanzado (0 unidades)`, 'warning');
    return;
  }

  // Resolver ID numérico para asegurar compatibilidad con API /ventas
  let numericId = Number(producto.id);
  if (isNaN(numericId) || numericId <= 0) {
    const matchInCatalog = CATALOG.find(c => (!isNaN(Number(c.id)) && Number(c.id) > 0) && (c.sku === producto.sku || c.codigo === producto.sku || c.name === producto.name || c.nombre === producto.name));
    if (matchInCatalog) {
      numericId = Number(matchInCatalog.id);
    }
  }

  const existing = cart.find(i => (i.id === producto.id || String(i.id) === String(producto.id)) && !i.isPreventaDeposit && !i.isPreventaLiquidation);
  if (existing) {
    if (existing.qty >= stockDisponible) {
      showToast(`Stock máximo disponible alcanzado (${stockDisponible} unidades)`, 'warning');
      return;
    }
    existing.qty += 1;
    existing.productoId = !isNaN(numericId) && numericId > 0 ? numericId : Number(producto.id);
    existing.esDigital = Boolean(isPin || producto.esDigital);
    existing.categoria = producto.categoria || producto.category || 'pines';
  } else {
    cart.push({
      ...producto,
      productoId: !isNaN(numericId) && numericId > 0 ? numericId : Number(producto.id),
      esDigital: Boolean(isPin || producto.esDigital),
      categoria: producto.categoria || producto.category || 'pines',
      isPin: isPin,
      montoSaldo: producto.montoSaldo || '',
      qty: 1
    });
  }

  renderCart();
  showToast(`+1 ${producto.name}`, 'info');
};

window.addItemToCart = window.agregarAlCarrito;

// Modificar cantidad en carrito
window.updateItemQty = function(id, delta) {
  const item = cart.find(i => i.id === id || String(i.id) === String(id));
  if (item) {
    const idNum = Number(item.id);
    const idStr = String(item.id);
    const producto = CATALOG.find(p => p.id === item.id || p.id === idNum || p.id === idStr || String(p.id) === idStr || (!isNaN(p.id) && !isNaN(idNum) && Number(p.id) === idNum));
    const stockDisponible = producto ? parseInt(producto.stock !== undefined ? producto.stock : 0) : 999;

    if (delta > 0 && item.qty >= stockDisponible) {
      showToast(`Stock máximo disponible alcanzado (${stockDisponible} unidades)`, 'warning');
      return;
    }

    item.qty += delta;
    if (item.qty <= 0) {
      const idx = cart.indexOf(item);
      if (idx !== -1) {
        window.eliminarDelCarrito(idx);
      } else {
        window.removeItem(id);
      }
      return;
    }
    renderCart();
  }
};

// Eliminar ítem individual del carrito por índice usando cart.splice(index, 1)
window.eliminarDelCarrito = function(index) {
  const idx = parseInt(index);
  if (isNaN(idx) || idx < 0 || idx >= cart.length) return;

  const itemToRemove = cart[idx];

  // Si se elimina el ítem que originó la preventa, limpiar el anticipo
  if (itemToRemove && (itemToRemove.isPreventaDeposit || itemToRemove.isPreventaLiquidation || itemToRemove.preventaId === linkedPreventaId)) {
    activePreventaCredit = 0;
    linkedPreventaId = null;
    pendingPreventaOrder = null;
  }

  cart.splice(idx, 1);

  // Si el carrito queda vacío, reiniciar totalmente variables de preventa
  if (cart.length === 0) {
    activePreventaCredit = 0;
    linkedPreventaId = null;
    pendingPreventaOrder = null;
  }

  renderCart();
  showToast('Artículo retirado del carrito', 'info');
};

window.removeItem = function(id) {
  const idx = cart.findIndex(i => i.id === id || String(i.id) === String(id));
  if (idx !== -1) {
    window.eliminarDelCarrito(idx);
  } else {
    cart = cart.filter(i => i.id !== id && String(i.id) !== String(id));
    if (cart.length === 0) {
      activePreventaCredit = 0;
      linkedPreventaId = null;
      pendingPreventaOrder = null;
    }
    renderCart();
  }
};

// ========================================================
// CÁLCULO DE TOTALES & REGLAS DE NEGOCIO
// ========================================================
function calculateTotals() {
  const rowPreventaCredit = document.getElementById('row-preventa-credit');
  const posPreventaCredit = document.getElementById('pos-preventa-credit');
  const labelPreventaCredit = document.getElementById('label-preventa-credit');
  const rowClientDiscount = document.getElementById('row-client-discount');
  const posClientDiscount = document.getElementById('pos-client-discount');

  // Si no hay artículos en el carrito, garantizar que no haya anticipo visible
  if (cart.length === 0) {
    activePreventaCredit = 0;
    linkedPreventaId = null;
    pendingPreventaOrder = null;
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  // Verificar si la venta activa es un anticipo de preventa (Fase A)
  const isPreventaDepositSale = cart.some(i => i.isPreventaDeposit);

  // 2. APLICACIÓN DEL 5% DE DESCUENTO A CLIENTES REGISTRADOS:
  // a) Si hay un 'clienteActual' seleccionado y su ID no es el de "Público General" (o si esClienteRegistrado es true), calcula 'montoDescuento = subtotal * 0.05'.
  const client = clienteActual || currentClient || window.clienteActual || window.currentClient;
  const isGeneral = !client || client.isGeneral || client.id === 'publico' || !client.id;
  const esClienteRegistrado = !isGeneral || Boolean(client?.esClienteRegistrado);
  
  let montoDescuento = 0;
  if (esClienteRegistrado) {
    montoDescuento = Math.round(subtotal * 0.05 * 100) / 100;
  }
  const clientDiscount = montoDescuento;

  // b) Muestra la línea "Descuento Cliente (5%): -$X.XX" en la pantalla de cobro del POS.
  if (rowClientDiscount && posClientDiscount) {
    if (montoDescuento > 0) {
      posClientDiscount.textContent = `-$${montoDescuento.toFixed(2)}`;
      rowClientDiscount.classList.remove('hidden');
      rowClientDiscount.classList.add('flex');
    } else {
      rowClientDiscount.classList.add('hidden');
      rowClientDiscount.classList.remove('flex');
    }
  }

  // Visualización del Renglón de Anticipo Preventa (-50% en Fase B)
  if (rowPreventaCredit && posPreventaCredit) {
    if (activePreventaCredit > 0 && cart.length > 0) {
      if (labelPreventaCredit) labelPreventaCredit.textContent = 'Anticipo Preventa (-50%):';
      posPreventaCredit.textContent = `-$${activePreventaCredit.toFixed(2)}`;
      rowPreventaCredit.classList.remove('hidden');
      rowPreventaCredit.classList.add('flex');
    } else {
      rowPreventaCredit.classList.add('hidden');
      rowPreventaCredit.classList.remove('flex');
    }
  }

  // 3. CÁLCULO Y DESGLOSE DEL 16% DE IVA:
  // a) Subtotal Neto = (Suma de precios de productos) - Descuento (5% si aplica)
  const manualDiscount = Math.round((currentDiscount || 0) * 100) / 100;
  const subtotalNeto = Math.max(0, Math.round((subtotal - montoDescuento - manualDiscount) * 100) / 100);

  // b) IVA (16%) = Subtotal Neto * 0.16
  const tax = Math.round((subtotalNeto * 0.16) * 100) / 100;

  // c) Total a Pagar = Subtotal Neto + IVA (16%)
  let total = Math.round((subtotalNeto + tax) * 100) / 100;

  // Si hay crédito de preventa en Fase B de liquidación, descontar el anticipo
  if (activePreventaCredit > 0) {
    total = Math.max(0, Math.round((total - activePreventaCredit) * 100) / 100);
  }

  const posSubtotal = document.getElementById('pos-subtotal');
  const posTax = document.getElementById('pos-tax');
  const posTotal = document.getElementById('pos-total');

  if (posSubtotal) posSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  if (posTax) posTax.textContent = `$${tax.toFixed(2)}`;
  if (posTotal) posTotal.textContent = `$${total.toFixed(2)}`;

  updateCashChange(total);
}

function updateCashChange(total) {
  const cashInput = document.getElementById('monto-recibido') || document.getElementById('cash-received');
  const changeDisplay = document.getElementById('cash-change');
  if (!cashInput || !changeDisplay) return;

  const valStr = String(cashInput.value || '').trim();
  const received = valStr === '' ? 0 : (parseFloat(valStr) || 0);
  const change = Math.max(0, received - total);
  changeDisplay.textContent = `$${change.toFixed(2)}`;
}

// Configurar Listeners e Interacciones
function setupEventListeners() {
  // Filtros de categoría en catálogo
  const catButtons = document.querySelectorAll('.cat-filter-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => {
        b.classList.remove('active', 'border-cyan-500/60', 'bg-cyan-950/60', 'text-cyan-300', 'shadow-[0_0_12px_rgba(6,182,212,0.3)]');
        b.classList.add('border-slate-800', 'bg-slate-900/80', 'text-slate-400');
      });

      btn.classList.add('active', 'border-cyan-500/60', 'bg-cyan-950/60', 'text-cyan-300', 'shadow-[0_0_12px_rgba(6,182,212,0.3)]');
      btn.classList.remove('border-slate-800', 'bg-slate-900/80', 'text-slate-400');

      selectedCategory = btn.getAttribute('data-category');
      renderCatalog();
    });
  });

  // Buscador & Scanner en tiempo real
  const scannerInput = document.getElementById('scanner-input');
  if (scannerInput) {
    scannerInput.addEventListener('input', () => {
      searchQuery = scannerInput.value.trim().toLowerCase();
      renderCatalog();
    });

    scannerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = scannerInput.value.trim().toLowerCase();
        if (!query) return;

        const found = CATALOG.find(p => 
          p.sku.toLowerCase() === query || 
          p.sku.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
        );

        if (found) {
          addItemToCart(found.id);
          scannerInput.value = '';
          searchQuery = '';
          renderCatalog();
          showToast(`Escaneado: ${found.name}`, 'success');
        } else {
          showToast(`No se encontró el SKU o código "${query}"`, 'error');
        }
      }
    });
  }

  // Descuento en dinero manual
  const discountInput = document.getElementById('discount-amount');
  if (discountInput) {
    discountInput.addEventListener('input', () => {
      currentDiscount = parseFloat(discountInput.value) || 0;
      calculateTotals();
    });
  }

  // Código de cupón
  const discountCode = document.getElementById('discount-code');
  if (discountCode) {
    discountCode.addEventListener('change', () => {
      const code = discountCode.value.trim().toUpperCase();
      if (code === 'VIP10') {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
        currentDiscount = subtotal * 0.10;
        if (discountInput) discountInput.value = currentDiscount.toFixed(2);
        calculateTotals();
        showToast('¡Cupón VIP10 aplicado (-10%)!', 'success');
      } else if (code) {
        showToast('Cupón inválido o expirado', 'warning');
      }
    });
  }

  // Monto recibido en efectivo
  const cashReceived = document.getElementById('monto-recibido') || document.getElementById('cash-received');
  if (cashReceived) {
    cashReceived.addEventListener('input', () => {
      const totalStr = document.getElementById('pos-total')?.textContent.replace('$', '') || '0';
      const total = parseFloat(totalStr) || 0;
      updateCashChange(total);
    });

    cashReceived.addEventListener('focus', (event) => {
      event.target.select();
    });
  }

  // Vaciar carrito (LIMPIEZA DE ESTADO COMPLETA)
  const btnClear = document.getElementById('btn-clear-cart');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (cart.length === 0) return;
      if (confirm('¿Vaciar todos los artículos de la orden actual?')) {
        cart = [];
        activePreventaCredit = 0;
        linkedPreventaId = null;
        pendingPreventaOrder = null;
        currentDiscount = 0;
        if (discountInput) discountInput.value = 0;
        if (discountCode) discountCode.value = '';
        if (cashReceived) cashReceived.value = '';
        updateCashChange(0);
        renderCart();
        showToast('Carrito de venta vaciado y estado reiniciado', 'info');
      }
    });
  }

  // Selector de Método de Pago
  const methodButtons = document.querySelectorAll('.payment-method-btn');
  const cashCalculator = document.getElementById('cash-calculator');

  methodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      methodButtons.forEach(b => {
        b.classList.remove('active', 'border-cyan-400', 'bg-cyan-950/50', 'shadow-[0_0_15px_rgba(6,182,212,0.3)]');
        b.classList.add('border-slate-800', 'bg-slate-900/70', 'text-slate-400');
        const spanTitle = b.querySelector('span:first-of-type');
        if (spanTitle) spanTitle.className = 'font-bold text-xs text-slate-200';
      });

      btn.classList.add('active', 'border-cyan-400', 'bg-cyan-950/50', 'shadow-[0_0_15px_rgba(6,182,212,0.3)]');
      btn.classList.remove('border-slate-800', 'bg-slate-900/70', 'text-slate-400');
      const activeSpan = btn.querySelector('span:first-of-type');
      if (activeSpan) activeSpan.className = 'font-bold text-xs text-white';

      selectedPaymentMethod = btn.getAttribute('data-method');
      if (selectedPaymentMethod === 'cash') {
        if (cashCalculator) cashCalculator.classList.remove('hidden');
      } else {
        if (cashCalculator) cashCalculator.classList.add('hidden');
      }
    });
  });

  // Botón COMPLETAR VENTA (POST /api/ventas & POST /api/preventas)
  const btnComplete = document.getElementById('btn-complete-sale');
  if (btnComplete) {
    btnComplete.addEventListener('click', async () => {
      if (cart.length === 0) {
        showToast('Agrega al menos un artículo para completar la venta', 'warning');
        return;
      }

      const isPreventaDepositSale = cart.some(i => i.isPreventaDeposit) || pendingPreventaOrder !== null;
      const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
      const activeClient = clienteActual || currentClient || window.clienteActual || window.currentClient;
      const isGeneral = !activeClient || activeClient.isGeneral || activeClient.id === 'publico' || !activeClient.id;
      const esClienteRegistrado = !isGeneral || Boolean(activeClient?.esClienteRegistrado);
      
      const montoDescuento = esClienteRegistrado ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
      const clientDiscount = montoDescuento;
      const manualDiscount = Math.round((currentDiscount || 0) * 100) / 100;

      // 3. CÁLCULO Y DESGLOSE DEL 16% DE IVA:
      // a) Subtotal Neto = (Suma de precios de productos) - Descuento (5% si aplica)
      const subtotalNeto = Math.max(0, Math.round((subtotal - montoDescuento - manualDiscount) * 100) / 100);
      // b) IVA (16%) = Subtotal Neto * 0.16
      const tax = Math.round((subtotalNeto * 0.16) * 100) / 100;
      // c) Total a Pagar = Subtotal Neto + IVA (16%)
      let total = Math.round((subtotalNeto + tax) * 100) / 100;

      if (activePreventaCredit > 0) {
        total = Math.max(0, Math.round((total - activePreventaCredit) * 100) / 100);
      }

      const cashierName = document.getElementById('pos-cashier-name')?.textContent || 'Cajero';
      const cashierRole = document.getElementById('pos-cashier-role')?.textContent || 'EMPLEADO';

      let savedPreventaRecord = null;

      // FASE A: Al confirmarse el cobro del 50%, se genera la preventa en BD como PENDIENTE
      if (pendingPreventaOrder) {
        savedPreventaRecord = await apiPostPreventa({
          idCliente: pendingPreventaOrder.idCliente,
          clientName: pendingPreventaOrder.clientName,
          clientPhone: pendingPreventaOrder.clientPhone,
          idProducto: pendingPreventaOrder.idProducto,
          productName: pendingPreventaOrder.productName,
          productPrice: pendingPreventaOrder.productPrice,
          montoAnticipo: pendingPreventaOrder.montoAnticipo,
          anticipoPagado: pendingPreventaOrder.montoAnticipo,
          releaseDate: pendingPreventaOrder.releaseDate || '',
          estado: 'PENDIENTE'
        });
        showToast(`¡Anticipo cobrado! Preventa ${savedPreventaRecord.folio || `#${savedPreventaRecord.id}`} guardada oficialmente como PENDIENTE`, 'success');
      }

      // FASE B: Al confirmarse la liquidación del saldo restante, marcar como COMPLETADA
      if (linkedPreventaId) {
        try {
          await apiFetch(`/preventas/${linkedPreventaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'COMPLETADA' })
          });
        } catch (errLiq) {
          console.warn('[Offline Fallback] No se pudo notificar liquidación de preventa al backend:', errLiq);
        }
        const preventas = getLocalPreventas();
        const p = preventas.find(item => item.id === linkedPreventaId || String(item.id) === String(linkedPreventaId) || (!isNaN(item.id) && !isNaN(linkedPreventaId) && Number(item.id) === Number(linkedPreventaId)));
        if (p) {
          p.estado = 'COMPLETADA';
          localStorage.setItem('gamevault_preventas', JSON.stringify(preventas));
        }
        showToast(`¡Preventa #${linkedPreventaId} liquidada con éxito!`, 'success');
      }

      // Validar disponibilidad de códigos PIN en inventario
      for (const item of cart) {
        if (item.isPin || item.category === 'pines') {
          const avail = getAvailablePinCount(item.id);
          if (item.qty > avail) {
            showToast(`Inventario insuficiente de códigos para "${item.name}". Disponibles: ${avail}`, 'error');
            return;
          }
        }
      }

      const depositItem = cart.find(i => i.isPreventaDeposit);
      const deliveryEstDate = pendingPreventaOrder?.releaseDate || depositItem?.releaseDate || '';
      const anticipoVal = pendingPreventaOrder ? pendingPreventaOrder.montoAnticipo : (depositItem ? depositItem.price : activePreventaCredit);
      const restanteVal = pendingPreventaOrder 
        ? (pendingPreventaOrder.productPrice - pendingPreventaOrder.montoAnticipo) 
        : (depositItem ? ((depositItem.fullPrice || depositItem.price * 2) - depositItem.price) : 0);

      // Construcción del objeto de venta
      const ventaData = {
        id: 'vta_' + Date.now(),
        ticketNumber: getFormattedTicket(ticketCounter),
        idCliente: isGeneral ? null : activeClient.id,
        clienteNombre: isGeneral ? 'Público General' : (activeClient.name || activeClient.nombre),
        clienteTelefono: isGeneral ? (pendingPreventaOrder?.clientPhone || '') : (activeClient.phone || activeClient.telefono || pendingPreventaOrder?.clientPhone || ''),
        items: cart.map(i => ({ 
          id: i.id, 
          productoId: Number(i.productoId || i.id),
          name: i.name, 
          qty: i.qty, 
          price: i.price, 
          platform: i.platform,
          category: i.category,
          categoria: i.categoria || i.category,
          esDigital: Boolean(i.esDigital || i.isPin || i.category === 'pines'),
          isPin: !!i.isPin || i.category === 'pines' || !!i.esDigital,
          montoSaldo: i.montoSaldo || '',
          releaseDate: i.releaseDate || '',
          isPreventaDeposit: !!i.isPreventaDeposit,
          isPreventa: !!i.isPreventaDeposit || !!i.isPreventa || i.status === 'preventa' || isPreventaDepositSale,
          esPreventa: !!i.isPreventaDeposit || !!i.isPreventa || i.status === 'preventa' || isPreventaDepositSale,
          isPreventaLiquidation: !!i.isPreventaLiquidation,
          fullPrice: i.fullPrice || (i.price * 2)
        })),
        subtotal,
        descuento: montoDescuento,
        descuentoCliente: clientDiscount,
        descuentoManual: currentDiscount,
        subtotalNeto,
        anticipoPreventa: activePreventaCredit,
        preventaId: linkedPreventaId || (savedPreventaRecord ? savedPreventaRecord.id : null),
        linkedPreventaId: linkedPreventaId,
        preventaData: pendingPreventaOrder ? {
          idCliente: pendingPreventaOrder.idCliente,
          idProducto: pendingPreventaOrder.idProducto,
          montoAnticipo: pendingPreventaOrder.montoAnticipo,
          anticipoPagado: pendingPreventaOrder.montoAnticipo,
          montoTotal: pendingPreventaOrder.productPrice,
          saldoPendiente: restanteVal
        } : null,
        isPreventaDepositSale,
        isPreventa: isPreventaDepositSale || !!pendingPreventaOrder,
        montoAnticipo: anticipoVal,
        montoRestante: restanteVal,
        fechaLlegada: deliveryEstDate,
        fechaEntregaEstimada: deliveryEstDate,
        releaseDate: deliveryEstDate,
        iva: tax,
        total,
        paymentMethod: selectedPaymentMethod,
        cajero: cashierName,
        cajeroRol: cashierRole,
        createdAt: new Date().toISOString()
      };

      // Consumir POST /api/ventas y asignar PINs atómicamente
      const saleResponse = await apiPostVenta(ventaData);

      // Descontar existencias del catálogo si es entrega física (Fase B o venta regular)
      if (!isPreventaDepositSale) {
        cart.forEach(cartItem => {
          const invItem = CATALOG.find(p => p.id === (cartItem.originalProductId || cartItem.id));
          if (invItem && !invItem.isPin && invItem.category !== 'pines') {
            invItem.stock = Math.max(0, invItem.stock - cartItem.qty);
          }
        });
        localStorage.setItem('gamevault_inventory', JSON.stringify(CATALOG));
        syncPinStockInCatalog();
        renderCatalog();
      }

      // Abrir modal de ticket con detalles financieros y códigos PIN
      openReceiptModal(saleResponse);

      // Limpieza de estado transaccional
      pendingPreventaOrder = null;
      activePreventaCredit = 0;
      linkedPreventaId = null;
    });
  }

  // Botón Enviar Ticket por WhatsApp
  const btnWhatsappReceipt = document.getElementById('btn-whatsapp-receipt');
  if (btnWhatsappReceipt) {
    btnWhatsappReceipt.addEventListener('click', () => {
      sendTicketViaWhatsApp(lastCompletedSale);
    });
  }

  // Botón Nueva Venta en Modal de Ticket
  const btnNewSale = document.getElementById('btn-new-sale');
  const receiptModal = document.getElementById('receipt-modal');
  if (btnNewSale) {
    btnNewSale.addEventListener('click', () => {
      // Recalcular consecutivo de ticket según las ventas procesadas en la jornada activa
      updateTicketBadge();

      // Resetear orden y venta activa
      if (receiptModal) {
        receiptModal.classList.add('hidden');
        receiptModal.classList.remove('flex');
      }

      // Ocultar botón de WhatsApp y limpiar última venta
      const whatsappRow = document.getElementById('receipt-whatsapp-row');
      if (whatsappRow) {
        whatsappRow.classList.add('hidden');
        whatsappRow.classList.remove('block');
      }
      lastCompletedSale = null;

      cart = [];
      activePreventaCredit = 0;
      linkedPreventaId = null;
      pendingPreventaOrder = null;
      currentDiscount = 0;
      if (discountInput) discountInput.value = 0;
      if (discountCode) discountCode.value = '';
      if (cashReceived) cashReceived.value = '';
      updateCashChange(0);

      // Volver cliente a Público General por defecto
      setClient({ id: 'publico', name: 'Público General', isGeneral: true });

      renderCart();
      showToast(`¡Nueva venta iniciada! Ticket #${getFormattedTicket(ticketCounter)}`, 'success');
    });
  }

  // Botón Logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('gamevault_active_user');
    });
  }

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      document.getElementById('scanner-input')?.focus();
    } else if (e.key === 'F2') {
      e.preventDefault();
      btnComplete?.click();
    } else if (e.key === 'Escape') {
      if (receiptModal && !receiptModal.classList.contains('hidden')) {
        receiptModal.classList.add('hidden');
        receiptModal.classList.remove('flex');
      }
      if (corteModal && !corteModal.classList.contains('hidden')) {
        corteModal.classList.add('hidden');
        corteModal.classList.remove('flex');
      }
      const clientModal = document.getElementById('client-modal');
      if (clientModal && !clientModal.classList.contains('hidden')) {
        closeClientModal();
      }
      const prevModal = document.getElementById('preventas-modal');
      if (prevModal && !prevModal.classList.contains('hidden')) {
        closePreventasModal();
      }
    }
  });
}

// Abrir Modal de Ticket
function openReceiptModal(ventaData) {
  lastCompletedSale = ventaData || lastCompletedSale;
  const receiptModal = document.getElementById('receipt-modal');
  const list = document.getElementById('receipt-items-list');
  const dateEl = document.getElementById('receipt-date');
  const ticketIdEl = document.getElementById('receipt-ticket-id');
  const cashierLabelEl = document.getElementById('receipt-cashier-label');
  const clientLabelEl = document.getElementById('receipt-client-label');
  const methodEl = document.getElementById('receipt-method');
  const subtotalEl = document.getElementById('receipt-subtotal');
  const discountRow = document.getElementById('receipt-discount-row');
  const discountEl = document.getElementById('receipt-discount');
  const preventaRow = document.getElementById('receipt-preventa-row');
  const preventaEl = document.getElementById('receipt-preventa');
  const taxEl = document.getElementById('receipt-tax');
  const totalEl = document.getElementById('receipt-total');

  // Elementos de la sección dedicada a Pines Digitales en el modal
  const pinsContainer = document.getElementById('receipt-pins-container');
  const pinsList = document.getElementById('receipt-pins-list');
  const copyAllRow = document.getElementById('receipt-pins-copy-all-row');
  const btnCopyAll = document.getElementById('btn-copy-all-pins');

  // Control de visualización del botón de Enviar Ticket por WhatsApp
  const whatsappRow = document.getElementById('receipt-whatsapp-row');
  if (whatsappRow) {
    const rawPhone = ventaData?.clienteTelefono || (currentClient && !currentClient.isGeneral ? currentClient.phone : '');
    const cleanDigits = String(rawPhone || '').replace(/\D/g, '');
    const hasRegisteredPhone = cleanDigits.length >= 7;
    const clientName = ventaData?.clienteNombre || currentClient?.name || '';
    const hasAssignedClient = Boolean(
      (ventaData?.idCliente) ||
      (currentClient && !currentClient.isGeneral && currentClient.id !== 'publico') ||
      (clientName && !clientName.toLowerCase().includes('público general') && !clientName.toLowerCase().includes('publico general'))
    );

    if (hasAssignedClient && hasRegisteredPhone) {
      whatsappRow.classList.remove('hidden');
      whatsappRow.classList.add('block');
    } else {
      whatsappRow.classList.add('hidden');
      whatsappRow.classList.remove('block');
    }
  }

  if (!receiptModal) return;

  const now = new Date();
  if (dateEl) dateEl.textContent = now.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'medium' });

  const currentTicketStr = getFormattedTicket(ticketCounter);
  if (ticketIdEl) ticketIdEl.textContent = `TICKET #${currentTicketStr}`;

  const cashierName = document.getElementById('pos-cashier-name')?.textContent || 'Cajero';
  const cashierRole = document.getElementById('pos-cashier-role')?.textContent || 'EMPLEADO';
  if (cashierLabelEl) {
    cashierLabelEl.textContent = `Atendido por: ${cashierName} (${cashierRole})`;
  }

  // Etiqueta del cliente en el ticket
  if (clientLabelEl) {
    const isGeneral = !currentClient || currentClient.isGeneral;
    if (ventaData?.isPreventaDepositSale) {
      clientLabelEl.textContent = `Apartado para: ${ventaData.clienteNombre} (Anticipo 50% Registrado)`;
    } else {
      clientLabelEl.textContent = isGeneral 
        ? 'Cliente: Público General' 
        : `Cliente: ${currentClient.name} (Descuento VIP 5% Aplicado)`;
    }
  }

  // Método de pago
  if (methodEl) {
    methodEl.textContent = selectedPaymentMethod === 'cash' 
      ? 'EFECTIVO' 
      : (selectedPaymentMethod === 'card' ? 'TARJETA DE CRÉDITO / DÉBITO' : 'TRANSFERENCIA BANCARIA');
  }

  // Totales financieros en el recibo
  const subtotal = ventaData ? Number(ventaData.subtotal || 0) : cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const clientDisc = ventaData ? Number(ventaData.descuento !== undefined ? ventaData.descuento : (ventaData.descuentoCliente || 0)) : 0;
  const prevCredit = ventaData ? Number(ventaData.anticipoPreventa || 0) : activePreventaCredit;
  const tax = ventaData ? Number(ventaData.iva || 0) : 0;
  const total = ventaData ? Number(ventaData.total || 0) : 0;

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

  if (discountRow && discountEl) {
    if (clientDisc > 0) {
      discountEl.textContent = `-$${clientDisc.toFixed(2)}`;
      discountRow.classList.remove('hidden');
      discountRow.classList.add('flex');
    } else {
      discountRow.classList.add('hidden');
      discountRow.classList.remove('flex');
    }
  }

  if (preventaRow && preventaEl) {
    if (prevCredit > 0) {
      preventaEl.textContent = `-$${prevCredit.toFixed(2)}`;
      preventaRow.classList.remove('hidden');
      preventaRow.classList.add('flex');
    } else {
      preventaRow.classList.add('hidden');
      preventaRow.classList.remove('flex');
    }
  }

  // Renglón de Fecha Estimada de Entrega en Ticket
  const deliveryDateRow = document.getElementById('receipt-delivery-date-row');
  const deliveryDateEl = document.getElementById('receipt-delivery-date');
  const depositItem = cart.find(i => i.isPreventaDeposit);
  const estDeliveryDate = ventaData?.fechaEntregaEstimada || ventaData?.releaseDate || depositItem?.releaseDate;

  if (deliveryDateRow && deliveryDateEl) {
    if ((ventaData?.isPreventaDepositSale || depositItem) && estDeliveryDate) {
      deliveryDateEl.textContent = formatDisplayDate(estDeliveryDate);
      deliveryDateRow.classList.remove('hidden');
      deliveryDateRow.classList.add('flex');
    } else {
      deliveryDateRow.classList.add('hidden');
      deliveryDateRow.classList.remove('flex');
    }
  }

  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

  // Recuperar códigos PIN asignados en la venta
  const assignedPins = ventaData?.assignedPins || [];

  // PINES DIGITALES: Pantalla de confirmación con opción de copiar al portapapeles
  if (pinsContainer && pinsList) {
    if (assignedPins.length > 0) {
      pinsContainer.classList.remove('hidden');
      pinsContainer.classList.add('flex');

      pinsList.innerHTML = assignedPins.map((pin) => `
        <div class="p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-1.5 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-100 text-[11px] truncate">${pin.productName}</span>
            <span class="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold">
              ${pin.montoSaldo || pin.platform}
            </span>
          </div>
          <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/50">
            <div class="overflow-hidden">
              <span class="text-[9px] uppercase tracking-wider text-emerald-400 block font-semibold">CÓDIGO ALFANUMÉRICO PIN:</span>
              <span class="text-sm sm:text-base font-black tracking-widest text-emerald-200 font-mono select-all pin-code-text">${pin.code}</span>
            </div>
            <button 
              type="button" 
              onclick="copyPinCode('${pin.code}', this)" 
              class="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
              title="Copiar código al portapapeles"
            >
              <svg class="w-3.5 h-3.5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>Copiar</span>
            </button>
          </div>
        </div>
      `).join('');

      if (copyAllRow) {
        if (assignedPins.length > 1) {
          copyAllRow.classList.remove('hidden');
          if (btnCopyAll) {
            btnCopyAll.onclick = function() {
              window.copyAllPins(btnCopyAll);
            };
          }
        } else {
          copyAllRow.classList.add('hidden');
        }
      }
    } else {
      pinsContainer.classList.add('hidden');
      pinsContainer.classList.remove('flex');
      pinsList.innerHTML = '';
      if (copyAllRow) copyAllRow.classList.add('hidden');
    }
  }

  // Generar lista de productos del ticket (con PIN resaltado en ticket impreso o digital)
  if (list) {
    list.innerHTML = cart.map(item => {
      const itemRelDate = item.releaseDate || estDeliveryDate;
      const formattedRelDate = itemRelDate ? formatDisplayDate(itemRelDate) : '';
      const isPinItem = item.isPin || item.category === 'pines' || DEFAULT_PIN_PRODUCTS.some(p => p.id === item.id);
      const itemPins = assignedPins.filter(p => p.productId === item.id);

      return `
        <div class="py-1.5 border-b border-slate-900/60 last:border-b-0">
          <div class="flex justify-between">
            <span>
              ${item.qty}x ${item.name}
              ${item.isPreventaDeposit ? '<span class="text-purple-400 font-bold"> [Anticipo 50%]</span>' : ''}
              ${item.isPreventaLiquidation ? '<span class="text-emerald-400 font-bold"> [Entrega]</span>' : ''}
              ${isPinItem ? '<span class="text-emerald-400 font-bold font-mono"> [PIN Digital]</span>' : ''}
            </span>
            <span class="font-bold text-slate-100">$${(item.price * item.qty).toFixed(2)}</span>
          </div>

          ${(item.isPreventaDeposit && formattedRelDate) ? `
            <div class="text-[10px] text-purple-300 font-semibold mt-0.5 pl-3">
              Fecha estimada de entrega: ${formattedRelDate}
            </div>
          ` : ''}

          ${(isPinItem && itemPins.length > 0) ? `
            <div class="receipt-pin-highlight mt-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-mono text-xs space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-[9px] uppercase tracking-wider font-bold text-emerald-400 flex items-center gap-1.5">
                  <i class="fa-solid fa-bolt text-[10px]"></i>
                  <span>CÓDIGO PIN ASIGNADO (CANJE):</span>
                </span>
                <span class="text-[9px] text-slate-400">${item.montoSaldo || item.platform}</span>
              </div>
              ${itemPins.map(ip => `
                <div class="flex items-center justify-between gap-2 pt-0.5">
                  <span class="receipt-pin-code text-xs sm:text-sm font-black tracking-widest text-emerald-200 select-all font-mono">${ip.code}</span>
                  <button type="button" onclick="copyPinCode('${ip.code}', this)" class="px-2 py-0.5 text-[10px] rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 flex items-center gap-1 cursor-pointer no-print transition-colors">
                    <i class="fa-regular fa-copy text-[10px]"></i>
                    <span>Copiar</span>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  receiptModal.classList.remove('hidden');
  receiptModal.classList.add('flex');
}

// Funciones globales para copiar códigos PIN al portapapeles
window.copyPinCode = function(code, buttonElement) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      onCopySuccess(buttonElement, code);
    }).catch(() => {
      fallbackCopyText(code, buttonElement);
    });
  } else {
    fallbackCopyText(code, buttonElement);
  }
};

window.copyAllPins = function(buttonElement) {
  const pinElements = document.querySelectorAll('.pin-code-text');
  const codes = Array.from(pinElements).map(el => el.textContent.trim()).filter(Boolean);
  if (codes.length === 0) return;
  const fullText = codes.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullText).then(() => {
      showToast(`¡${codes.length} código(s) PIN copiado(s) al portapapeles!`, 'success');
      if (buttonElement) {
        const orig = buttonElement.innerHTML;
        buttonElement.innerHTML = `<i class="fa-solid fa-check text-xs"></i> <span>¡Todos Copiados!</span>`;
        setTimeout(() => { buttonElement.innerHTML = orig; }, 2000);
      }
    }).catch(() => {
      fallbackCopyText(fullText, buttonElement);
    });
  } else {
    fallbackCopyText(fullText, buttonElement);
  }
};

function fallbackCopyText(text, buttonElement) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-999999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    onCopySuccess(buttonElement, text);
  } catch (err) {
    showToast('No se pudo copiar automáticamente', 'error');
  }
  document.body.removeChild(ta);
}

function onCopySuccess(buttonElement, code) {
  showToast(`¡PIN ${code} copiado al portapapeles!`, 'success');
  if (buttonElement) {
    const orig = buttonElement.innerHTML;
    buttonElement.innerHTML = `<i class="fa-solid fa-check text-xs"></i> <span>Copiado</span>`;
    buttonElement.classList.add('bg-emerald-600', 'text-white');
    setTimeout(() => {
      buttonElement.innerHTML = orig;
      buttonElement.classList.remove('bg-emerald-600', 'text-white');
    }, 2000);
  }
}

// Toast Notifier
let posToastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('pos-toast');
  const toastMsg = document.getElementById('pos-toast-msg');
  if (!toast || !toastMsg) return;

  if (posToastTimer) clearTimeout(posToastTimer);

  toastMsg.textContent = msg;
  toast.className = 'fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl text-xs sm:text-sm font-medium transition-all duration-300';

  if (type === 'success') {
    toast.classList.add('bg-emerald-950/90', 'border-emerald-500/50', 'text-emerald-200');
  } else if (type === 'error') {
    toast.classList.add('bg-rose-950/90', 'border-rose-500/50', 'text-rose-200');
  } else if (type === 'warning') {
    toast.classList.add('bg-amber-950/90', 'border-amber-500/50', 'text-amber-200');
  } else {
    toast.classList.add('bg-slate-900/90', 'border-cyan-500/50', 'text-cyan-200');
  }

  toast.classList.remove('hidden');
  posToastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

// ========================================================
// 7. ENVÍO DE TICKET DIGITAL POR WHATSAPP
// ========================================================
function sendTicketViaWhatsApp(sale) {
  const saleData = sale || lastCompletedSale;
  if (!saleData) {
    showToast('No hay ninguna venta registrada para enviar por WhatsApp', 'error');
    return null;
  }

  // 1. Obtener y sanitizar número de teléfono (México / E.164)
  const rawPhone = saleData.clienteTelefono || (currentClient && !currentClient.isGeneral ? currentClient.phone : '');
  let cleanPhone = String(rawPhone || '').replace(/\D/g, '');
  if (!cleanPhone) {
    showToast('El cliente asignado no tiene un número de teléfono registrado', 'warning');
    return null;
  }
  if (cleanPhone.length === 10) {
    cleanPhone = '52' + cleanPhone;
  }

  // 2. Extraer campos para el mensaje
  const numeroTicket = saleData.ticketNumber || (ticketCounter ? getFormattedTicket(ticketCounter) : 'GV-0001');
  const nombreCliente = saleData.clienteNombre || (currentClient && !currentClient.isGeneral ? currentClient.name : 'Cliente');

  // Fecha en formato DD/MM/AAAA
  let fechaStr = '';
  if (saleData.createdAt) {
    try {
      fechaStr = formatDisplayDate(saleData.createdAt.split('T')[0]);
    } catch (e) {}
  }
  if (!fechaStr) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    fechaStr = `${day}/${month}/${year}`;
  }

  // Detalle de productos
  const items = (Array.isArray(saleData.items) && saleData.items.length > 0) 
    ? saleData.items 
    : (Array.isArray(cart) && cart.length > 0 ? cart : []);

  const detailLines = items.map(item => {
    const itemTotal = (Number(item.price || 0) * Number(item.qty || 1)).toFixed(2);
    return `- ${item.name} x${item.qty || 1} : $${itemTotal}`;
  }).join('\n');

  // Determinar si es preventa
  const depositItem = items.find(i => i.isPreventaDeposit);
  const isPreventa = Boolean(
    saleData.isPreventaDepositSale || 
    saleData.isPreventa || 
    saleData.preventaId || 
    depositItem
  );

  // Método de pago
  let metodoPago = 'Efectivo';
  const pMethod = String(saleData.paymentMethod || selectedPaymentMethod || '').toLowerCase();
  if (pMethod.includes('card') || pMethod.includes('tarjeta')) {
    metodoPago = 'Tarjeta';
  } else if (pMethod.includes('transf')) {
    metodoPago = 'Transferencia';
  } else {
    metodoPago = 'Efectivo';
  }

  const sep = '----------------------------------';

  let message = `${sep}\nGAMEVAULT - Comprobante Digital\nTicket #: ${numeroTicket}\nCliente: ${nombreCliente}\nFecha: ${fechaStr}\n${sep}\nDetalle:\n${detailLines}\n${sep}`;

  if (isPreventa) {
    let montoAnticipo = saleData.montoAnticipo;
    if (montoAnticipo === undefined || montoAnticipo === null) {
      montoAnticipo = depositItem ? depositItem.price : (saleData.anticipoPreventa || saleData.total || 0);
    }

    let montoRestante = saleData.montoRestante;
    if (montoRestante === undefined || montoRestante === null) {
      if (depositItem) {
        const full = depositItem.fullPrice || (depositItem.price * 2);
        montoRestante = Math.max(0, full - depositItem.price);
      } else {
        montoRestante = montoAnticipo;
      }
    }

    const rawFechaLlegada = saleData.fechaLlegada || saleData.fechaEntregaEstimada || saleData.releaseDate || depositItem?.releaseDate || '';
    const fechaLlegada = formatDisplayDate(rawFechaLlegada) || rawFechaLlegada || 'Por confirmar';

    message += `\n[Si es Preventa]:\n- Anticipo abonado (50%): $${Number(montoAnticipo).toFixed(2)}\n- Saldo pendiente al entregar: $${Number(montoRestante).toFixed(2)}\n- Fecha estimada de llegada: ${fechaLlegada}\n${sep}`;
  }

  message += `\nTotal Pagado: $${Number(saleData.total || 0).toFixed(2)}\nMetodo de Pago: ${metodoPago}\n\nConserva este mensaje para reclamar tu preventa en tienda. Gracias por tu compra.\n${sep}`;

  // 3. Generar URL de WhatsApp y abrir en nueva pestaña
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined' && window.open) {
    window.open(whatsappUrl, '_blank');
  }
  showToast(`Abriendo WhatsApp con comprobante de Ticket #${numeroTicket}...`, 'success');
  return whatsappUrl;
}

window.sendTicketViaWhatsApp = sendTicketViaWhatsApp;
