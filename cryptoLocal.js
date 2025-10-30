// --- Fonctions utilitaires ---
export function b64FromArr(arr) {
  return btoa(String.fromCharCode(...new Uint8Array(arr)));
}
export function arrFromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// --- Dérivation de clé ---
export async function deriveKeyPBKDF2(masterPassword, saltB64, iterations = 300_000) {
  const enc = new TextEncoder();
  const salt = arrFromB64(saltB64);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // 'false' car la clé n'est pas extractible
    ['encrypt', 'decrypt']
  );
  return key;
}

// --- Chiffrement ---
export async function encryptWithPassword(plaintext, masterPassword) {
  // Générer salt + dériver clé
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = b64FromArr(salt);
  const key = await deriveKeyPBKDF2(masterPassword, saltB64);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, 
    key, 
    enc.encode(plaintext)
  );
  
  return {
    ciphertext: b64FromArr(ct),
    iv: b64FromArr(iv),
    salt: saltB64 // On renvoie le B64
  };
}

// --- Déchiffrement (Optimisé) ---
export async function decryptWithPassword(ciphertextB64, ivB64, saltB64, masterPassword, key = null) {
  // Optimisation: Si la clé (CryptoKey) n'est pas fournie, on la dérive.
  // Sinon, on utilise la clé pré-dérivée.
  const derivedKey = key ? key : await deriveKeyPBKDF2(masterPassword, saltB64);
  
  const iv = arrFromB64(ivB64);
  const ct = arrFromB64(ciphertextB64); // .buffer n'est pas nécessaire ici

  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, 
    derivedKey, 
    ct
  );
  
  return new TextDecoder().decode(pt);
}

// --- Validité token JWT ---
export function isJwtValid(token) {
  if (!token) return false;
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return false;

  // Vérification de l'expiration
  const { exp } = JSON.parse(atob(payload));
  if (Date.now() >= exp * 1000) return false;

  return true;
}