export class ApiClient {
  constructor() {}

  async parseFastAPIError(errorResponse) {
    // ... (Ton code de parsing d'erreur est excellent, on le garde) ...
    if (!errorResponse.detail)
      return 'Erreur inconnue';
    
    if (!Array.isArray(errorResponse.detail))
      return errorResponse.detail

    return errorResponse.detail
      .map(err => {
        const field = err.loc && err.loc.length >= 2 ? err.loc[1] : 'champ inconnu';
        const msg = err.msg || 'Erreur inconnue';
        // ... (ton 'switch case' est parfait) ...
        return `"${field}" : ${msg}`;
      })
      .join('<br>');
  }

  async fetchWithHandling(endpoint, options = {}) {
    let pm_api;
    try {
      // Lit la config depuis le storage. C'est OK car seul background.js l'utilise.
      const stored = await chrome.storage.local.get(['pm_api']);
      pm_api = stored.pm_api || 'https://localhost/pm/api'; // Ajout d'un fallback
      const url = pm_api + endpoint;
      const res = await fetch(url, options);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        if (!errorData) return { status: res.status, error: `Erreur HTTP ${res.status}` };
        const errorMsg = await this.parseFastAPIError(errorData);
        return { status: res.status, message: errorMsg };
      }
      
      // Gère le cas où le JSON est vide (ex: 204 No Content)
      const text = await res.text();
      return text ? JSON.parse(text) : { status: res.status, ok: true };

    } catch (err) {
      return {
        status: 0,
        message: `Impossible de joindre l'API (${pm_api}) → ${err.message}.<br><a href='${pm_api + '/docs'}' target='_blank'>Vérifier certificat SSL (HTTPS)</a> ou <span id="openOptionsBtnAlert">Modifier le lien dans options</span>.`
      };
    }
  }

  // --- HEALTH CHECK ---
  async healthCheck() {
    return await this.fetchWithHandling(`/utils/healthcheck`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- LOGIN ---
  async login(username, password, jwt_expir = 10) {
    return await this.fetchWithHandling('/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, jwt_expir })
    });
  }

  // --- SIGNUP ---
  async signup(username, password) {
    return await this.fetchWithHandling('/user/create', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  }

  // --- READ USER ---
  async readUser(jwt) {
    return await this.fetchWithHandling(`/user/read`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // --- LIST CREDENTIALS ---
  async listCredentials(jwt) {
    return await this.fetchWithHandling('/credentials/list', {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
  }

  // --- READ CREDENTIAL (Inchangé) ---
  // Note: cette fonction n'est plus vraiment utilisée 
  // car on liste tout le coffre avec listCredentials.
  async readCredential(jwt, credential_id) {
    return await this.fetchWithHandling(`/credentials/read/${credential_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // --- CREATE CREDENTIAL ---
  async createCredential(jwt, { domain, username, ciphertext, iv, salt, description }) {
    return await this.fetchWithHandling('/credentials/create', {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "url": `https://${domain}`, // L'API attend 'url', pas 'domain'
        "username": username,
        "ciphertext": ciphertext,
        "iv": iv,
        "salt": salt,
        "description": description 
      })
    });
  }
}