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
    const pm_identifier_expected = 'passmanager_api';
    let pm_api;
    try {
      const stored = await chrome.storage.local.get(['pm_api']);
      pm_api = stored.pm_api || '';
      const url = pm_api + endpoint;
      const res = await fetch(url, options);
      const text = await res.text();
      const data = text ? JSON.parse(text) : { status: res.status, ok: true };

      if (data.meta?.identifier != pm_identifier_expected) {
        return {
          ok: false,
          status: 0,
          error: `L'identifiant API (${data.meta?.identifier || 'NULL'}) reçu de ${pm_api} n'est pas celui attendu ('${pm_identifier_expected}').<br><span id="openOptionsBtnAlert">Vérifiez le lien dans les options</span>.`,
          meta: data.meta
        };
      }
      
      if (!res.ok || res.status >= 300) {
        // data est déjà parsé plus haut
        const errorMsg = await this.parseFastAPIError(data);
        return {
          ok: false,
          status: res.status,
          error: errorMsg,
          meta: data.meta
        };
      }      
      // No Content
      if (res.status === 204)
        return { ok: true, status: 204 };
      
      data.ok = true;
      return data;

    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: `Impossible de joindre l'API (${pm_api}): ${err.message}<br><span id="openOptionsBtnAlert">Modifier l'URL de base de l'API dans les options</span>.`
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
  async signup(username, password, ciphertext, iv, salt) {
    return await this.fetchWithHandling('/user/create', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, ciphertext, iv, salt })
    });
  }

  // --- DELETE ---
  async delete(jwt, password) {
    return await this.fetchWithHandling('/user/delete', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
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
  async listCredentials(jwt, domain = null, username = null, description = null, limit = null, offset = null) {
    const params = new URLSearchParams({ domain, username, description, limit, offset });
    return await this.fetchWithHandling(`/credentials/list?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
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