import { showAlert, setTheme, respIsOk, respErrorMsg } from './utils.js';

const b = globalThis.browser ?? globalThis.chrome;
const $ = s => document.querySelector(s);

const decryptBtn = $('#decryptBtn');
const searchUsername = $('#searchUsername');
const searchDomain = $('#searchDomain');
const tableBody = document.querySelector('tbody');

const addEntryModalBtn = $('#addEntryModalBtn');
const addCredentialModalEl = $('#addCredentialModal');
const saveNewCredentialBtn = $('#saveNewCredentialBtn');
const addCredAlert = $('#addCredAlert');
const addCredentialForm = $('#addCredentialForm');
const addCredentialModal = addCredentialModalEl ? new bootstrap.Modal(addCredentialModalEl) : null;

let allCredentials = [];

// Vérifie si le coffre est déverrouillé et charge les credentials
async function checkVaultStatus() {
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  
  if (!respIsOk(res)) {
    showAlert('vault-status', 'Erreur lors de la vérification du statut', 'danger');
    return false;
  }

  if (!res.isLoggedIn) {
    window.location.href = "../noLog/settings.html";
    return false;
  }

  if (!res.isVaultUnlocked) {
    // Le coffre est verrouillé, afficher un message
    if (addEntryModalBtn) addEntryModalBtn.classList.add('d-none');
    if (decryptBtn) decryptBtn.classList.remove('d-none');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" class="text-center">🔒 Coffre-fort verrouillé</td></tr>';
    showAlert('vault-status', 'Le coffre-fort est verrouillé. Déverrouillez-le pour voir vos identifiants.', 'warning', 0);
    return false;
  }

  if (decryptBtn) decryptBtn.classList.add('d-none');
  if (addEntryModalBtn) addEntryModalBtn.classList.remove('d-none');

  return true;
}

// Charge les credentials depuis le background
async function loadCredentials() {
  const isUnlocked = await checkVaultStatus();
  if (!isUnlocked) return;

  // Récupérer TOUS les credentials du coffre
  const res = await b.runtime.sendMessage({ type: 'GET_ALL_DECRYPTED_CREDENTIALS' });

  if (!respIsOk(res)) {
    showAlert('vault-load', respErrorMsg(res) || 'Erreur lors du chargement des credentials', 'danger');
    return;
  }

  allCredentials = res.credentials || [];
  displayCredentials(allCredentials);
  
  if (allCredentials.length > 0) {
    const plural = allCredentials.length > 1 ? 's' : '';
    showAlert('vault-load', `${allCredentials.length} identifiant${plural} chargé${plural}`, 'success');
  }
}

