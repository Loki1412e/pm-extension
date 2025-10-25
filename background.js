// background.js

import { ApiClient } from './apiClient.js';
import { encryptWithPassword, decryptWithPassword, deriveKeyPBKDF2 } from './cryptoLocal.js';

const b = globalThis.browser ?? globalThis.chrome;
const api = new ApiClient();

/*
 * ========================================
 * ETAT GLOBAL (En mémoire)
 * ========================================
 * C'est le "cerveau" de l'extension.
 * - jwt: Le token d'authentification.
 * - masterKey: La clé de chiffrement AES (CryptoKey), dérivée du mot de passe maître.
 * Si (null) -> le coffre est VERROUILLÉ.
 * - decryptedVault: Un Map<id, credential> contenant le coffre DÉCHIFFRÉ en clair.
 * - pendingSave: Données temporaires pour une sauvegarde en attente.
 */
let state = {
  jwt: null,
  masterKey: null, // CryptoKey
  decryptedVault: null, // Map<string, object>
  pendingSave: null // { url, username, password }
};

// --- Initialisation au démarrage ---

async function initDefaultStorage() {
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

// Tente de charger le JWT depuis le storage au démarrage
async function loadSession() {
  const { pm_jwt } = await b.storage.local.get('pm_jwt');
  if (pm_jwt) {
    // On vérifie si le JWT est encore valide
    const res = await api.readUser(pm_jwt);
    if (res.status === 200) {
      console.log("Session restaurée depuis le storage.");
      state.jwt = pm_jwt;
    } else {
      console.log("Session expirée, nettoyage du JWT.");
      await b.storage.local.set({ pm_jwt: null });
    }
  }
}

b.runtime.onStartup.addListener(async () => {
  await initDefaultStorage();
  await loadSession();
});

b.runtime.onInstalled.addListener(async () => {
  await initDefaultStorage();
  await loadSession();
});

// Charge la session immédiatement au cas où le service worker vient de se réveiller
loadSession();


/*
 * ========================================
 * GESTIONNAIRE DE MESSAGES (Le "Routeur")
 * ========================================
 * Toutes les UI (popup, content, options) communiquent via ce routeur.
 */
b.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      // --- Actions ne nécessitant pas de JWT ---
      if (msg.type === 'GET_STATUS') {
        sendResponse({
          ok: true,
          isLoggedIn: !!state.jwt,
          isVaultUnlocked: !!state.masterKey
        });
        return;
      }

      if (msg.type === 'LOGIN') {
        const { pm_ttl } = await b.storage.local.get('pm_ttl');
        const res = await api.login(msg.username, msg.password, pm_ttl || 10);
        if (res.status === 200 && res.token) {
          state.jwt = res.token;
          await b.storage.local.set({ pm_jwt: res.token, pm_username: msg.username });
          sendResponse({ ok: true });
        } else {
          throw new Error(res.message || 'Échec de la connexion');
        }
        return;
      }

      if (msg.type === 'SIGNUP') {
        const res = await api.signup(msg.username, msg.password);
         if (res.status === 200) {
          sendResponse({ ok: true, message: "Compte créé. Connectez-vous." });
        } else {
          throw new Error(res.message || 'Échec de l\'inscription');
        }
        return;
      }
      
      if (msg.type === 'API_HEALTH_CHECK') {
        const res = await api.healthCheck();
        sendResponse(res);
        return;
      }
      
      if (msg.type === 'SAVE_CONFIG') {
         await b.storage.local.set({ pm_api: msg.pm_api, pm_ttl: msg.pm_ttl });
         sendResponse({ ok: true });
         return;
      }
      
      if (msg.type === 'GET_CONFIG') {
        const config = await b.storage.local.get(['pm_api', 'pm_ttl']);
        sendResponse({ ok: true, ...config });
        return;
      }

      // --- Actions nécessitant un JWT (ci-dessous) ---
      if (!state.jwt) {
        throw new Error("Utilisateur non connecté (JWT manquant).");
      }

      if (msg.type === 'LOGOUT') {
        state.jwt = null;
        state.masterKey = null;
        state.decryptedVault = null;
        await b.storage.local.set({ pm_jwt: null });
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === 'UNLOCK_VAULT') {
        const encryptedVault = await api.listCredentials(state.jwt);
        if (!encryptedVault.credentials || encryptedVault.credentials.length === 0) {
          // Coffre vide, on crée une clé "virtuelle"
          console.log("Coffre-fort vide. Déverrouillage virtuel.");
          state.masterKey = await deriveKeyPBKDF2(msg.masterPassword, btoa("DEFAULT_SALT_FOR_EMPTY_VAULT")); // Utilise un salt connu pour un coffre vide
          state.decryptedVault = new Map();
          sendResponse({ ok: true });
          return;
        }

        // Tester le mot de passe sur le premier identifiant
        const testCred = encryptedVault.credentials[0];
        let derivedKey;
        try {
          derivedKey = await deriveKeyPBKDF2(msg.masterPassword, testCred.salt);
          await decryptWithPassword(testCred.ciphertext, testCred.iv, testCred.salt, msg.masterPassword, derivedKey); // On passe la clé pour éviter de la re-dériver
        } catch (e) {
          console.error("Échec du déchiffrement:", e);
          throw new Error("Mot de passe maître invalide.");
        }

        // Le mot de passe est bon ! On stocke la clé...
        state.masterKey = derivedKey;
        console.log("Coffre déverrouillé. Déchiffrement en cours...");

        // ...et on déchiffre tout le coffre en mémoire.
        const vaultMap = new Map();
        for (const cred of encryptedVault.credentials) {
          const plaintextPassword = await decryptWithPassword(cred.ciphertext, cred.iv, cred.salt, msg.masterPassword, state.masterKey);
          vaultMap.set(cred.id, {
            id: cred.id,
            domain: new URL(cred.url).hostname.replace(/^www\./, ''), // Stocke le domaine nettoyé
            url: cred.url,
            username: cred.username,
            password: plaintextPassword,
            description: cred.description
          });
        }
        state.decryptedVault = vaultMap;
        console.log(`Coffre déchiffré avec ${state.decryptedVault.size} éléments.`);
        sendResponse({ ok: true });
        return;
      }

      // --- Actions nécessitant un coffre déverrouillé (ci-dessous) ---
      if (!state.masterKey || !state.decryptedVault) {
        throw new Error("Le coffre-fort est verrouillé.");
      }
      
      if (msg.type === 'GET_DECRYPTED_CREDENTIALS_FOR_DOMAIN') {
        const domain = msg.domain;
        if (!domain) {
          sendResponse({ ok: true, matches: [] });
          return;
        }

        const matches = [];
        for (const [id, cred] of state.decryptedVault.entries()) {
          if (cred.domain === domain || domain.endsWith('.' + cred.domain) || cred.domain.endsWith('.' + domain)) {
            matches.push(cred);
          }
        }
        sendResponse({ ok: true, matches: matches });
        return;
      }
      
      if (msg.type === 'PROMPT_TO_SAVE') {
        // Stocke temporairement les données et ouvre la fenêtre de validation
        state.pendingSave = { url: msg.url, username: msg.username, password: msg.password };
        
        await b.windows.create({
          url: b.runtime.getURL('popup/validation.html'),
          type: 'popup',
          width: 400,
          height: 300
        });
        sendResponse({ ok: true });
        return;
      }
      
      if (msg.type === 'GET_PENDING_SAVE_DATA') {
        sendResponse({ ok: true, data: state.pendingSave });
        return;
      }

      if (msg.type === 'CANCEL_SAVE') {
        state.pendingSave = null;
        sendResponse({ ok: true });
        return;
      }

      if (msg.type === 'CONFIRM_SAVE') {
        if (!state.pendingSave) throw new Error("Aucune sauvegarde en attente.");
        if (!msg.masterPassword) throw new Error("Mot de passe maître requis pour chiffrer.");

        const { url, username, password } = state.pendingSave;
        const domain = new URL(url).hostname.replace(/^www\./, '');
        
        // 1. Chiffrer le nouveau mot de passe
        const { ciphertext, iv, salt } = await encryptWithPassword(password, msg.masterPassword);

        // 2. Envoyer à l'API
        const created = await api.createCredential(state.jwt, {
          domain: domain,
          username: username,
          ciphertext: ciphertext,
          iv: iv,
          salt: salt,
          description: msg.description || ''
        });
        
        if (!created || created.status !== 200) {
          throw new Error(created.message || "Échec de la création côté API.");
        }

        // 3. Ajouter au coffre-fort local déchiffré
        state.decryptedVault.set(created.id, {
          id: created.id,
          domain: domain,
          url: url,
          username: username,
          password: password, // On a déjà le mdp en clair
          description: msg.description || ''
        });

        console.log("Nouvel identifiant sauvegardé et ajouté au coffre local.");
        state.pendingSave = null;
        sendResponse({ ok: true, created: created });
        return;
      }
      
      // ... (Gérer tes autres types de messages ici: 'GET_PASSWORD_PLAINTEXT', etc.)

    } catch (err) {
      console.error(`Erreur lors du traitement du message ${msg.type}:`, err);
      sendResponse({ ok: false, error: String(err.message) });
    }
  })();

  return true; // Indispensable pour sendResponse asynchrone
});


