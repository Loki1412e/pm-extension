import { showAlert, setTheme, respIsOk, respErrorMsg } from './utils.js';

const b = globalThis.browser ?? globalThis.chrome;

// Charge les statistiques
async function loadStatistics() {
  const res = await b.runtime.sendMessage({ type: 'GET_STATUS' });
  
  if (!respIsOk(res)) {
    showAlert('stats', 'Erreur lors du chargement des statistiques', 'danger');
    return;
  }

  if (!res.isLoggedIn) {
    window.location.href = "../noLog/settings.html";
    return;
  }

  if (!res.isVaultUnlocked) {
    document.getElementById('statTotal').textContent = '🔒';
    showAlert('stats', 'Le coffre-fort est verrouillé. Déverrouillez-le pour voir vos statistiques.', 'warning', 'alertContainer', 0);
    return;
  }

  // Récupérer tous les credentials pour calculer les stats
  const credRes = await b.runtime.sendMessage({ type: 'GET_ALL_DECRYPTED_CREDENTIALS' });

  if (respIsOk(credRes)) {
    const total = credRes.credentials?.length || 0;
    document.getElementById('statTotal').textContent = total;
  } else {
    document.getElementById('statTotal').textContent = '?';
  }
}

//== Au chargement de la page ==//
await loadStatistics();
