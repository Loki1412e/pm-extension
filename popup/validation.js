const b = globalThis.browser ?? globalThis.chrome;

const info = document.getElementById('info');
const descriptionInput = document.getElementById('description');
const masterPasswordInput = document.getElementById('masterPassword');
const saveBtn = document.getElementById('save');
const cancelBtn = document.getElementById('cancel');
const status = document.getElementById('status');

let pendingData = null;

function setStatus(message, type = 'danger') {
  status.textContent = message;
  status.classList = `alert alert-${type} mb-3`;
}

// 1. Demander les données au background au chargement
document.addEventListener('DOMContentLoaded', async () => {
  const res = await b.runtime.sendMessage({ type: 'GET_PENDING_SAVE_DATA' });
  if (res.ok && res.data) {
    pendingData = res.data;
    info.textContent = `${pendingData.username} @ ${new URL(pendingData.url).hostname}`;
    masterPasswordInput.focus();
  } else {
    setStatus("Aucune donnée à sauvegarder.");
    saveBtn.disabled = true;
  }
});

// 2. Envoyer la confirmation au background
saveBtn.addEventListener('click', async () => {
  if (!pendingData) return;
  
  const masterPassword = masterPasswordInput.value;
  if (!masterPassword) {
    setStatus("Le mot de passe maître est requis pour chiffrer.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Sauvegarde...";

  const res = await b.runtime.sendMessage({
    type: 'CONFIRM_SAVE',
    masterPassword: masterPassword,
    description: descriptionInput.value
  });

  if (res.ok) {
    // Succès ! On ferme la popup.
    window.close();
  } else {
    setStatus(res.error);
    saveBtn.disabled = false;
    saveBtn.textContent = "Sauvegarder";
  }
});

// 3. Annuler
cancelBtn.addEventListener('click', () => {
  // Informe le background d'annuler
  b.runtime.sendMessage({ type: 'CANCEL_SAVE' });
  window.close();
});

masterPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click();
});