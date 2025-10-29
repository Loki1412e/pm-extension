const b = globalThis.browser ?? globalThis.chrome;

const $ = s => document.querySelector(s);
const html = document.documentElement;

const ACTUAL_PAGE = window.location.pathname.split('/').pop().split('.')[0];

const usernameElems = document.querySelectorAll('.session-username');
const pmVersion = $('#pmVersion');

const logoutBtn = $('#logout');

const toggleThemeBtn = $('#toggleTheme');
const toggleThemeIcon = $('#toggleThemeIconId');
const iconClass = { 'dark': 'bi bi-sun pe-2', 'light': 'bi bi-moon-stars me-2', 'auto': 'bi bi-moon-stars me-2' };

// --- Helpers pour normaliser les réponses ---
export function respIsOk(res) {
  return !!res && (res.ok === true || res.status === 200 || res.ok === 200);
}

export function respErrorMsg(res) {
  if (!res) return null;
  return res.error || res.message || (res.status ? `Erreur: res status = ${res.status}` : null);
}

// Affichage des alert
export function showAlert(alertId, message, type = 'dark', duration = 5000, alertContainerId = 'alertContainer') {
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
  alert.style.cursor = "pointer";

  alert.addEventListener('click', () => alert.remove());

  const alertContainer = document.getElementById(alertContainerId);
  alertContainer.appendChild(alert);

  if (duration <= 0) return;
  if (duration == 5000) {
    switch (type) {
      case 'danger': return;
      case 'info':
      case 'warning': duration *= 2; break;
    }
  }

  setTimeout(() => {
    alert.classList.add('fade');
    alert.addEventListener('transitionend', () => alert.remove());
    setTimeout(() => alert.remove(), 300);
  }, duration);
}

export async function setTheme(toggleThemeIconId = 'toggleThemeIconId') {
  const toggleThemeIcon = document.getElementById(toggleThemeIconId);
  let { pm_theme } = await b.storage.local.get('pm_theme');
  pm_theme = pm_theme || 'auto';
  html.setAttribute('data-bs-theme', pm_theme);
  if (!toggleThemeIcon) return;
  toggleThemeIcon.classList = iconClass[pm_theme];
  if (pm_theme === 'dark') toggleThemeIcon.style.fontSize = '1.2rem';
  else toggleThemeIcon.style.fontSize = '1rem';
}

// Vérifie si le JWT est valide au lancement
export async function loadUserSession() {
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  
  if (!respIsOk(res) || !res.isLoggedIn) {
    window.location.href = "../noLog/settings.html";
    return;
  }

  // Charger le nom d'utilisateur pour l'affichage
  const { pm_username } = await b.storage.local.get('pm_username');
  if (pm_username) {
    usernameElems.forEach(elem => { elem.textContent = pm_username; });
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
    const { pm_theme } = await b.storage.local.get('pm_theme');
    const newTheme = pm_theme === 'dark' ? 'light' : 'dark';
    await b.storage.local.set({ pm_theme: newTheme });
    setTheme('toggleThemeIconId');
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    const res = await b.runtime.sendMessage({ type: 'LOGOUT' });
    if (respIsOk(res)) {
      window.location.href = "../noLog/settings.html";
    }
    else {
      showAlert('logout', respErrorMsg(res) || 'Erreur lors de la déconnexion.', 'danger');
    }
  });
}

//== Au chargement de la page ==//
await loadUserSession();
await setTheme();
await loadExtensionVersion();