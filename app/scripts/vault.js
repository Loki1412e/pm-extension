import { showAlert, setTheme } from './utils.js';
import { initDefaultStorage } from '../../background.js';

import { ApiClient } from '../../apiClient.js';
const api = new ApiClient();

const $ = s => document.querySelector(s);

const decryptBtn = $('#decryptBtn');

async function decryptVerification(masterPassword) {
    const { credentials } = await chrome.storage.local.get('pm_vault.credentials');
    if (!credentials) return null;

    const isDecrypted = false;

    await chrome.storage.local.set({ pm_vault: { isDecrypted: isDecrypted } });
    return isDecrypted
}

decryptBtn.addEventListener('click', async () => {
  encryptWithPassword
  window.location.href = "../noLog/";
});

//== Au chargement de la page ==//
