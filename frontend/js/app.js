// Constante global de conexión a la API
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

  if ((method === 'POST' || method === 'PUT') && !headers['Content-Type'] && !headers['content-type']) {
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

// Estado global y configuración
const ADMIN_MASTER_KEY = "1234";

// Sistema de sonido retro/cyber con Web Audio API (no requiere archivos externos)
class CyberAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
  }

  playBlip(freq = 600, duration = 0.08) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + duration);
      
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio no soportado o bloqueado
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Fanfare de logro)
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (index * 0.09));
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime + (index * 0.09));
        gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + (index * 0.09) + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (index * 0.09) + 0.25);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + (index * 0.09));
        osc.stop(this.ctx.currentTime + (index * 0.09) + 0.25);
      });
    } catch (e) {}
  }

  playError() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  }
}

const audio = new CyberAudio();

// Inicialización de usuarios por defecto en LocalStorage
function initDatabase() {
  const existingUsers = localStorage.getItem('gamevault_users');
  if (!existingUsers) {
    const defaultUsers = [
      {
        id: 'usr_admin',
        fullname: 'Daniela Blanco',
        username: 'admin',
        email: 'admin@gamevault.com',
        password: 'admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'usr_emp',
        fullname: 'José Cabrales',
        username: 'empleado',
        email: 'jose.cabrales@gamevault.com',
        password: '123',
        role: 'empleado',
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem('gamevault_users', JSON.stringify(defaultUsers));
  }
}

// Elementos DOM
document.addEventListener('DOMContentLoaded', () => {
  initDatabase();

  // Tabs
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const viewLogin = document.getElementById('view-login');
  const viewRegister = document.getElementById('view-register');

  // Formulario Login
  const loginForm = document.getElementById('login-form');
  const loginIdentifier = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');

  // Formulario Registro
  const registerForm = document.getElementById('register-form');
  const regFullName = document.getElementById('reg-fullname');
  const regUsername = document.getElementById('reg-username');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const regConfirmPassword = document.getElementById('reg-confirm-password');

  // Selector de Rol
  const roleEmployee = document.getElementById('role-employee');
  const roleAdmin = document.getElementById('role-admin');
  const adminKeyContainer = document.getElementById('admin-key-container');
  const regAdminKey = document.getElementById('reg-admin-key');
  const adminKeyHint = document.getElementById('admin-key-hint');
  const adminKeyIcon = document.getElementById('admin-key-icon');

  // Sonido toggle
  const soundToggleBtn = document.getElementById('btn-sound-toggle');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  // Modal de bienvenida / HUD
  const hudModal = document.getElementById('hud-success-modal');
  const hudUserName = document.getElementById('hud-user-name');
  const hudUserRole = document.getElementById('hud-user-role');
  const hudRoleBadge = document.getElementById('hud-role-badge');
  const hudPermissionsList = document.getElementById('hud-permissions-list');
  const btnCloseHud = document.getElementById('btn-close-hud');

  // Notificaciones Toast
  const toastNotification = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  let activeRole = 'empleado'; // 'empleado' | 'admin'

  // --- Cambio de Pestañas (Login / Registro) ---
  function switchTab(target) {
    audio.playBlip(750, 0.06);
    if (target === 'login') {
      tabLogin.classList.add('tab-active');
      tabLogin.classList.remove('tab-inactive');
      tabRegister.classList.remove('tab-active');
      tabRegister.classList.add('tab-inactive');

      viewLogin.classList.remove('hidden');
      viewRegister.classList.add('hidden');
    } else {
      tabRegister.classList.add('tab-active');
      tabRegister.classList.remove('tab-inactive');
      tabLogin.classList.remove('tab-active');
      tabLogin.classList.add('tab-inactive');

      viewLogin.classList.add('hidden');
      viewRegister.classList.remove('hidden');
    }
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  // Enlaces de pie de formulario para alternar
  const linkToRegister = document.getElementById('link-to-register');
  const linkToLogin = document.getElementById('link-to-login');
  if (linkToRegister) linkToRegister.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
  if (linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

  // --- Selección de Rol (Empleado vs Administrador) ---
  function updateRoleSelection(role) {
    activeRole = role;
    audio.playBlip(550, 0.05);

    if (role === 'admin') {
      // Activar Admin
      roleAdmin.classList.add('border-purple-500', 'bg-purple-950/40', 'shadow-[0_0_15px_rgba(168,85,247,0.3)]');
      roleAdmin.classList.remove('border-slate-800', 'bg-slate-900/60');
      
      // Desactivar Empleado
      roleEmployee.classList.remove('border-cyan-500', 'bg-cyan-950/40', 'shadow-[0_0_15px_rgba(6,182,212,0.3)]');
      roleEmployee.classList.add('border-slate-800', 'bg-slate-900/60');

      // Mostrar contenedor de clave especial con animación
      adminKeyContainer.classList.remove('hidden');
      adminKeyContainer.classList.add('flex');
      regAdminKey.setAttribute('required', 'true');
      regAdminKey.focus();
    } else {
      // Activar Empleado
      roleEmployee.classList.add('border-cyan-500', 'bg-cyan-950/40', 'shadow-[0_0_15px_rgba(6,182,212,0.3)]');
      roleEmployee.classList.remove('border-slate-800', 'bg-slate-900/60');

      // Desactivar Admin
      roleAdmin.classList.remove('border-purple-500', 'bg-purple-950/40', 'shadow-[0_0_15px_rgba(168,85,247,0.3)]');
      roleAdmin.classList.add('border-slate-800', 'bg-slate-900/60');

      // Ocultar contenedor de clave especial
      adminKeyContainer.classList.add('hidden');
      adminKeyContainer.classList.remove('flex');
      regAdminKey.removeAttribute('required');
      regAdminKey.value = '';
      resetAdminKeyHint();
    }
  }

  roleEmployee.addEventListener('click', () => updateRoleSelection('empleado'));
  roleAdmin.addEventListener('click', () => updateRoleSelection('admin'));

  // Validación reactiva de la clave de Administrador
  function resetAdminKeyHint() {
    adminKeyHint.textContent = 'Se requiere autorización para registrar una cuenta de Administrador.';
    adminKeyHint.className = 'text-xs text-purple-300/80 mt-1.5 flex items-center gap-1.5';
    if (adminKeyIcon) adminKeyIcon.className = 'w-4 h-4 text-purple-400';
  }

  regAdminKey.addEventListener('input', () => {
    const val = regAdminKey.value.trim();
    if (val === ADMIN_MASTER_KEY) {
      adminKeyHint.innerHTML = `<span class="text-emerald-400 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-check text-xs"></i> Clave verificada. Acceso Administrador autorizado.</span>`;
      regAdminKey.classList.remove('border-red-500', 'focus:border-red-500');
      regAdminKey.classList.add('border-emerald-500', 'focus:border-emerald-500');
      audio.playBlip(900, 0.04);
    } else if (val.length > 0) {
      adminKeyHint.innerHTML = `<span class="text-slate-400 flex items-center gap-1"><svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Verificando credencial de seguridad...</span>`;
      regAdminKey.classList.remove('border-emerald-500');
    } else {
      resetAdminKeyHint();
    }
  });

  // --- Manejo del Registro de Usuarios ---
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = regFullName.value.trim();
    const username = regUsername.value.trim().toLowerCase();
    const email = regEmail.value.trim().toLowerCase();
    const password = regPassword.value;
    const confirmPassword = regConfirmPassword.value;
    const adminKey = regAdminKey.value.trim();

    // Validar contraseñas
    if (password !== confirmPassword) {
      audio.playError();
      showToast('Las contraseñas no coinciden', 'error');
      regConfirmPassword.focus();
      return;
    }

    if (password.length < 3) {
      audio.playError();
      showToast('La contraseña debe tener al menos 3 caracteres', 'error');
      return;
    }

    // Si es Administrador, verificar la clave maestra
    if (activeRole === 'admin') {
      if (adminKey !== ADMIN_MASTER_KEY) {
        audio.playError();
        adminKeyContainer.classList.add('shake');
        regAdminKey.classList.add('border-red-500');
        adminKeyHint.innerHTML = `<span class="text-rose-400 font-bold flex items-center gap-1.5"><i class="fa-solid fa-xmark text-xs"></i> Clave Maestra Incorrecta. Acceso denegado.</span>`;
        showToast('Clave maestra incorrecta para rol Administrador', 'error');
        setTimeout(() => adminKeyContainer.classList.remove('shake'), 450);
        regAdminKey.focus();
        return;
      }
    }

    // Intentar registrar en el backend POST /api/auth/registro
    try {
      const response = await apiFetch('/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          nombreCompleto: fullName,
          username: username,
          password: password,
          rol: activeRole === 'admin' ? 'ADMINISTRADOR' : 'EMPLEADO'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar en el servidor');
      }

      audio.playSuccess();
      showToast(`¡Usuario ${activeRole === 'admin' ? 'Administrador' : 'Empleado'} registrado en el servidor!`, 'success');

      // Sincronizar en localStorage también
      const users = JSON.parse(localStorage.getItem('gamevault_users') || '[]');
      users.push({
        id: 'usr_' + Date.now(),
        fullname: fullName,
        username: username,
        email: email,
        password: password,
        role: activeRole,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('gamevault_users', JSON.stringify(users));

      registerForm.reset();
      updateRoleSelection('empleado');
      switchTab('login');
      loginIdentifier.value = username;
      loginPassword.focus();
      return;
    } catch (err) {
      console.warn('Fallo registro en backend o usuario duplicado:', err.message);
      showToast(err.message, 'warning');
    }
  });

  // --- Manejo del Inicio de Sesión: POST /api/auth/login ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier = loginIdentifier.value.trim();
    const password = loginPassword.value;

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: identifier,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        audio.playError();
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 450);
        showToast(data.error || 'Credenciales inválidas. Revisa tu usuario y contraseña.', 'error');
        return;
      }

      // Login Exitoso con Backend
      audio.playSuccess();

      // Guardar token JWT en localStorage
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      const activeUser = {
        id: data.usuario?.id || 1,
        fullname: data.usuario?.nombreCompleto || data.usuario?.username || identifier,
        nombreCompleto: data.usuario?.nombreCompleto || identifier,
        username: data.usuario?.username || identifier,
        role: (data.usuario?.rol || '').toLowerCase() === 'administrador' ? 'admin' : 'empleado',
        rol: data.usuario?.rol || 'EMPLEADO'
      };

      localStorage.setItem('gamevault_active_user', JSON.stringify(activeUser));
      openHudModal(activeUser);

    } catch (error) {
      console.warn('Error de conexión con el backend:', error);
      // Fallback a usuarios locales si el servidor backend no responde
      const users = JSON.parse(localStorage.getItem('gamevault_users') || '[]');
      const foundUser = users.find(
        u => (u.username.toLowerCase() === identifier.toLowerCase() || (u.email && u.email.toLowerCase() === identifier.toLowerCase())) && u.password === password
      );

      if (!foundUser) {
        audio.playError();
        loginForm.classList.add('shake');
        setTimeout(() => loginForm.classList.remove('shake'), 450);
        showToast('Credenciales inválidas o servidor backend desconectado.', 'error');
        return;
      }

      audio.playSuccess();
      localStorage.setItem('gamevault_active_user', JSON.stringify(foundUser));
      openHudModal(foundUser);
    }
  });

  // --- Mostrar Modal HUD (Simulación de Acceso al Software) ---
  function openHudModal(user) {
    hudUserName.textContent = user.fullname || user.nombreCompleto || user.username;
    const roleLower = (user.role || user.rol || '').toLowerCase();
    const isAdmin = roleLower === 'admin' || roleLower === 'administrador';

    const btnHudInventory = document.getElementById('btn-hud-inventory');
    if (btnHudInventory) {
      if (isAdmin) {
        btnHudInventory.classList.remove('hidden');
      } else {
        btnHudInventory.classList.add('hidden');
      }
    }

    if (isAdmin) {
      hudUserRole.textContent = 'ADMINISTRADOR GENERAL';
      hudRoleBadge.className = 'px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-purple-500/30 bg-purple-500/10 text-purple-300 flex items-center gap-1.5';
      hudRoleBadge.innerHTML = `<i class="fa-solid fa-shield-halved text-xs"></i> <span>Acceso Master Total</span>`;

      hudPermissionsList.innerHTML = `
        <li class="flex items-center gap-2 text-slate-300"><span class="text-emerald-400 text-xs"><i class="fa-solid fa-check"></i></span> Módulo Inventario: Altas, bajas, importación y edición de stock</li>
        <li class="flex items-center gap-2 text-slate-300"><span class="text-emerald-400 text-xs"><i class="fa-solid fa-check"></i></span> Gestión de Precios, Ofertas y Catálogo de Videojuegos</li>
        <li class="flex items-center gap-2 text-slate-300"><span class="text-emerald-400 text-xs"><i class="fa-solid fa-check"></i></span> Control de Caja, Cierre de Turno y Reportes Financieros</li>
        <li class="flex items-center gap-2 text-slate-300"><span class="text-emerald-400 text-xs"><i class="fa-solid fa-check"></i></span> Administración de Cuentas de Empleados y Permisos</li>
      `;
    } else {
      hudUserRole.textContent = 'EMPLEADO / OPERADOR POS';
      hudRoleBadge.className = 'px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center gap-1.5';
      hudRoleBadge.innerHTML = `<i class="fa-solid fa-cash-register text-xs"></i> <span>Terminal de Punto de Venta</span>`;

      hudPermissionsList.innerHTML = `
        <li class="flex items-center gap-2 text-slate-300"><span class="text-cyan-400 text-xs"><i class="fa-solid fa-check"></i></span> Terminal de Ventas y Facturación Rápida (POS)</li>
        <li class="flex items-center gap-2 text-slate-300"><span class="text-cyan-400 text-xs"><i class="fa-solid fa-check"></i></span> Consulta de Inventario y Disponibilidad en tiempo real</li>
        <li class="flex items-center gap-2 text-slate-300"><span class="text-cyan-400 text-xs"><i class="fa-solid fa-check"></i></span> Registro de Apartados y Devoluciones de Clientes</li>
        <li class="flex items-center gap-2 text-slate-500"><span class="text-rose-400 text-xs"><i class="fa-solid fa-xmark"></i></span> Modificación de Precios Base (Requiere Admin)</li>
      `;
    }

    hudModal.classList.remove('hidden');
    hudModal.classList.add('flex');
  }

  if (btnCloseHud) {
    btnCloseHud.addEventListener('click', () => {
      audio.playBlip(600, 0.05);
      hudModal.classList.add('hidden');
      hudModal.classList.remove('flex');
    });
  }


  // --- Toggle Contraseña Visible / Oculta ---
  document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', () => {
      audio.playBlip(800, 0.04);
      const inputId = button.getAttribute('data-target');
      const input = document.getElementById(inputId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      // Cambiar icono
      const eyeIcon = button.querySelector('svg');
      if (eyeIcon) {
        if (isPassword) {
          eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          `;
        } else {
          eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          `;
        }
      }
    });
  });

  // --- Notificaciones Toast HUD ---
  let toastTimer = null;
  function showToast(message, type = 'info') {
    if (toastTimer) clearTimeout(toastTimer);

    toastMessage.textContent = message;

    // Configurar color y estilo según el tipo
    toastNotification.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100';

    if (type === 'success') {
      toastNotification.classList.add('bg-emerald-950/90', 'border-emerald-500/40', 'text-emerald-200');
      toastIcon.innerHTML = `
        <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
    } else if (type === 'error') {
      toastNotification.classList.add('bg-rose-950/90', 'border-rose-500/40', 'text-rose-200');
      toastIcon.innerHTML = `
        <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
    } else if (type === 'warning') {
      toastNotification.classList.add('bg-amber-950/90', 'border-amber-500/40', 'text-amber-200');
      toastIcon.innerHTML = `
        <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      `;
    } else {
      toastNotification.classList.add('bg-slate-900/90', 'border-cyan-500/40', 'text-cyan-200');
      toastIcon.innerHTML = `
        <svg class="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      `;
    }

    toastNotification.classList.remove('hidden');

    toastTimer = setTimeout(() => {
      toastNotification.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => {
        toastNotification.classList.add('hidden');
        toastNotification.classList.remove('opacity-0', 'translate-y-4');
      }, 300);
    }, 4000);
  }

  // --- Control de Sonido UI ---
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      audio.enabled = !audio.enabled;
      if (audio.enabled) {
        soundIconOn.classList.remove('hidden');
        soundIconOff.classList.add('hidden');
        soundToggleBtn.classList.add('text-cyan-400', 'border-cyan-500/40');
        soundToggleBtn.classList.remove('text-slate-500', 'border-slate-700');
        audio.playBlip(800, 0.05);
        showToast('Efectos de audio activados', 'info');
      } else {
        soundIconOn.classList.add('hidden');
        soundIconOff.classList.remove('hidden');
        soundToggleBtn.classList.remove('text-cyan-400', 'border-cyan-500/40');
        soundToggleBtn.classList.add('text-slate-500', 'border-slate-700');
        showToast('Efectos de audio desactivados', 'info');
      }
    });
  }
});
