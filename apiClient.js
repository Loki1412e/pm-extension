
export class ApiClient {
  constructor() {}

  async parseFastAPIError(errorResponse) {
    if (!errorResponse.detail)
      return 'Erreur inconnue';
    
    if (!Array.isArray(errorResponse.detail))
      return errorResponse.detail

    return errorResponse.detail
      .map(err => {
        const field = err.loc && err.loc.length >= 2 ? err.loc[1] : 'champ inconnu';
        const msg = err.msg || 'Erreur inconnue';

        switch (err.type) {
          case 'missing':
            return `Le champ "${field}" est obligatoire.`;
          case 'value_error.email':
            return `Le champ "${field}" doit être un email valide.`;
          case 'type_error.integer':
          case 'type_error.float':
          case 'type_error.number':
            return `Le champ "${field}" doit être un nombre valide.`;
          case 'value_error.any_str.min_length':
            return `Le champ "${field}" est trop court.`;
          case 'value_error.any_str.max_length':
            return `Le champ "${field}" est trop long.`;
          case 'value_error.enum':
            return `Le champ "${field}" contient une valeur invalide.`;
          default:
            // Message brut par défaut
            return `"${field}" : ${msg}`;
        }
      })
      .join('<br>');
  }

  async fetchWithHandling(endpoint, options = {}) {
    let pm_api;
    try {
      const stored = await chrome.storage.local.get(['pm_api']);
      pm_api = stored.pm_api || 'https://localhost/pm/api';
      const url = pm_api + endpoint;
      const res = await fetch(url, options);
      
      if (!res.ok) {
        // Récupérer le JSON d'erreur de façon asynchrone
        const errorData = await res.json().catch(() => null);
        if (!errorData) return { status: res.status, error: `Erreur HTTP ${res.status}` };
        const errorMsg = await this.parseFastAPIError(errorData);
        return { status: res.status, message: errorMsg };
      }
      return await res.json();
    } catch (err) {
      // Ici, err est souvent TypeError si certificat invalide ou réseau bloqué
      return { status: 0, message: `Impossible de joindre l'API (${pm_api}) → ${err.message}.<br><span id="openOptionsBtnAlert" class="text-primary" style="text-decoration: underline; cursor: pointer;">Modifier le lien dans options</span> ou <a href='${pm_api + '/docs'}' target='_blank'>Vérifiez certificat SSL (HTTPS)</a>.` };
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

  // --- READ CREDENTIAL ---
  async readCredential(jwt, credential_id) {
    const data = await this.fetchWithHandling(`/credentials/read/${credential_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (data.status !== 200) return data;
    
    // Optionnel : déchiffrement côté extension
    // masterPassword est fourni par l'utilisateur
    // ...
    
    return data;
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
        "domain": domain,
        "username": username,
        "ciphertext": ciphertext,
        "iv": iv,
        "salt": salt,
        "description": description })
    });
  }
}
