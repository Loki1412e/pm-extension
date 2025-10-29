import { showAlert, setTheme, respIsOk, respErrorMsg } from './utils.js';

const b = globalThis.browser ?? globalThis.chrome;
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
const testApiBtn = $('#testApiBtn');

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

// Teste la connexion à l'API via background.js
async function testConnection() {
  const alertId = 'api-connection';
  showAlert(alertId, 'Test de connexion...', 'info');
  
  // Sauvegarder temporairement l'URL pour le test
  await b.storage.local.set({ pm_api: urlAPI.value.trim().replace(/\/$/, '') });
  
  const res = await b.runtime.sendMessage({ type: 'API_HEALTH_CHECK' });

  if (respIsOk(res)) {
    const version = res?.meta?.version || '?.?.?';
    showAlert(alertId, `API connectée (v${version})`, 'success');
    return true;
  } else {
    showAlert(alertId, respErrorMsg(res) || 'Erreur lors du test de connexion.', 'danger');
    return false;
  }
}

// Charger tous les paramètres
async function loadConfig() {
  const config = await b.storage.local.get(null);

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

// Sauvegarder les paramètres
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
  
  await b.storage.local.set({
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

// Obtenir la configuration par défaut du background
async function getDefaultConf() {
  return {
    pm_api: 'https://api.ptitgourmand.uk/pm',
    pm_jwt: null,
    pm_ttl: 10,
    pm_username: null,
    pm_theme: 'auto',
    pm_behavior: {
      autofill: true
    },
    pm_pass: {
      enforceUsage: true,
      proposeUsage: true,
      rules: {
        length: 16,
        lowercase: true,
        uppercase: true,
        numbers: true,
        symbols: true
      }
    }
  };
}

// Reset la config
resetBtn.addEventListener('click', async () => {
  if (!confirm('Réinitialiser les paramètres ?')) return;
  
  const defaults = await getDefaultConf();
  await b.storage.local.set(defaults);
  
  await setTheme();
  await loadConfig();
  showAlert('save-params', 'Valeurs par défaut restaurées', 'info');
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
if (testApiBtn) {
  testApiBtn.addEventListener('click', async () => {
    await testConnection();
  });
}

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
