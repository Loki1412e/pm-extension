import { encryptWithPassword, decryptWithPassword } from './cryptoLocal.js';
import { ApiClient } from './apiClient.js';

const b = globalThis.browser ?? globalThis.chrome;
const api = new ApiClient();

export let PM_vault = {
  isDecrypted: false,
  credentials: null
}

export let PM_deriveKey = null;

export function getDefaultConf() {
  return {
    pm_api: null,
    pm_jwt: null,
    pm_ttl: 10, // en minutes
    pm_username: null,
    pm_theme: 'auto', // 'light', 'dark', 'auto'
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

export async function initDefaultStorage() {
  await chrome.storage.local.clear(); // clear tt
  const defaults = getDefaultConf();
  const stored = await chrome.storage.local.get(Object.keys(defaults));

  const toSet = {};
  for (const key in defaults) {
    if (stored[key] === undefined) {
      toSet[key] = defaults[key];
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
    console.log("Config initialisée avec valeurs par défaut :", toSet);
  }
}

function domainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// Exécuté quand l’extension est installée ou mise à jour
chrome.runtime.onInstalled.addListener(() => {
  initDefaultStorage();
});

// Exécuté à chaque démarrage du navigateur
chrome.runtime.onStartup.addListener(() => {
  initDefaultStorage();
});

b.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const { pm_api, pm_jwt } = await chrome.storage.local.get(['pm_api', 'pm_jwt']);

    if (msg.type === 'LOGIN') {
      const { ttl } = chrome.storage.local.get('pm_ttl');
      const res = await api.login(msg.username, msg.password, mgs.ttl);
      if (res.status === 200 && res.token && res.credentials) {
        await chrome.storage.local.set({ pm_jwt: res.token });
        PM_vault.credentials = res.credentials;
      }
      sendResponse(res);
      return true;
    }

    if (!pm_jwt) {
      sendResponse({ ok: false, error: "Pas de JWT, login nécessaire" });
      return true;
    }

    if (msg.type === 'SIGNUP') {
      const res = await api.signup(msg.username, msg.password);
      sendResponse(res);
      return true;
    }

    if (msg.type === 'QUERY_ACCOUNT_FOR_DOMAIN') {
      const domain = msg.domain;
      const list = await api.listCredentials(pm_jwt);
      const matches = (list.credentials || []).filter(c => {
        try {
          const d = new URL(c.url).hostname.replace(/^www\./, '');
          return d === domain || domain.endsWith('.' + d) || d.endsWith('.' + domain);
        } catch { return false; }
      });
      sendResponse({ ok: true, matches });
      return true;
    }

    if (msg.type === 'GET_PASSWORD_PLAINTEXT') {
      const cred = await api.readCredential(pm_jwt, msg.id, msg.masterPassword);
      sendResponse({ ok: true, credential: cred });
      return true;
    }

    if (msg.type === 'SAVE_CREDENTIAL') {
      const encrypt = await encryptWithPassword(msg.password, demander le master password au user);
      const created = await api.createCredential(pm_jwt, {
        msg.domain, msg.username, encrypt.ciphertext, encrypt.iv, encrypt.salt, msg.description
      });
      sendResponse({ ok: true, created });
      return true;
    }

    if (msg.type === 'DECRYPT_VAULT') {
      const 
    }

  })().catch(err => {
    console.error(err);
    sendResponse({ ok: false, error: String(err) });
  });

  return true;
});

async function updateBadge(tabId) {
  try {
    const { pm_jwt } = await chrome.storage.local.get(['pm_jwt']);
    if (!pm_jwt) return;

    const tab = await b.tabs.get(tabId);
    const domain = domainFromUrl(tab.url);
    if (!domain) return;

    const list = await api.listCredentials(pm_jwt);
    const matches = (list.credentials || []).filter(c => {
      try {
        const d = new URL(c.url).hostname.replace(/^www\./, '');
        return d === domain || domain.endsWith('.' + d) || d.endsWith('.' + domain);
      } catch { return false; }
    });

    if (b.action && b.action.setBadgeText) b.action.setBadgeText({ tabId, text: String(matches.length || '') });
  } catch (_) {}
}

b.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