// Affiche les credentials dans le tableau
function displayCredentials(credentials) {
  if (!credentials || credentials.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Aucun identifiant trouvé</td></tr>';
    return;
  }

  tableBody.innerHTML = credentials.map(cred => `
    <tr data-id="${cred.id}" title="${cred.description || 'Pas de description'}">
      <td><span class="cursor-pointer copy-field domain" style="cursor: pointer;" data-value="${cred.domain}">${cred.domain}</span></td>
      <td><span class="cursor-pointer copy-field username" style="cursor: pointer;" data-value="${cred.username}">${cred.username}</span></td>
      <td><span class="cursor-pointer copy-field password-field" style="cursor: pointer;" data-value="${cred.password}">••••••••</span></td>
      <td>
        <button title="Copier le mot de passe" class="btn btn-sm btn-outline-primary copy-password-btn" data-password="${cred.password}">
          <i class="bi bi-clipboard"></i>
        </button>
        <button title="Afficher/Masquer" class="btn btn-sm btn-outline-secondary toggle-password-btn">
          <i class="bi bi-eye"></i>
        </button>
        <button title="Modifier" class="btn btn-sm btn-outline-secondary edit-btn" data-id="${cred.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button title="Supprimer" class="btn btn-sm btn-outline-danger delete-btn" data-id="${cred.id}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  // Ajouter les event listeners
  attachEventListeners();
}

// Attache les event listeners aux boutons
function attachEventListeners() {
  // Copier le mot de passe
  document.querySelectorAll('.copy-password-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const password = e.currentTarget.dataset.password;
      await navigator.clipboard.writeText(password);
      showAlert('copy', 'Mot de passe copié', 'info', 1000);
    });
  });

  // Toggle affichage du mot de passe
  document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.currentTarget.closest('tr');
      const passwordField = row.querySelector('.password-field');
      const icon = e.currentTarget.querySelector('i');
      
      if (passwordField.textContent === '••••••••') {
        passwordField.textContent = passwordField.dataset.value;
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
      } else {
        passwordField.textContent = '••••••••';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
      }
    });
  });

  // Copier au clic sur les champs
  document.querySelectorAll('.copy-field').forEach(field => {
    field.addEventListener('click', async (e) => {
      // Récupère l'élément .copy-field réel même si un enfant a été cliqué
      const target = e.currentTarget || e.target;
      const fieldEl = (target && target.closest) ? (target.closest('.copy-field') || target) : target;
      if (!fieldEl || !fieldEl.dataset) return;

      const value = fieldEl.dataset.value;
      try {
        await navigator.clipboard.writeText(value);
      } catch (err) {
        console.error('Impossible d\'écrire dans le presse-papiers', err);
      }

      const fieldType = fieldEl.classList.contains('password-field') ? 'Mot de passe' : fieldEl.classList.contains('domain') ? 'Domaine' : 'Identifiant';
      showAlert('copy', `${fieldType} copié`, 'info', 1000);
    });
  });

  // TODO: Implémenter edit et delete
}

// Filtrer les credentials
function filterCredentials() {
  const usernameFilter = searchUsername.value.toLowerCase();
  const domainFilter = searchDomain.value.toLowerCase();

  const filtered = allCredentials.filter(cred => {
    const matchUsername = !usernameFilter || cred.username.toLowerCase().includes(usernameFilter);
    const matchDomain = !domainFilter || (cred.domain && cred.domain.toLowerCase().includes(domainFilter)) || 
                                        (cred.url && cred.url.toLowerCase().includes(domainFilter));
    return matchUsername && matchDomain;
  });

  displayCredentials(filtered);
}

// Event listeners pour les filtres
if (searchUsername) {
  searchUsername.addEventListener('input', filterCredentials);
}
if (searchDomain) {
  searchDomain.addEventListener('input', filterCredentials);
}

// --- Event listener bootsrap modal --- //
// Ouvre le modal lorsque l'utilisateur clique sur "Ajouter"
if (addEntryModalBtn && addCredentialModal) {
  addEntryModalBtn.addEventListener('click', () => {
    addCredentialForm.reset();
    addCredAlert.classList.add('d-none'); // Cacher l'alerte
    addCredentialModal.show();
  });
}

// Gère la sauvegarde du nouveau credential
if (saveNewCredentialBtn) {
  saveNewCredentialBtn.addEventListener('click', async () => {
    addCredAlert.classList.add('d-none'); // Cacher l'alerte
    
    const domain = $('#newDomain').value;
    const username = $('#newUsername').value;
    const password = $('#newPassword').value; // C'est le mdp en clair
    const description = $('#newDescription').value;

    if (!domain || !username || !password) {
      addCredAlert.textContent = 'Veuillez remplir tous les champs obligatoires.';
      addCredAlert.classList.remove('d-none');
      return;
    }

    try {
      saveNewCredentialBtn.disabled = true;
      
      // On envoie le mot de passe EN CLAIR au background script
      const response = await b.runtime.sendMessage({
        type: 'CREATE_CREDENTIAL',
        payload: {
          domain,
          username,
          password,
          description
        }
      });

      if (respIsOk(response)) {
        addCredentialModal.hide();
        await loadCredentials(); // Recharger la liste (cette fonction existe déjà dans votre code)
        showAlert('vault-load', 'Identifiant ajouté avec succès', 'success');
      } else {
        throw new Error(respErrorMsg(response) || 'Erreur inconnue');
      }

    } catch (error) {
      console.error('Erreur lors de la création du credential:', error);
      addCredAlert.textContent = `Erreur: ${error.message}`;
      addCredAlert.classList.remove('d-none');
    } finally {
      saveNewCredentialBtn.disabled = false;
    }
  });
}

// Déverrouiller le coffre
if (decryptBtn) {
  decryptBtn.addEventListener('click', async () => {
    showAlert('decrypt', "Utilisez le popup de l'extension pour déverrouiller le coffre", 'info');
  });
}

//== Au chargement de la page ==//
await loadCredentials();
