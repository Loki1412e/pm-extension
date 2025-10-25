// cryptoLocal.js
export async function deriveKeyPBKDF2(masterPassword, saltB64, iterations = 300_000) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
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
    false,
    ['encrypt', 'decrypt']
  );
  return key;
}

export function b64FromArr(arr) {
  return btoa(String.fromCharCode(...new Uint8Array(arr)));
}
export function arrFromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function encryptWithPassword(plaintext, masterPassword) {
  // Générer salt + dériver clé
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKeyPBKDF2(masterPassword, b64FromArr(salt));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return {
    ciphertext: b64FromArr(ct),
    iv: b64FromArr(iv),
    salt: b64FromArr(salt)
  };
}

export async function decryptWithPassword(ciphertextB64, ivB64, saltB64, masterPassword) {
  const key = await deriveKeyPBKDF2(masterPassword, saltB64);
  const iv = arrFromB64(ivB64);
  const ct = arrFromB64(ciphertextB64).buffer;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
