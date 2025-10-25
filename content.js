const b = globalThis.browser ?? globalThis.chrome;

// --- ASCII Art ---
const iconAsciiArtUrl = b.runtime.getURL('assets/icon-ascii-art.txt');
async function logAsciiArt() {
  try {
    const response = await fetch(iconAsciiArtUrl);
    const text = await response.text();
    console.log(text);
  } catch (err) {
    console.log("PM: Password Manager Extension Enabled");
  }
}

// --- Détection Formulaire ---
function detectLoginForm(root = document) {
  const pw = root.querySelector('input[type="password"]');
  if (!pw) return null;

  const inputs = Array.from(root.querySelectorAll('input[name], input[type="email"], input[autocomplete="username"]'));
  const user = inputs.find(i => i.name.toLowerCase().includes('user') || i.name.toLowerCase().includes('login'));

  const form = pw.closest('form') || user?.closest('form') || document;
  return { form, user, pw };
}

// --- Query ---
async function queryForDomain() {
  const domain = location.hostname.replace(/^www\./, '');
  // Demande les identifiants DÉCHIFFRÉS au background
  return b.runtime.sendMessage({ type: 'GET_DECRYPTED_CREDENTIALS_FOR_DOMAIN', domain });
}

// --- Dropdown ---
function showAutofillDropdown(matches, input) {
  if (!matches?.length) return;

  // ... (Tout le code de création de 'dropdown' est bon, on le garde) ...
  const oldDropdown = document.getElementById('pmx-dropdown');
  if (oldDropdown) oldDropdown.remove();

  const dropdown = document.createElement('div');
  dropdown.id = 'pmx-dropdown';
  Object.assign(dropdown.style, {
    position: 'absolute',
    background: '#fff',
    border: '1px solid #ccc',
    borderRadius: '6px',
    zIndex: 2147483647,
    padding: '4px',
    maxWidth: '220px',
    fontSize: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  });
  
  // Modifié: le 'click' listener
  matches.forEach(m => {
    const item = document.createElement('div');
    // m contient m.username et m.password en clair
    item.textContent = m.username || new URL(m.url).hostname; 
    item.style.padding = '4px';
    item.style.cursor = 'pointer';
    
    item.addEventListener('click', async () => {
      // Plus besoin de prompt() !
      const detected = detectLoginForm();
      if (!detected) return;
      const { user, pw } = detected;

      if (user) user.value = m.username;
      pw.value = m.password; // m.password est en clair
      
      ['input','change'].forEach(ev => {
        if (user) user.dispatchEvent(new Event(ev, { bubbles: true }));
        pw.dispatchEvent(new Event(ev, { bubbles: true }));
      });

      dropdown.remove();
    });
    dropdown.addEventListener('mouseenter', e => e.stopPropagation());
    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);

  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + window.scrollY}px`;
  dropdown.style.left = `${rect.left + window.scrollX}px`;

  function clickOutside(e) {
    if (!dropdown.contains(e.target)) dropdown.remove();
  }
  document.addEventListener('click', clickOutside, { once: true });
}

// --- Listeners ---
function attachAutofillListeners() {
  const detected = detectLoginForm();
  if (!detected) return;

  const { user, pw } = detected;
  const inputs = [user, pw].filter(Boolean);

  inputs.forEach(input => {
    input.addEventListener('focus', async () => {
      const res = await queryForDomain();
      if (res.ok && res.matches?.length) {
        showAutofillDropdown(res.matches, input);
      } else if (!res.ok && res.error === 'VAULT_LOCKED') {
        // Optionnel: afficher une icône "verrouillé"
        console.log("PM: Coffre verrouillé. Autofill désactivé.");
      }
    });
  });
}

// --- Init ---
(async function initAutofill() {
  logAsciiArt();
  try {
    const storage = await b.storage.local.get(['pm_behavior']);
    if (storage.pm_behavior?.autofill) {
      attachAutofillListeners();
    }
  } catch(e) {
    console.error('Erreur init autofill:', e);
  }
})();

// --- Sauvegarde ---
function maybePromptToSave() {
  document.querySelectorAll('form').forEach(f => {
    f.addEventListener('submit', () => {
      const u = f.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]');
      const p = f.querySelector('input[type="password"]');
      if (u && p && p.value) {
        
        // CORRECTION DE SÉCURITÉ:
        // N'ouvre plus la popup et ne passe RIEN en URL.
        // Demande simplement au background de gérer la sauvegarde.
        console.log("PM: Détection de soumission, demande de sauvegarde...");
        b.runtime.sendMessage({
          type: 'PROMPT_TO_SAVE',
          username: u.value,
          password: p.value,
          url: location.origin
        });
      }
    });
  });
}

maybePromptToSave();