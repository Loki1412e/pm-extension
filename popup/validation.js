import { ApiClient } from '../apiClient.js';

const api = new ApiClient();
const b = globalThis.browser ?? globalThis.chrome;

// Récupère les données passées via query string
const params = new URLSearchParams(window.location.search);
const username = params.get('username');
const password = params.get('password');
const url = params.get('url');

document.getElementById('info').textContent = `${username} @ ${new URL(url).hostname}`;

document.getElementById('save').addEventListener('click', async () => {
  const { pm_jwt } = await b.storage.local.get('pm_jwt');
  if (pm_jwt) {
    await api.createCredential(pm_jwt, { label: document.title, username, password, url });
    alert('Identifiants sauvegardés ✅');
  }
  window.close();
});

document.getElementById('cancel').addEventListener('click', () => {
  window.close();
});
