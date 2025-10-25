import { ApiClient } from '../../apiClient.js';
const api = new ApiClient();

const $ = s => document.querySelector(s);
const html = document.documentElement;

const ACTUAL_PAGE = window.location.pathname.split('/').pop().split('.')[0];

const usernameElems = document.querySelectorAll('.session-username');
const pmVersion = $('#pmVersion');

const logoutBtn = $('#logout');

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIconId');
const iconClass = { 'dark': 'bi bi-sun pe-2', 'light': 'bi bi-moon-stars me-2', 'auto': 'bi bi-moon-stars me-2' };

// Affichage des alert
export function showAlert(alertId, message, type = 'dark', alertContainerId = 'alertContainer', duration = 5000) {
  const id = 'alert-' + alertId;
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  if (!message) return;

  const statusTypes = ['primary', 'secondary', 'success', 'danger', 'warning',  'info', 'light', 'dark'];
  if (!statusTypes.includes(type)) type = 'dark';

  const alert = document.createElement('div');
  alert.id = id;
  alert.className = `alert alert-${type} alert-toast`;
  alert.innerHTML = message;
  alert.style.borderRadius = "0.375rem";
  alert.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";

  alert.addEventListener('click', () => alert.remove());

  const alertContainer = document.getElementById(alertContainerId);
  alertContainer.appendChild(alert);

  switch (type) {
    case 'danger': return;
    case 'info':
    case 'warning': duration *= 2; break;
  }

  setTimeout(() => {
    alert.classList.add('fade');
    alert.addEventListener('transitionend', () => alert.remove());
    setTimeout(() => alert.remove(), 300);
  }, duration);
}

export async function setTheme(toggleThemeIconId = 'toggleThemeIconId') {
  const toggleThemeIcon = document.getElementById(toggleThemeIconId);
  let { pm_theme } = await chrome.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  if (!toggleThemeIcon) return;
  toggleThemeIcon.classList = iconClass[pm_theme];
  if (pm_theme === 'dark') toggleThemeIcon.style.fontSize = '1.2rem';
  else toggleThemeIcon.style.fontSize = '1rem';
}

// Vérifie si le JWT est valide au lancement
export async function loadUserSession() {
  const { pm_jwt } = await chrome.storage.local.get(['pm_jwt']);

  if (!pm_jwt) {
    window.location.href = "../noLog/settings.html";
    return;
  }

  try {
    const res = await api.readUser(pm_jwt);

    if (res.status < 200 || res.status >= 300) throw new Error(res.message || 'Session invalide');
    const user = res.user;

    await chrome.storage.local.set({ pm_username: user.username });

  } catch(e) {
    await chrome.storage.local.set({ pm_jwt: null });
    window.location.href = "../noLog/settings.html";
  }
}

// Charge la version de l'extension
async function loadExtensionVersion() {
  if (!pmVersion) return;

  try {
    if (chrome.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest();
      pmVersion.textContent = !manifest?.version ? 'UNKNOWN VERSION' : `v${manifest.version}`;
    } else {
      pmVersion.textContent = 'UNKNOWN VERSION';
    }
  } catch (e) {
    pmVersion.textContent = 'UNKNOWN VERSION';
  }
}

// Toggle Theme
if (toggleThemeBtn) {
  toggleThemeBtn.addEventListener('click', async () => {
    const { pm_theme } = await chrome.storage.local.get('pm_theme');
    const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
    await chrome.storage.local.set({ pm_theme: newTheme });
    setTheme('toggleThemeIconId');
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ pm_jwt: null });
    window.location.href = "../noLog/settings.html";
  });
}

//== Au chargement de la page ==//
await loadUserSession();
await setTheme();
await loadExtensionVersion();