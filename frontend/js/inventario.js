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
 * GameVault - Panel de Inventario & Control de Stock
 * Exclusivo para Administradores con KPI Metrics y Reabastecimiento de Cantidades.
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
    case 'preventa':
      return `<svg class="${className} text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M12 14v4m-2-2h4"/></svg>`;
    case 'pines':
    case 'pin':
      return `<svg class="${className} text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M6 14h4"/><path d="M6 17h2"/><circle cx="17" cy="15" r="1"/></svg>`;
    default:
      return `<svg class="${className} text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  }
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

// Catálogo base inicial de inventario
const DEFAULT_INVENTORY = [
  // Consolas
  { id: 'c_ps5', name: 'PlayStation 5 Slim 1TB Digital', category: 'consoles', platform: 'PS5', sku: 'SS5-SLIM-01', price: 449.99, stock: 5 },
  { id: 'c_switch', name: 'Nintendo Switch OLED Blanco 64GB', category: 'consoles', platform: 'Switch', sku: 'NSW-OLED-02', price: 349.99, stock: 7 },
  { id: 'c_xbox', name: 'Xbox Series X 1TB Black Edition', category: 'consoles', platform: 'Xbox', sku: 'XSX-1TB-03', price: 499.99, stock: 4 },

  // Videojuegos
  { id: 'g_zelda', name: 'The Legend of Zelda: Tears of the Kingdom', category: 'games', platform: 'Switch', sku: 'S645507000000', price: 69.99, stock: 12 },
  { id: 'g_cyber', name: 'Cyberpunk 2077 Collector\'s Edition', category: 'games', platform: 'PC', sku: 'S349500S00000', price: 249.99, stock: 2 }, // Stock Bajo <= 3
  { id: 'g_spiderman', name: 'Marvel\'s Spider-Man 2 Launch Edition', category: 'games', platform: 'PS5', sku: 'SM2-PS5-04', price: 69.99, stock: 14 },
  { id: 'g_gta', name: 'Grand Theft Auto VI - Pre-Order Edition', category: 'games', status: 'preventa', isPreventa: true, releaseDate: '2026-11-20', platform: 'Multi', sku: 'GTA6-PRE-05', price: 79.99, stock: 25 },
  { id: 'g_elden', name: 'Elden Ring: Shadow of the Erdtree Edition', category: 'games', platform: 'Multi', sku: 'ER-SHADOW-06', price: 59.99, stock: 9 },
  { id: 'g_mario', name: 'Super Mario Bros. Wonder', category: 'games', platform: 'Switch', sku: 'SMB-WONDER-07', price: 59.99, stock: 16 },
  { id: 'g_starfield', name: 'Starfield Premium Edition', category: 'games', platform: 'PC/Xbox', sku: 'STAR-PREM-08', price: 69.99, stock: 3 }, // Stock Bajo <= 3

  // Accesorios
  { id: 'a_dualsense', name: 'PlayStation 5 DualSense Wireless Controller', category: 'accessories', platform: 'PS5', sku: 'SSXS8B0600000', price: 69.99, stock: 15 },
  { id: 'a_elite', name: 'Xbox Elite Wireless Controller Series 2', category: 'accessories', platform: 'Xbox/PC', sku: 'SSAS887000000', price: 179.99, stock: 6 },
  { id: 'a_pulse', name: 'Auriculares Gaming Pulse 3D Wireless', category: 'accessories', platform: 'PS5/PC', sku: 'PULSE-3D-08', price: 99.99, stock: 8 },
  { id: 'a_pro_switch', name: 'Nintendo Switch Pro Controller Original', category: 'accessories', platform: 'Switch', sku: 'NSW-PRO-09', price: 69.99, stock: 11 },

  // Coleccionables
  { id: 'm_sephiroth', name: 'Estatua Coleccionista Sephiroth FFVII 30cm', category: 'merch', platform: 'Merch', sku: 'SEPH-FIG-10', price: 129.99, stock: 1 }, // Stock Bajo <= 3
  { id: 'm_amiibo', name: 'Figura Amiibo Link Tears of the Kingdom', category: 'merch', platform: 'Amiibo', sku: 'AMB-LINK-11', price: 29.99, stock: 18 }
];

let inventory = [];
let currentRestockItem = null;

// Cargar y refrescar inventario completo (KPIs y tabla)
window.cargarInventario = async function() {
  await loadInventoryData();
  renderKpiCards();
  renderInventoryTable();
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthorized = verifyAdminAccess();
  if (!isAuthorized) return;

  await window.cargarInventario();
  setupEventListeners();
});

// Verificación de Permisos (Solo Administradores)
function verifyAdminAccess() {
  const activeUserJson = localStorage.getItem('gamevault_active_user');
  let user = null;

  if (activeUserJson) {
    try {
      user = JSON.parse(activeUserJson);
    } catch (e) {}
  }

  const dashboard = document.getElementById('inventory-dashboard');
  const deniedScreen = document.getElementById('access-denied-screen');
  const adminNameEl = document.getElementById('inv-admin-name');
  const deniedUserName = document.getElementById('denied-user-name');
  const deniedUserRole = document.getElementById('denied-user-role');

  const roleLower = (user?.role || user?.rol || '').toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'administrador';

  if (!user || !isAdmin) {
    // Bloquear acceso si no es Administrador
    if (dashboard) dashboard.classList.add('hidden');
    if (deniedScreen) {
      deniedScreen.classList.remove('hidden');
      deniedScreen.classList.add('flex');
    }
    if (user) {
      if (deniedUserName) deniedUserName.textContent = user.fullname || user.nombreCompleto;
      if (deniedUserRole) deniedUserRole.textContent = (user.role || user.rol || '').toUpperCase();
    } else {
      if (deniedUserName) deniedUserName.textContent = 'Sin Sesión Iniciada';
      if (deniedUserRole) deniedUserRole.textContent = 'NO AUTORIZADO';
    }
    return false;
  }

  // Usuario Administrador confirmado
  if (dashboard) dashboard.classList.remove('hidden');
  if (deniedScreen) deniedScreen.classList.add('hidden');
  if (adminNameEl) {
    adminNameEl.textContent = (user.fullname || user.nombreCompleto || '').replace(/\s*\(\s*admin vault\s*\)/i, '').trim() || 'Daniela Blanco';
  }
  return true;
}

// Cargar datos de productos desde el Backend (GET /api/productos) con fallback a localStorage
async function loadInventoryData() {
  try {
    const res = await apiFetch('/productos');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        inventory = data.map(p => {
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
            status: p.status || (p.isPreventa ? 'preventa' : 'regular'),
            isPreventa: Boolean(p.isPreventa || (p.codigo && p.codigo.includes('PRE'))),
            releaseDate: p.releaseDate || (p.codigo === 'GTA6-PRE-05' ? '2026-11-20' : ''),
            sku: p.codigo || p.sku || `SKU-${p.id}`,
            codigo: p.codigo || p.sku || `SKU-${p.id}`,
            price: parseFloat(p.precio !== undefined ? p.precio : p.price) || 0,
            stock: parseInt(p.stock !== undefined ? p.stock : 0),
            isPin: Boolean(p.esDigital || catSlug === 'pines'),
            esDigital: Boolean(p.esDigital || catSlug === 'pines')
          };
        });
        saveInventoryData();
        return;
      }
    }
  } catch (e) {
    console.warn('Error al cargar productos desde backend, usando inventario local:', e);
  }

  const saved = localStorage.getItem('gamevault_inventory');
  if (saved) {
    try {
      inventory = JSON.parse(saved);
      inventory.forEach(item => {
        if (item.id === 'g_gta' && !item.releaseDate) {
          item.status = 'preventa';
          item.isPreventa = true;
          item.releaseDate = '2026-11-20';
        }
      });
    } catch (e) {
      inventory = [...DEFAULT_INVENTORY];
    }
  } else {
    inventory = [...DEFAULT_INVENTORY];
    saveInventoryData();
  }
}

function saveInventoryData() {
  localStorage.setItem('gamevault_inventory', JSON.stringify(inventory));
}

// Renderizar las 4 Cartas de Métricas KPI
function renderKpiCards() {
  // 1. Total Artículos (unidades totales en bodega)
  const totalUnits = inventory.reduce((acc, item) => acc + item.stock, 0);
  const totalUnique = inventory.length;

  // 2. Stock Bajo (<= 3)
  const lowStockItems = inventory.filter(item => item.stock <= 3);

  // 3. Stock Óptimo (> 3)
  const optimalStockItems = inventory.filter(item => item.stock > 3);

  // 4. Valor Estimado del Inventario: Suma de (precio * stock) de todos los productos
  const totalValuation = inventory.reduce((acc, item) => acc + (item.price * item.stock), 0);

  // Inyectar en el DOM
  document.getElementById('kpi-total-items').textContent = totalUnits.toLocaleString();
  document.getElementById('kpi-unique-titles').textContent = `${totalUnique} títulos`;
  document.getElementById('kpi-low-stock-count').textContent = lowStockItems.length;
  document.getElementById('kpi-optimal-stock-count').textContent = optimalStockItems.length;
  document.getElementById('kpi-total-valuation').textContent = `$${totalValuation.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Renderizar la Tabla Principal de Inventario
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;

  const searchQuery = (document.getElementById('inv-search-input')?.value || '').trim().toLowerCase();
  const stockFilter = document.getElementById('inv-filter-stock')?.value || 'all';

  const filtered = inventory.filter(item => {
    // Filtro por stock
    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = item.stock <= 3;
    if (stockFilter === 'optimal') matchesStock = item.stock > 3;

    // Filtro por búsqueda
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery) ||
      item.sku.toLowerCase().includes(searchQuery) ||
      item.platform.toLowerCase().includes(searchQuery);

    return matchesStock && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-500 font-mono text-xs">
          No se encontraron productos que coincidan con los filtros.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isLowStock = item.stock <= 3;
    const isOutOfStock = item.stock === 0;
    const isPreventa = item.isPreventa || item.status === 'preventa' || item.category === 'preventa';

    let badgeClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    let statusLabel = 'Óptimo';

    if (isOutOfStock) {
      badgeClass = 'bg-rose-500/10 border-rose-500/30 text-rose-300';
      statusLabel = 'Agotado';
    } else if (isLowStock) {
      badgeClass = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
      statusLabel = 'Stock Bajo';
    }

    return `
      <tr class="hover:bg-slate-900/40 transition-colors">
        
        <!-- 1. Producto / Título -->
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              ${getCategoryIcon(item.category)}
            </div>
            <div>
              <div class="font-bold text-slate-100 text-xs sm:text-sm">${item.name}</div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] font-mono text-slate-500 uppercase">${item.category}</span>
                ${item.releaseDate ? `
                  <span class="inline-flex items-center gap-1 text-[10px] font-mono text-purple-300 font-semibold bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">
                    <i class="fa-regular fa-calendar text-[10px] text-purple-400"></i>
                    <span>Estreno: ${formatDisplayDate(item.releaseDate)}</span>
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </td>

        <!-- 2. SKU / Código -->
        <td class="py-3.5 px-4 font-mono text-xs font-semibold text-cyan-400 whitespace-nowrap">
          ${item.sku}
        </td>

        <!-- 3. Plataforma -->
        <td class="py-3.5 px-4 font-mono text-xs whitespace-nowrap">
          <span class="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
            ${item.platform}
          </span>
        </td>

        <!-- 4. Unit Price -->
        <td class="py-3.5 px-4 text-right font-mono font-semibold text-slate-200 text-xs sm:text-sm">
          $${item.price.toFixed(2)}
        </td>

        <!-- 5. Stock Count -->
        <td class="py-3.5 px-4 text-center font-mono font-bold text-xs sm:text-sm ${isLowStock ? 'text-amber-400' : 'text-slate-100'}">
          ${item.stock} uds
        </td>

        <!-- 6. State Badge -->
        <td class="py-3.5 px-4 text-center">
          <div class="flex flex-col items-center gap-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeClass}">
              ${statusLabel}
            </span>
            ${isPreventa ? `
              <span class="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                PREVENTA
              </span>
            ` : ''}
          </div>
        </td>

        <!-- 7. Actions Admin -->
        <td class="py-3.5 px-4 text-left whitespace-nowrap">
          <div class="flex items-center justify-start gap-1.5">
            <button 
              data-id="${item.id}"
              onclick="window.abrirModalReabastecer('${item.id}')"
              class="btn-reabastecer px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Aumentar cantidad de stock para este juego"
            >
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>Reabastecer</span>
            </button>
            <button 
              data-id="${item.id}"
              onclick="window.abrirModalEditar('${item.id}')"
              class="btn-editar px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-purple-500/10 border border-purple-500/40 text-purple-300 hover:bg-purple-500 hover:text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Editar información de este producto"
            >
              <i class="fa-solid fa-pen-to-square text-xs"></i>
              <span>Editar</span>
            </button>
            <button 
              data-id="${item.id}"
              onclick="window.eliminarProducto('${item.id}')"
              class="btn-eliminar p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Desactivar producto del inventario"
            >
              <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
          </div>
        </td>

      </tr>
    `;
  }).join('');
}

// Control Dinámico de Obligatoriedad de Fecha de Lanzamiento
function updateReleaseDateRequirement() {
  const catVal = document.getElementById('new-product-category')?.value;
  const statusVal = document.getElementById('new-product-status')?.value;
  const dateInput = document.getElementById('new-product-release-date');
  const reqTag = document.getElementById('release-date-required-tag');

  const isPreventa = catVal === 'preventa' || statusVal === 'preventa';

  if (isPreventa) {
    if (dateInput) {
      dateInput.required = true;
      dateInput.classList.add('border-purple-500/80');
    }
    if (reqTag) reqTag.classList.remove('hidden');
  } else {
    if (dateInput) {
      dateInput.required = false;
      dateInput.classList.remove('border-purple-500/80');
    }
    if (reqTag) reqTag.classList.add('hidden');
  }
}

// ========================================================
// 1. REABASTECER (window.abrirModalReabastecer)
// ========================================================
window.abrirModalReabastecer = function(id) {
  const item = inventory.find(i => String(i.id) === String(id) || (!isNaN(i.id) && !isNaN(id) && Number(i.id) === Number(id)));
  if (!item) return;

  currentRestockItem = item;

  const iconEl = document.getElementById('reabastecer-product-icon') || document.getElementById('restock-product-icon');
  if (iconEl) iconEl.innerHTML = getCategoryIcon(item.category);

  const nameEl = document.getElementById('reabastecer-product-name') || document.getElementById('restock-product-name');
  if (nameEl) nameEl.textContent = item.name;

  const skuEl = document.getElementById('reabastecer-product-sku') || document.getElementById('restock-product-sku');
  if (skuEl) skuEl.textContent = item.sku;

  const stockEl = document.getElementById('reabastecer-current-stock') || document.getElementById('restock-current-stock');
  if (stockEl) stockEl.textContent = `${item.stock} uds`;

  const addInput = document.getElementById('reabastecer-cantidad') || document.getElementById('restock-add-qty');
  if (addInput) addInput.value = 5;
  updateRestockCalculation();

  const modal = document.getElementById('modal-reabastecer') || document.getElementById('restock-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};
window.openRestockModal = window.abrirModalReabastecer;

function cerrarModalReabastecer() {
  const modal = document.getElementById('modal-reabastecer') || document.getElementById('restock-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  currentRestockItem = null;
}

function updateRestockCalculation() {
  if (!currentRestockItem) return;
  const qtyInput = document.getElementById('reabastecer-cantidad') || document.getElementById('restock-add-qty');
  const addVal = parseInt(qtyInput ? qtyInput.value : 0, 10) || 0;
  const newStock = Math.max(0, currentRestockItem.stock + addVal);
  const totalEl = document.getElementById('reabastecer-new-total') || document.getElementById('restock-new-total');
  if (totalEl) totalEl.textContent = `${newStock} unidades`;
}


window.adjustRestockInput = function(delta) {
  const addInput = document.getElementById('reabastecer-cantidad') || document.getElementById('restock-add-qty');
  if (!addInput) return;
  let current = parseInt(addInput.value, 10) || 0;
  current = Math.max(1, current + delta);
  addInput.value = current;
  updateRestockCalculation();
};

// ========================================================
// 2. EDITAR (window.abrirModalEditar) & GESTIÓN DE PINES
// ========================================================
window.abrirModalEditar = async function(id) {
  const item = inventory.find(i => String(i.id) === String(id) || (!isNaN(i.id) && !isNaN(id) && Number(i.id) === Number(id)));
  if (!item) return;

  const modal = document.getElementById('modal-editar-producto');
  if (!modal) return;

  const idInput = document.getElementById('editar-id');
  const nameInput = document.getElementById('editar-nombre');
  const catInput = document.getElementById('editar-categoria');
  const platInput = document.getElementById('editar-plataforma');
  const tipoInput = document.getElementById('editar-tipo');
  const dateInput = document.getElementById('editar-fecha-estreno');
  const skuInput = document.getElementById('editar-sku');
  const priceInput = document.getElementById('editar-precio');
  const stockInput = document.getElementById('editar-stock');

  if (idInput) idInput.value = item.id;
  if (nameInput) nameInput.value = item.name || '';
  if (catInput) catInput.value = item.category || 'games';
  if (platInput) platInput.value = item.platform || '';
  if (tipoInput) tipoInput.value = (item.status === 'preventa' || item.isPreventa || item.category === 'preventa') ? 'preventa' : 'regular';
  if (dateInput) dateInput.value = item.releaseDate || '';
  if (skuInput) skuInput.value = item.sku || '';
  if (priceInput) priceInput.value = item.price || '';
  if (stockInput) stockInput.value = item.stock !== undefined ? item.stock : 0;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
};
window.openEditProductModal = window.abrirModalEditar;


function cerrarModalEditar() {
  const modal = document.getElementById('modal-editar-producto');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  const form = document.getElementById('form-editar-producto');
  if (form) form.reset();
}

// ========================================================
// 3. ELIMINAR (window.eliminarProducto)
// ========================================================
window.eliminarProducto = async function(id) {
  const item = inventory.find(i => String(i.id) === String(id) || (!isNaN(i.id) && !isNaN(id) && Number(i.id) === Number(id)));
  if (!item) return;

  if (confirm(`¿Deseas eliminar/desactivar este producto?\n\n"${item.name}" (SKU: ${item.sku})`)) {
    try {
      const res = await apiFetch(`/productos/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.warn('Respuesta no exitosa al desactivar producto:', errData);
      }
    } catch (e) {
      console.warn('Error en la llamada DELETE /api/productos/:id, aplicando fallback local:', e);
    }

    // Fallback local y actualización reactiva
    inventory = inventory.filter(i => String(i.id) !== String(id) && (!(!isNaN(i.id) && !isNaN(id)) || Number(i.id) !== Number(id)));
    saveInventoryData();
    await window.cargarInventario();
    showToast(`Producto "${item.name}" desactivado del inventario`, 'info');
  }
};
window.deleteProduct = window.eliminarProducto;

