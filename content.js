const b = globalThis.browser ?? globalThis.chrome;

const iconAsciiArtUrl = chrome.runtime.getURL('assets/icon-ascii-art.txt');

async function logAsciiArt() {
  try {
    const response = await fetch(iconAsciiArtUrl);
    const text = await response.text();
    console.log(text);
  } catch (err) {
    console.error('Erreur lors de la lecture du fichier :', err);
  }
}

// ----------------------------
// Détection du formulaire
// ----------------------------
function detectLoginForm(root = document) {
  const pw = root.querySelector('input[type="password"]');
  alert('pw: ' + String(pw));
  if (!pw) return null;

  const inputs = Array.from(root.querySelectorAll('input[name], input[type="email"], input[autocomplete="username"]'));
  const user = inputs.find(i => i.name.toLowerCase().includes('user') || i.name.toLowerCase().includes('login'));

  const form = pw.closest('form') || user?.closest('form') || document;
  return { form, user, pw };
}

// ----------------------------
// Query identifiants pour le domaine
// ----------------------------
async function queryForDomain() {
  const domain = location.hostname.replace(/^www\./, '');
  return new Promise(resolve => 
    b.runtime.sendMessage({ type: 'QUERY_ACCOUNT_FOR_DOMAIN', domain }, resolve)
  );
}

// ----------------------------
// Dropdown d'autofill
// ----------------------------
function showAutofillDropdown(matches, input) {
  if (!matches?.length) return;

  // Supprimer l'ancien dropdown
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

  matches.forEach(m => {
    const item = document.createElement('div');
    item.textContent = m.username || new URL(m.url).hostname;
    item.style.padding = '4px';
    item.style.cursor = 'pointer';
    item.addEventListener('click', async () => {
      const masterPassword = prompt('Entrez votre mot de passe maître');
      if (!masterPassword) return;

      const res = await new Promise(r =>
        b.runtime.sendMessage({ type: 'GET_PASSWORD_PLAINTEXT', id: m.id, masterPassword }, r)
      );

      if (!res.ok) {
        alert('Erreur: ' + res.error);
        return;
      }

      const detected = detectLoginForm();
      if (!detected) return;
      const { user, pw } = detected;

      if (user) user.value = res.credential.username;
      pw.value = res.credential.password;
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

  // Fermer le dropdown si on clique ailleurs
  function clickOutside(e) {
    if (!dropdown.contains(e.target)) dropdown.remove();
  }
  document.addEventListener('click', clickOutside, { once: true });
}

// ----------------------------
// Attach listeners aux inputs
// ----------------------------
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
      }
    });
  });
}

// ----------------------------
// Init
// ----------------------------
(async function initAutofill() {
  logAsciiArt();
  try {
    const storage = await chrome.storage.local.get(['pm_behavior']);
    if (storage.pm_behavior?.autofill) {
      attachAutofillListeners();
    }
  } catch(e) {
    console.error('Erreur init autofill:', e);
  }
})();

// ----------------------------
// Optional: save password prompt on submit
// ----------------------------
function maybePromptToSave() {
  document.querySelectorAll('form').forEach(f => {
    f.addEventListener('submit', () => {
      const u = f.querySelector('input[type="text"], input[type="email"], input[name*="user"], input[name*="login"]');
      const p = f.querySelector('input[type="password"]');
      if (u && p && p.value) {
        const query = new URLSearchParams({ username: u.value, password: p.value, url: location.origin }).toString();
        const popupUrl = chrome.runtime.getURL(`popup/validation.html?${query}`);
        window.open(popupUrl, '_blank', 'width=400,height=200');
      }
    });
  });
}

maybePromptToSave();
