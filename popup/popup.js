const $ = s => document.querySelector(s);
const b = globalThis.browser ?? globalThis.chrome;

const ACTUAL_PAGE = window.location.pathname.split('/').pop().split('.')[0];

// --- Sélecteurs ---
const html = document.documentElement;
const alertSection = $('#alertSection');
const loginSection = $('#loginSection');
const unlockSection = $('#unlockSection');
const mainSection = $('#mainSection');

const usernameInput = $('#username');
const passwordInput = $('#password');
const masterPasswordInput = $('#masterPassword');

const loginBtn = $('#login');
const signupBtn = $('#signup');
const unlockBtn = $('#unlockBtn');

const logoutBtn = $('#logout');
const optionsBtn = $('#options');
const vaultBtn = $('#vault');
const statisticBtn = $('#statistic');
const usernameElems = document.querySelectorAll('.session-username');

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIconId');
const iconClass = { 'dark': 'bi bi-brightness-high-fill', 'light': 'bi bi-moon-stars-fill', 'auto': 'bi bi-moon-stars-fill' };

// --- Fonctions ---

// Affichage du status
const statusTypes = ['primary', 'secondary', 'success', 'danger', 'warning',  'info', 'light', 'dark'];
let statusTimeoutId = null;
const TIME_TIMEOUT = 5000; // 1000 ms = 1s

function timeoutStatus(elem, ms = TIME_TIMEOUT) {
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

// --- Logique d'affichage ---
function showSection(section) {
  // Cacher tout
  loginSection.classList.add('d-none');
  unlockSection.classList.add('d-none');
  mainSection.classList.add('d-none');
  logoutBtn.classList.add('d-none');

  // Afficher la bonne
  if (section === 'login') {
    loginSection.classList.remove('d-none');
  } else if (section === 'unlock') {
    unlockSection.classList.remove('d-none');
    logoutBtn.classList.remove('d-none'); // On peut se déconnecter
  } else if (section === 'main') {
    mainSection.classList.remove('d-none');
    logoutBtn.classList.remove('d-none');
  }
}

// Met à jour l'UI en fonction du status
async function updateUI(status) {
  if (!status.isLoggedIn) {
    showSection('login');
    const { pm_username } = await b.storage.local.get('pm_username');
    if (pm_username) usernameInput.value = pm_username;
  } else if (!status.isVaultUnlocked) {
    showSection('unlock');
    masterPasswordInput.focus();
  } else {
    showSection('main');
    const { pm_username } = await b.storage.local.get('pm_username');
    usernameElems.forEach(elem => { elem.textContent = pm_username || 'USER'; });
  }
}

// Thème
async function setTheme() {
  let { pm_theme } = await b.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  toggleThemeIcon.classList = iconClass[pm_theme];
}
toggleThemeBtn.addEventListener('click', async () => {
  const { pm_theme } = await b.storage.local.get('pm_theme');
  const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
  await b.storage.local.set({ pm_theme: newTheme });
  setTheme();
});


// --- Événements ---

// Login
loginBtn.addEventListener('click', async () => {
  setPopupStatus('Connexion...', 'info', 0);
  const res = await b.runtime.sendMessage({
    type: 'LOGIN',
    username: usernameInput.value,
    password: passwordInput.value
  });

  if (res.ok) {
    setPopupStatus('Connecté', 'success');
    passwordInput.value = '';
    updateUI({ isLoggedIn: true, isVaultUnlocked: false }); // On passe direct à l'écran unlock
  } else {
    setPopupStatus(res.error, 'danger');
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
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
    setPopupStatus(res.error, 'danger');
  }
});

// Unlock
unlockBtn.addEventListener('click', async () => {
  setPopupStatus('Déverrouillage...', 'info', 0);
  const res = await b.runtime.sendMessage({
    type: 'UNLOCK_VAULT',
    masterPassword: masterPasswordInput.value
  });

  if (res.ok) {
    setPopupStatus('Coffre déverrouillé', 'success');
    masterPasswordInput.value = '';
    updateUI({ isLoggedIn: true, isVaultUnlocked: true });
  } else {
    setPopupStatus(res.error, 'danger');
    masterPasswordInput.select();
  }
});

// Touche "Entrée"
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });
});
masterPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockBtn.click();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await b.runtime.sendMessage({ type: 'LOGOUT' });
  setPopupStatus('Déconnecté', 'info');
  updateUI({ isLoggedIn: false, isVaultUnlocked: false });
});

// Boutons de navigation
vaultBtn.addEventListener('click', () => b.tabs.create({ url: 'app/vault.html' }));
statisticBtn.addEventListener('click', () => b.tabs.create({ url: 'app/statistic.html' }));
optionsBtn.addEventListener('click', () => b.runtime.openOptionsPage());

// --- Initialisation ---
async function init() {
  setTheme();
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  if (res.ok) {
    updateUI(res);
  } else {
    setPopupStatus(res.error, 'danger');
  }
}

init();