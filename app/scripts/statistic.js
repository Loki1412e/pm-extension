import { showAlert, setTheme } from './utils.js';

//== Au chargement de la page ==//

const total = document.querySelector('tbody').children.length;
document.getElementById('statTotal').textContent = total;