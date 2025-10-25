import { PM_vault, PM_deriveKey } from '../background.js';
import { ApiClient } from '../apiClient.js';
const api = new ApiClient();

const $ = s => document.querySelector(s);
const html = document.documentElement;

const loginSection = $('#loginSection');
const mainSections = document.querySelectorAll('.mainSections');
const usernameElems = document.querySelectorAll('.session-username');
const popupStatus = $('#popupStatus');
const usernameInput = $('#username');
const passwordInput = $('#password');
const loginBtn = $('#login');
const signupBtn = $('#signup');
const logoutBtn = $('#logout');
const optionsBtn = $('#options');
const vaultBtn = $('#vault');
const statisticBtn = $('#statistic');
const decryptBtn = $('#decryptBtn');

let validSession = false;

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIcon');
const iconClass = { 'dark': 'bi bi-brightness-high-fill', 'light': 'bi bi-moon-stars-fill', 'auto': 'bi bi-moon-stars-fill' };

const statusTypes = ['primary', 'secondary', 'success', 'danger', 'warning',  'info', 'light', 'dark'];

const TIME_TIMEOUT = 5000; // 1000 ms = 1s
let statusTimeoutId = null;

let actualPopupSection = null; // 'login' ou 'main'

function timeoutStatus(elem, ms) {
  statusTimeoutId = setTimeout(() => {
    elem.classList = 'd-none';
    statusTimeoutId = null;
  }, ms);
}

// Affichage du status
function setPopupStatus(message='', type='info') {
  if (!popupStatus) return;
  if (!message || message === '') {
    popupStatus.classList = 'd-none';
    return;
  }
  
  if (!statusTypes.includes(type)) type = 'dark';

  popupStatus.innerHTML = message;
  popupStatus.classList = `alert alert-${type} m-0`;

  if (type === 'danger') return;

  let timout = TIME_TIMEOUT;
  if (type === 'warning') timout *= 2;
  timeoutStatus(popupStatus, timout);
}

// Affichage des sections
async function showLogin() {
  if (actualPopupSection === 'login') return;
  const { pm_username } = await chrome.storage.local.get(['pm_username']);
  if (pm_username) usernameInput.value = pm_username;
  
  loginSection.classList.remove('d-none');
  
  mainSections.forEach(section => {
    section.classList.add('d-none');
  });
  
  actualPopupSection = 'login';
}

async function showMain() {
  if (actualPopupSection === 'main') return;
  const { pm_username } = await chrome.storage.local.get(['pm_username']);
  
  loginSection.classList.add('d-none');

  usernameElems.forEach(function(elem) {
    elem.textContent = pm_username || 'USER';
  });
  mainSections.forEach(section => {
    section.classList.remove('d-none');
  });
  
  actualPopupSection = 'main';
}

// Vérifie si le JWT est valide au lancement
async function loadUserSession() {
  const { pm_jwt, pm_username } = await chrome.storage.local.get(['pm_jwt', 'pm_username']);
  if (pm_username) usernameInput.value = pm_username;

  if (!pm_jwt) {
    validSession = false;
    showLogin();
    return;
  }

  try {
    const res = await api.readUser(pm_jwt);
    if (res.status < 200 || res.status >= 300) throw new Error(res.message || 'Session invalide');
    const user = res.user;
    
    await chrome.storage.local.set({ pm_username: user.username });
    // setPopupStatus('Session réstaurée', 'success');

    validSession = true;
    showMain();

  } catch(e) {
    await chrome.storage.local.set({ pm_jwt: null });
    validSession = false;
    showLogin();
    setPopupStatus(e.message, 'warning');
  }
}

async function setTheme() {
  let { pm_theme } = await chrome.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  toggleThemeIcon.classList = iconClass[pm_theme];
}

// Login
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});
loginBtn.addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ pm_username: usernameInput.value });

    let { pm_ttl } = await chrome.storage.local.get(['pm_ttl']);
    
    const res = await api.login(usernameInput.value, passwordInput.value, pm_ttl || null);
    if (res.status < 200 || res.status >= 300) throw new Error(res.message || `Erreur: ${res.status}`);
    await chrome.storage.local.set({ pm_jwt: res.token });
    PM_vault.credentials = res.credentials;

    setPopupStatus('Connecté', 'success');
    validSession = true;
    showMain();

    usernameInput.value = '';
    passwordInput.value = '';
  } catch (e) {
    setPopupStatus(e.message, 'danger');
  }
});

// Signup
signupBtn.addEventListener('click', async () => {
  try {
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

// Ouvrir le coffre-fort
vaultBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: '../app/vault.html' });
});

// Ouvrir les stats
statisticBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: '../app/statistic.html' });
});

// Ouvrir options
optionsBtn.addEventListener('click', () => {
  if (validSession) chrome.tabs.create({ url: '../app/settings.html' });
  else chrome.runtime.openOptionsPage();
});

// Toggle Theme
toggleThemeBtn.addEventListener('click', async () => {
  const { pm_theme } = await chrome.storage.local.get('pm_theme');
  const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
  await chrome.storage.local.set({ pm_theme: newTheme });
  setTheme();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({ pm_jwt: null });
  showLogin();
  setPopupStatus('Déconnecté', 'info');
});

// Décrypter password
decryptBtn.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'openOptionsBtnAlert') {
    chrome.runtime.openOptionsPage();
  }
});

popupStatus.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'openOptionsBtnAlert') {
    chrome.runtime.openOptionsPage();
  }
});

// Au lancement
setTheme();
loadUserSession();