// --- GESTION DU BADGE ---

async function updateBadge(tabId) {
  if (!state.jwt) {
    return b.action.setBadgeText({ tabId, text: '' });
  }
  
  if (!state.masterKey) {
    return b.action.setBadgeText({ tabId, text: '🔒' }); // Verrouillé
  }

  try {
    const tab = await b.tabs.get(tabId);
    if (!tab.url || !tab.url.startsWith('http')) {
       return b.action.setBadgeText({ tabId, text: '' });
    }
    
    const domain = new URL(tab.url).hostname.replace(/^www\./, '');
    if (!domain) return;

    let matchCount = 0;
    for (const [id, cred] of state.decryptedVault.entries()) {
      if (cred.domain === domain || domain.endsWith('.' + cred.domain) || cred.domain.endsWith('.' + domain)) {
        matchCount++;
      }
    }

    if (b.action && b.action.setBadgeText) {
      b.action.setBadgeText({ tabId, text: String(matchCount || '') });
    }
  } catch (_) {}
}

b.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
b.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    updateBadge(tabId);
  }
});

// Met à jour les badges de tous les onglets lors du déverrouillage/verrouillage
b.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UNLOCK_VAULT' || msg.type === 'LOGOUT') {
    b.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        updateBadge(tab.id);
      }
    });
  }
});