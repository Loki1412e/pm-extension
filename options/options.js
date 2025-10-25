import { PM_vault, PM_deriveKey } from '../background.js';
import { ApiClient } from '../apiClient.js';
const api = new ApiClient();

const $ = s => document.querySelector(s);
const html = document.documentElement;

const alertSection = $('#alertSection');
const logoutBtn = $('#logout');
const pmVersion = $('#pmVersion');

const loginSection = $('#loginSection');
const usernameInput = $('#username');
const passwordInput = $('#password');
const loginBtn = $('#login');
const signupBtn = $('#signup');

const ttlInputGroup = $('#ttlInputGroup');
const jwtTTL = $('#jwtTTL'); // JWT ttl en minutes
const customTTL = $('#customTTL');
const saveBtn = $('#save');
const DEFAULT_JWT_TTL = 10; // minutes

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIcon');
const iconClass = { 'dark': 'bi bi-sun pe-2', 'light': 'bi bi-moon-stars me-2', 'auto': 'bi bi-moon-stars me-2' };

const statusTypes = ['primary', 'secondary', 'success', 'danger', 'warning',  'info', 'light', 'dark'];
let statusTimeoutId = null;
const TIME_TIMEOUT = 5000; // 1000 ms = 1s

function timeoutStatus(elem, ms) {
  statusTimeoutId = setTimeout(() => {
    elem.classList = 'd-none';
    statusTimeoutId = null;
  }, ms);
}

// Affichage du status
function setPopupStatus(message='', type='info') {
  if (!alertSection) return;
  if (!message || message === '') {
    alertSection.classList = 'd-none';
    return;
  }
  
  if (!statusTypes.includes(type)) type = 'dark';

  alertSection.innerHTML = message;
  alertSection.classList = `alert alert-${type} m-0 w-100`;

  if (type === 'danger') return;

  let timout = TIME_TIMEOUT;
  if (type === 'warning') timout *= 2;
  timeoutStatus(alertSection, timout);
}

async function showLogin() {
  logoutBtn.classList.add('d-none');
  loginSection.classList.remove('d-none');
  const { pm_username } = await chrome.storage.local.get('pm_username');
  usernameInput.value = pm_username || '';
  passwordInput.value = '';
}

function hideLogin() {
  logoutBtn.classList.remove('d-none');
  loginSection.classList.add('d-none');
  usernameInput.value = '';
  passwordInput.value = '';
}

// Teste la connexion à l'API
async function testConnection() {
  try {
    const res = await api.healthCheck();
    if (res.status < 200 || res.status >= 300) throw new Error(res.message || JSON.stringify(res));    
    
    if (res.meta.identifier !== 'passmanager_api') setPopupStatus(`API connectée<br>Identifier non reconnu (= ${res.meta.identifier})`, 'warning');
    else setPopupStatus(`API connectée`, 'success');
    
    return true;
  } catch (e) {
    setPopupStatus(`${e.message}`, 'danger');
    return false;
  }
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
  let { pm_api, pm_ttl } = await chrome.storage.local.get(['pm_api', 'pm_ttl']);
  urlAPI.value = pm_api || '';
  pm_ttl = Number(pm_ttl) || DEFAULT_JWT_TTL;
  
  const isCustom = !Array.from(jwtTTL.options).some(opt => opt.value === String(pm_ttl))

  jwtTTL.value = isCustom ? 'custom' : String(pm_ttl)
  customTTL.value = isCustom ? pm_ttl : '';
  
  setTtlInputGroup();
}

// Changer le thème
async function setTheme() {
  let { pm_theme } = await chrome.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  toggleThemeIcon.classList = iconClass[pm_theme];
  if (pm_theme === 'dark') toggleThemeIcon.style.fontSize = '1.2rem';
  else toggleThemeIcon.style.fontSize = '1rem';
}

// Vérifie si le JWT est valide au lancement
async function loadUserSession() {
  const { pm_jwt } = await chrome.storage.local.get(['pm_jwt']);

  if (!pm_jwt) {
    showLogin();
    return;
  }

  try {
    const res = await api.readUser(pm_jwt);

    if (res.status < 200 || res.status >= 300) throw new Error(res.message || 'Session invalide');
    const user = res.user;

    await chrome.storage.local.set({ pm_username: user.username });
    
    window.location.href = "../app/settings.html"; // finalement on va rediriger vers les params
    
    hideLogin();

  } catch(e) {
    await chrome.storage.local.set({ pm_jwt: null });
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
    setPopupStatus('Invalid: TTL doit être un entier entre 1 et 1440', 'danger');
    return;
  }
  
  await chrome.storage.local.set({ pm_api: apiBase, pm_ttl: ttl });  
}

// Toggle Theme
toggleThemeBtn.addEventListener('click', async () => {
  const { pm_theme } = await chrome.storage.local.get('pm_theme');
  const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ pm_theme: newTheme });
  setTheme();
});

// Select
jwtTTL.addEventListener('change', async () => {
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
  try {
    await saveApiParams();
    await chrome.storage.local.set({ pm_username: usernameInput.value });

    let { pm_ttl } = await chrome.storage.local.get(['pm_ttl']);
    
    const res = await api.login(usernameInput.value, passwordInput.value, pm_ttl || null);
    if (res.status < 200 || res.status >= 300) throw new Error(res.message || `Erreur: ${res.status}`);
    await chrome.storage.local.set({ pm_jwt: res.token });
    PM_vault.credentials = res.credentials;

    setPopupStatus('Connecté', 'success');
    window.location.href = "../app/settings.html";

  } catch (e) {
    setPopupStatus(e.message, 'danger');
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
  try {
    await saveApiParams();
    await chrome.storage.local.set({ pm_username: usernameInput.value });
    const res = await api.signup(usernameInput.value, passwordInput.value);
    if (res.status < 200 || res.status >= 300) throw new Error(res.message || `Erreur: ${res.status}`);
    passwordInput.value = '';
    setPopupStatus('Compte créé. Connectez-vous.', 'success');
    await chrome.storage.local.set({ pm_username: usernameInput.value });
  } catch (e) {
    setPopupStatus(e.message, 'danger');
  }
});

// Sauvegarde la config
urlAPI.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});
customTTL.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});
saveBtn.addEventListener('click', async () => {
  await saveApiParams();
  await testConnection();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ pm_jwt: null });
  window.location.href = window.location.href;
});

//== Au lancement ==//
setTheme();
loadExtensionVersion();
loadConfig();
loadUserSession();