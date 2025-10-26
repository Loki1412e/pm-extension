const $ = s => document.querySelector(s);
const b = globalThis.browser ?? globalThis.chrome;

const ACTUAL_PAGE = window.location.pathname.split('/').pop().split('.')[0];

const html = document.documentElement;
const alertSection = $('#alertSection');
const logoutBtn = $('#logout');
const pmVersion = $('#pmVersion');

const loginSection = $('#loginSection');
const usernameInput = $('#username');
const passwordInput = $('#password');
const loginBtn = $('#login');
const signupBtn = $('#signup');

const urlAPI = $('#urlAPI'); // Assure-toi que cet ID existe dans ton HTML
const ttlInputGroup = $('#ttlInputGroup');
const jwtTTL = $('#jwtTTL');
const customTTL = $('#customTTL');
const saveBtn = $('#save');
const DEFAULT_JWT_TTL = 10;

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIconId');
const iconClass = { 'dark': 'bi bi-sun pe-2', 'light': 'bi bi-moon-stars me-2', 'auto': 'bi bi-moon-stars me-2' };

// --- Fonctions ---

// Affichage du status
const statusTypes = ['primary', 'secondary', 'success', 'danger', 'warning',  'info', 'light', 'dark'];
let statusTimeoutId = null;
const TIME_TIMEOUT = 5000; // 1000 ms = 1s

function timeoutStatus(elem, ms=TIME_TIMEOUT) {
  statusTimeoutId = setTimeout(() => {
    elem.classList = 'd-none';
    statusTimeoutId = null;
  }, ms);
}

// timeoutMs = 0 pour pas de timeout
function setPopupStatus(message='', type='info', timeoutMs=TIME_TIMEOUT) {
  if (!alertSection) return;
  if (!message || message === '') {
    alertSection.classList = 'd-none';
    return;
  }
  
  if (!statusTypes.includes(type)) type = 'dark';

  alertSection.innerHTML = message;
  alertSection.classList = `alert alert-${type} m-0 w-100`;

  if (timeoutMs === 0) return;
  timeoutStatus(alertSection, timeoutMs);
}

// Affiche ou cache la section de login
function showLogin() {
  logoutBtn.classList.add('d-none');
  loginSection.classList.remove('d-none');
}

function hideLogin() {
  logoutBtn.classList.remove('d-none');
  loginSection.classList.add('d-none');
}

// Teste la connexion à l'API via le background
async function testConnection() {
  setPopupStatus('Test de connexion...', 'info', 0);
  const res = await b.runtime.sendMessage({ type: 'API_HEALTH_CHECK' });

  if (res.ok === 200)
    setPopupStatus(`API connectée (v${res.meta.version})`, 'success');
  else
    setPopupStatus(res.message || `Erreur: ${res.status}`, 'danger', 0);
}

function setTtlInputGroup() {
  if (jwtTTL.value !== 'custom') {
    customTTL.classList.add('d-none');
    ttlInputGroup.classList.remove('input-group');
    jwtTTL.style.flex = '';
    return;
  }
  customTTL.classList.remove('d-none');
  ttlInputGroup.classList.add('input-group');
  jwtTTL.style.flex = '0 0 40%';
}

// Charge la config depuis le stockage
async function loadConfig() {
  const res = await b.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (!res.ok) return;

  let { pm_api, pm_ttl } = res;
  urlAPI.value = pm_api || 'https://localhost/pm/api'; // Mettre une valeur par défaut
  pm_ttl = Number(pm_ttl) || DEFAULT_JWT_TTL;
  
  const isCustom = !Array.from(jwtTTL.options).some(opt => opt.value === String(pm_ttl));
  jwtTTL.value = isCustom ? 'custom' : String(pm_ttl);
  customTTL.value = isCustom ? pm_ttl : '';
  
  setTtlInputGroup();
}

// Changer le thème
async function setTheme() {
  let { pm_theme } = await chrome.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  if (!toggleThemeIcon) return;
  toggleThemeIcon.classList = iconClass[pm_theme];
  if (pm_theme === 'dark') toggleThemeIcon.style.fontSize = '1.2rem';
  else toggleThemeIcon.style.fontSize = '1rem';
}

// Vérifie si le JWT est valide au lancement
async function loadUserSession() {
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  if (res.ok && res.isLoggedIn) {
    window.location.href = "../app/settings.html";
    //  hideLogin();
    //  const { pm_username } = await b.storage.local.get('pm_username');
    //  usernameInput.value = pm_username || '';
  } else {
    showLogin();
  }
}

// Charge la version de l'extension
async function loadExtensionVersion() {
  if (chrome.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    pmVersion.textContent = !manifest.version ? 'UNKNOW VERSION' : `v${manifest.version}`;
  }
}

async function saveApiParams() {
  let apiBase = urlAPI.value.trim();
  if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);
    
  let ttl = jwtTTL.value === 'custom' ? Number(customTTL.value) : Number(jwtTTL.value);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) {
    setPopupStatus('Invalid: TTL doit être un entier entre 1 et 1440', 'danger', 0);
    return false;
  }
  
  const res = await b.runtime.sendMessage({ type: 'SAVE_CONFIG', pm_api: apiBase, pm_ttl: ttl });
  return res.ok;
}

// --- Événements ---

// Toggle Theme
toggleThemeBtn.addEventListener('click', async () => {
  const { pm_theme } = await chrome.storage.local.get('pm_theme');
  const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ pm_theme: newTheme });
  setTheme();
});

// Changement du Select pour TTL
jwtTTL.addEventListener('change', () => {
  setTtlInputGroup();
});

// Login
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
loginBtn.addEventListener('click', async () => {
  if (!await saveApiParams()) return; // Sauvegarde d'abord
  setPopupStatus('Connexion...', 'info', 0);
  
  const res = await b.runtime.sendMessage({
    type: 'LOGIN',
    username: usernameInput.value,
    password: passwordInput.value
  });
  
  if (res.ok) {
    setPopupStatus('Connecté', 'success');
    loadUserSession(); // Met à jour l'UI
  } else {
    setPopupStatus(res.error, 'danger', 0);
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
  if (!await saveApiParams()) return; // Sauvegarde d'abord
  setPopupStatus('Création...', 'info', 0);

  const res = await b.runtime.sendMessage({
    type: 'SIGNUP',
    username: usernameInput.value,
    password: passwordInput.value
  });
  
  if (res.ok) {
    setPopupStatus(res.message || 'Compte créé.', 'success');
    passwordInput.value = '';
  } else {
    setPopupStatus(res.error, 'danger', 0);
  }
});

// Sauvegarde la config
saveBtn.addEventListener('click', async () => {
  if (await saveApiParams()) {
    await testConnection();
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await b.runtime.sendMessage({ type: 'LOGOUT' });
  setPopupStatus('Déconnecté', 'info');
  loadUserSession();
});

//== Au lancement ==//
setTheme();
loadExtensionVersion();
loadConfig();
loadUserSession();
testConnection(); // Teste la connexion au chargement