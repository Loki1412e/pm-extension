import { showAlert, setTheme } from './utils.js';
import { initDefaultStorage } from '../../background.js';
import { ApiClient } from '../../apiClient.js';
const api = new ApiClient();

const $ = s => document.querySelector(s);

const urlAPI = $('#urlAPI');
const ttlInputGroup = $('#ttlInputGroup');
const jwtTTL = $('#jwtTTL'); // JWT ttl en minutes
const customTTL = $('#customTTL');

const enableAutofill = $('#enableAutofill');
const passLength = $('#passLength');
const passLowercase = $('#passLowercase');
const passUppercase = $('#passUppercase');
const passNumbers = $('#passNumbers');
const passSymbols = $('#passSymbols');
const passEnforceUsage = $('#passEnforceUsage');
const passProposeUsage = $('#passProposeUsage');

const themeSelect = $('#themeSelect');

const resetBtn = $('#reset');
const saveBtn = $('#save');

const DEFAULT_JWT_TTL = 10; // minutes

// Modifie l'input/select pour JWT expiration
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

// Teste la connexion à l'API
async function testConnection() {
  const alertId = 'api-connection';
  try {
    await chrome.storage.local.set({ pm_api: urlAPI.value })
    const res = await api.healthCheck();
    if (res.status < 200 || res.status >= 300) throw new Error(res.error || res.message || res.detail || JSON.stringify(res));    
    
    if (res.meta.identifier !== 'passmanager_api') showAlert(alertId, `API connectée: Identifier non reconnu (= ${res.meta.identifier})`, 'warning');
    else showAlert(alertId, 'API connectée', 'success');

    return true;
  } catch (e) {
    showAlert(alertId, `API: ${e.message}`, 'danger');
    return false;
  }
}

// Modifier tout les parametres
async function loadConfig() {
  const config = await chrome.storage.local.get(null);

  // API URL
  urlAPI.value = config.pm_api || '';

  // JWT expir
  const isCustom = !Array.from(jwtTTL.options).some(opt => opt.value === String(config.pm_ttl))
  jwtTTL.value = isCustom ? 'custom' : String(config.pm_ttl)
  customTTL.value = isCustom ? config.pm_ttl : '';
  setTtlInputGroup();

  // Theme
  themeSelect.value = config.pm_theme || 'auto';

  // Autofill checkbox
  enableAutofill.checked = !!config.pm_behavior?.autofill;

  // Password Generator settings
  passLength.value = config.pm_pass?.rules?.length || 16;
  passLowercase.checked = !!config.pm_pass?.rules?.lowercase;
  passUppercase.checked = !!config.pm_pass?.rules?.uppercase;
  passNumbers.checked = !!config.pm_pass?.rules?.numbers;
  passSymbols.checked = !!config.pm_pass?.rules?.symbols;

  passEnforceUsage.checked = !!config.pm_pass?.enforceUsage;
  passProposeUsage.checked = !!config.pm_pass?.proposeUsage;
}

// Sauvegarder les parametres
async function saveParams() {
  
  let apiBase = urlAPI.value.trim();
  if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);

  let ttl = jwtTTL.value === 'custom' ? Number(customTTL.value) : Number(jwtTTL.value);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 1440) {
    showAlert('save-params', 'Invalid: TTL doit être un entier entre 1 et 1440', 'danger');
    return;
  }

  const length = Number(passLength.value);
  if (!Number.isInteger(length) || length < 6 || length > 128) {
    showAlert('save-params', 'Invalid: passLength doit être un entier entre 6 et 128', 'danger');
    return;
  }
  
  await chrome.storage.local.set({
    pm_api: apiBase,
    pm_ttl: ttl,
    pm_theme: themeSelect.value,
    pm_behavior: {
      autofill: enableAutofill.checked
    },
    pm_pass: {
      enforceUsage: passEnforceUsage.checked,
      proposeUsage: passProposeUsage.checked,
      rules: {
        length: length,
        lowercase: passLowercase.checked,
        uppercase: passUppercase.checked,
        numbers: passNumbers.checked,
        symbols: passSymbols.checked
      }
    }
  });

  await setTheme();
  showAlert('save-params', 'Préférences sauvegardées', 'success');
}

// Reset la config
resetBtn.addEventListener('click', async () => {
  if (!confirm('Réinitialiser les paramètres ?')) return;
  await initDefaultStorage();
  await setTheme();
  await loadConfig();
  showAlert('save-params', 'Valeurs par défaut réstaurés', 'info');
});

// Sauvegarde la config
urlAPI.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  await testConnection();
  await saveParams();
});
customTTL.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') await saveParams();
});
saveBtn.addEventListener('click', async () => {
  await saveParams();
});

// Test la connexion à l'API
testApiBtn.addEventListener('click', async () => {
  await testConnection();
});

// Affiche ou masque le champ custom
jwtTTL.addEventListener('change', async () => {
  setTtlInputGroup();
  
  // Save
  if (jwtTTL.value !== 'custom') await saveParams();
  else showAlert('save-params', '');
});

//== Au chargement de la page ==//
await loadConfig();
await testConnection();