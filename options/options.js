const $ = s => document.querySelector(s);
const b = globalThis.browser ?? globalThis.chrome;

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

// ... (Les fonctions timeoutStatus et setPopupStatus sont identiques à celles de popup.js) ...
function setPopupStatus(message = '', type = 'info', ms = 5000) {
  // (Copier la fonction de popup.js)
}

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
  setPopupStatus('Test de connexion...', 'info');
  const res = await b.runtime.sendMessage({ type: 'API_HEALTH_CHECK' });
  
  if (res.status === 200) {
    if (res.meta.identifier !== 'passmanager_api') {
      setPopupStatus(`API connectée<br>Identifier non reconnu (= ${res.meta.identifier})`, 'warning');
    } else {
      setPopupStatus(`API connectée (v${res.meta.version})`, 'success');
    }
  } else {
    setPopupStatus(res.message || `Erreur: ${res.status}`, 'danger');
  }
}

// ... (La fonction setTtlInputGroup est bonne, on la garde) ...
function setTtlInputGroup() {
  // (Ton code existant)
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

// ... (La fonction setTheme est bonne) ...
async function setTheme() { /* ... */ }

// Vérifie l'état de la session
async function loadUserSession() {
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  if (res.ok && res.isLoggedIn) {
     // Si tu veux rediriger vers app/settings.html, fais-le ici
     // window.location.href = "../app/settings.html";
     hideLogin();
     const { pm_username } = await b.storage.local.get('pm_username');
     usernameInput.value = pm_username || '';
  } else {
    showLogin();
  }
}

// ... (La fonction loadExtensionVersion est bonne) ...
async function loadExtensionVersion() { /* ... */ }

async function saveApiParams() {
  let apiBase = urlAPI.value.trim();
  if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);
    
  let ttl = jwtTTL.value === 'custom' ? Number(customTTL.value) : Number(jwtTTL.value);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) {
    setPopupStatus('Invalid: TTL doit être un entier entre 1 et 1440', 'danger');
    return false;
  }
  
  const res = await b.runtime.sendMessage({ type: 'SAVE_CONFIG', pm_api: apiBase, pm_ttl: ttl });
  return res.ok;
}

// --- Événements ---
toggleThemeBtn.addEventListener('click', async () => { /* ... */ });
jwtTTL.addEventListener('change', () => setTtlInputGroup());

// Login
loginBtn.addEventListener('click', async () => {
  if (!await saveApiParams()) return; // Sauvegarde d'abord
  setPopupStatus('Connexion...', 'info');
  
  const res = await b.runtime.sendMessage({
    type: 'LOGIN',
    username: usernameInput.value,
    password: passwordInput.value
  });
  
  if (res.ok) {
    setPopupStatus('Connecté', 'success');
    loadUserSession(); // Met à jour l'UI
  } else {
    setPopupStatus(res.error, 'danger');
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
  if (!await saveApiParams()) return; // Sauvegarde d'abord
  setPopupStatus('Création...', 'info');

  const res = await b.runtime.sendMessage({
    type: 'SIGNUP',
    username: usernameInput.value,
    password: passwordInput.value
  });
  
  if (res.ok) {
    setPopupStatus(res.message || 'Compte créé.', 'success');
    passwordInput.value = '';
  } else {
    setPopupStatus(res.error, 'danger');
  }
});

// ... (Listeners 'keydown' pour login/signup) ...

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