// ========================================================
// CONFIGURAR LISTENERS DE LA INTERFAZ
// ========================================================
function setupEventListeners() {
  // Filtros reactivos
  const searchInput = document.getElementById('inv-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderInventoryTable);
  }

  const stockFilter = document.getElementById('inv-filter-stock');
  if (stockFilter) {
    stockFilter.addEventListener('change', renderInventoryTable);
  }

  // Delegación de eventos para acciones de la tabla (.btn-reabastecer, .btn-editar, .btn-eliminar)
  const tbody = document.getElementById('inventory-table-body');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const btnReabastecer = e.target.closest('.btn-reabastecer');
      if (btnReabastecer) {
        const id = btnReabastecer.dataset.id;
        if (id) window.abrirModalReabastecer(id);
        return;
      }

      const btnEditar = e.target.closest('.btn-editar');
      if (btnEditar) {
        const id = btnEditar.dataset.id;
        if (id) window.abrirModalEditar(id);
        return;
      }

      const btnEliminar = e.target.closest('.btn-eliminar');
      if (btnEliminar) {
        const id = btnEliminar.dataset.id;
        if (id) window.eliminarProducto(id);
        return;
      }
    });
  }

  // Input de reabastecimiento reactivo
  const restockQtyInput = document.getElementById('reabastecer-cantidad') || document.getElementById('restock-add-qty');
  if (restockQtyInput) {
    restockQtyInput.addEventListener('input', updateRestockCalculation);
  }

  // Cerrar Modal Reabastecer
  const btnCloseReabastecer = document.getElementById('btn-close-reabastecer') || document.getElementById('btn-close-restock');
  const btnCancelReabastecer = document.getElementById('btn-cancel-reabastecer') || document.getElementById('btn-cancel-restock');
  if (btnCloseReabastecer) btnCloseReabastecer.addEventListener('click', cerrarModalReabastecer);
  if (btnCancelReabastecer) btnCancelReabastecer.addEventListener('click', cerrarModalReabastecer);

  // Confirmar Reabastecimiento: Envía PATCH /api/productos/:id/stock
  const btnConfirmReabastecer = document.getElementById('btn-confirm-reabastecer') || document.getElementById('btn-confirm-restock');
  if (btnConfirmReabastecer) {
    btnConfirmReabastecer.addEventListener('click', async () => {
      if (!currentRestockItem) return;

      const itemId = currentRestockItem.id;
      const itemName = currentRestockItem.name;

      const qtyInput = document.getElementById('reabastecer-cantidad') || document.getElementById('restock-add-qty');
      const addVal = parseInt(qtyInput ? qtyInput.value : 0, 10) || 0;
      if (addVal <= 0) {
        showToast('Introduce una cantidad válida para agregar', 'warning');
        return;
      }

      btnConfirmReabastecer.disabled = true;
      btnConfirmReabastecer.textContent = 'Guardando...';

      try {
        const res = await apiFetch(`/productos/${itemId}/stock`, {
          method: 'PATCH',
          body: JSON.stringify({
            cantidad: addVal,
            cantidadAgregar: addVal
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Respuesta no exitosa al reabastecer stock en backend:', errData);
        }
      } catch (e) {
        console.warn('Error al llamar PATCH /api/productos/:id/stock, aplicando fallback local:', e);
      } finally {
        btnConfirmReabastecer.disabled = false;
        btnConfirmReabastecer.textContent = 'Confirmar Ingreso';
      }

      // Actualizar fallback local
      const targetLocal = inventory.find(i => String(i.id) === String(itemId) || (!isNaN(i.id) && !isNaN(itemId) && Number(i.id) === Number(itemId)));
      if (targetLocal) {
        targetLocal.stock += addVal;
        saveInventoryData();
      }

      cerrarModalReabastecer();
      await window.cargarInventario();
      showToast(`¡Inventario actualizado! +${addVal} uds a "${itemName}"`, 'success');
    });
  }

  // Cerrar Modal Editar
  const btnCloseEditar = document.getElementById('btn-close-editar');
  const btnCancelEditar = document.getElementById('btn-cancel-editar');
  if (btnCloseEditar) btnCloseEditar.addEventListener('click', cerrarModalEditar);
  if (btnCancelEditar) btnCancelEditar.addEventListener('click', cerrarModalEditar);

  // Formulario Editar Producto (#form-editar-producto): Envía PUT /api/productos/:id
  const formEditar = document.getElementById('form-editar-producto');
  if (formEditar) {
    formEditar.addEventListener('submit', async (e) => {
      e.preventDefault();

      const editId = document.getElementById('editar-id').value;
      const name = document.getElementById('editar-nombre').value.trim();
      const category = document.getElementById('editar-categoria').value;
      const platform = (document.getElementById('editar-plataforma')?.value || '').trim().toUpperCase();
      const status = document.getElementById('editar-tipo').value;
      const releaseDate = (document.getElementById('editar-fecha-estreno')?.value || '').trim();
      const sku = (document.getElementById('editar-sku')?.value || '').trim().toUpperCase();
      const price = parseFloat(document.getElementById('editar-precio').value) || 0;
      const stock = parseInt(document.getElementById('editar-stock').value, 10) || 0;

      const isPreventa = category === 'preventa' || status === 'preventa';

      let catId = 2; // Videojuegos por defecto
      if (category === 'consoles') catId = 1;
      else if (category === 'games' || category === 'preventa') catId = 2;
      else if (category === 'accessories') catId = 3;
      else if (category === 'pines') catId = 4;

      try {
        const res = await apiFetch(`/productos/${editId}`, {
          method: 'PUT',
          body: JSON.stringify({
            nombre: name,
            precio: price,
            stock: stock,
            idCategoria: catId,
            codigo: sku,
            esDigital: category === 'pines'
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Respuesta no exitosa al actualizar producto en backend:', errData);
        }
      } catch (err) {
        console.warn('Error al llamar PUT /api/productos/:id, aplicando fallback local:', err);
      }

      const existing = inventory.find(i => String(i.id) === String(editId) || (!isNaN(i.id) && !isNaN(editId) && Number(i.id) === Number(editId)));
      if (existing) {
        existing.name = name;
        existing.category = category;
        existing.platform = platform || existing.platform;
        existing.status = status;
        existing.isPreventa = isPreventa;
        existing.releaseDate = releaseDate || '';
        existing.sku = sku || existing.sku;
        existing.codigo = sku || existing.codigo;
        existing.price = price;
        existing.stock = stock;
      }

      saveInventoryData();
      cerrarModalEditar();
      await window.cargarInventario();
      showToast(`¡"${name}" actualizado exitosamente!`, 'success');
    });
  }

  // Modal Registrar Nuevo Producto (#create-modal)
  const btnOpenCreate = document.getElementById('btn-open-create-modal');
  const btnCloseCreate = document.getElementById('btn-close-create');
  const btnCancelCreate = document.getElementById('btn-cancel-create');
  const createModal = document.getElementById('create-modal');
  const createForm = document.getElementById('create-product-form');
  const categorySelect = document.getElementById('new-product-category');
  const statusSelect = document.getElementById('new-product-status');

  if (categorySelect) categorySelect.addEventListener('change', updateReleaseDateRequirement);
  if (statusSelect) statusSelect.addEventListener('change', updateReleaseDateRequirement);

  const openCreate = () => {
    if (createForm) createForm.reset();
    const editIdInput = document.getElementById('edit-product-id');
    if (editIdInput) editIdInput.value = '';
    const title = document.getElementById('modal-product-title');
    const submitBtn = document.getElementById('btn-submit-create');
    if (title) title.textContent = 'Alta de Nuevo Producto al Inventario';
    if (submitBtn) submitBtn.textContent = 'Guardar en Inventario';
    updateReleaseDateRequirement();
    if (createModal) {
      createModal.classList.remove('hidden');
      createModal.classList.add('flex');
    }
  };

  const closeCreate = () => {
    if (createModal) {
      createModal.classList.add('hidden');
      createModal.classList.remove('flex');
    }
    if (createForm) createForm.reset();
    const editIdInput = document.getElementById('edit-product-id');
    if (editIdInput) editIdInput.value = '';
    updateReleaseDateRequirement();
  };

  if (btnOpenCreate) btnOpenCreate.addEventListener('click', openCreate);
  if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeCreate);
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeCreate);

  // Guardar Nuevo Producto (POST /api/productos)
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('new-product-name').value.trim();
      const category = document.getElementById('new-product-category').value;
      const platform = document.getElementById('new-product-platform').value.trim().toUpperCase();
      const status = document.getElementById('new-product-status').value;
      const releaseDate = document.getElementById('new-product-release-date').value.trim();
      const sku = document.getElementById('new-product-sku').value.trim().toUpperCase();
      const price = parseFloat(document.getElementById('new-product-price').value) || 0;
      const stock = parseInt(document.getElementById('new-product-stock').value, 10) || 0;

      const isPreventa = category === 'preventa' || status === 'preventa';

      if (isPreventa && !releaseDate) {
        showToast('La Fecha de Lanzamiento es obligatoria para productos en Preventa', 'warning');
        const dateInput = document.getElementById('new-product-release-date');
        if (dateInput) dateInput.focus();
        return;
      }

      let prodId = 'prod_' + Date.now();
      let catId = 2; // Videojuegos por defecto
      if (category === 'consoles') catId = 1;
      else if (category === 'games' || category === 'preventa') catId = 2;
      else if (category === 'accessories') catId = 3;
      else if (category === 'pines') catId = 4;

      try {
        const res = await apiFetch('/productos', {
          method: 'POST',
          body: JSON.stringify({
            codigo: sku,
            nombre: name,
            precio: price,
            stock: stock,
            idCategoria: catId,
            esDigital: category === 'pines'
          })
        });
        if (res.ok) {
          const backendProd = await res.json();
          prodId = backendProd.id;
        }
      } catch (err) {
        console.warn('Error al registrar producto en backend, guardando en local:', err);
      }

      const newProduct = {
        id: prodId,
        name,
        category,
        platform,
        status,
        isPreventa,
        releaseDate: releaseDate || '',
        sku,
        codigo: sku,
        price,
        stock
      };
      inventory.unshift(newProduct);
      saveInventoryData();
      closeCreate();
      await window.cargarInventario();
      showToast(`¡"${name}" agregado exitosamente al inventario!`, 'success');
    });
  }
}

// Toast Notifier
let invToastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('inv-toast');
  const toastMsg = document.getElementById('inv-toast-msg');
  if (!toast || !toastMsg) return;

  if (invToastTimer) clearTimeout(invToastTimer);

  toastMsg.textContent = msg;
  toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl text-xs sm:text-sm font-medium transition-all duration-300';

  if (type === 'success') {
    toast.classList.add('bg-emerald-950/90', 'border-emerald-500/50', 'text-emerald-200');
  } else if (type === 'error') {
    toast.classList.add('bg-rose-950/90', 'border-rose-500/50', 'text-rose-200');
  } else if (type === 'warning') {
    toast.classList.add('bg-amber-950/90', 'border-amber-500/50', 'text-amber-200');
  } else {
    toast.classList.add('bg-purple-950/90', 'border-purple-500/50', 'text-purple-200');
  }

  toast.classList.remove('hidden');
  invToastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
