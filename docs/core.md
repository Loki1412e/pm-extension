# 📦 Arborescence proposée

```
password-manager-extension/
├── manifest.json
├── background.js                # Service worker MV3 (logique principale + appels API)
├── content.js                   # Détection/auto-remplissage des formulaires
├── apiClient.js                 # Client API (JWT, appels, retry, erreurs)
├── cryptoLocal.js               # (optionnel) Déchiffrement local via WebCrypto
├── popup/
│   ├── popup.html
│   └── popup.js                 # Connexion, switch compte, remplissage manuel
├── options/
│   ├── options.html
│   └── options.js               # Configuration (URL API, politiques, raccourcis)
└── assets/
    └── icon-128.png
```

---

## `manifest.json`
```json

```

> Firefox : ce manifest WebExtensions MV3 fonctionne aussi (avec `browser.*`). Pour maximiser la compatibilité, le code ci-dessous utilise `globalThis.browser ?? globalThis.chrome`.

---

## `apiClient.js`
```js
```

---

## `cryptoLocal.js` (optionnel — déchiffrement côté client)
> Si votre API renvoie *uniquement* des données chiffrées et exige que le déchiffrement se fasse côté client (zéro‑knowledge), utilisez WebCrypto ainsi :
```js
```

---

## `background.js`
```js
```

---

## `content.js`
```js
```

---

## `popup/popup.html`
```html
```

## `popup/popup.js`
```js
```

---

## `noLog/`
```html
```

## `noLog/settings.js`
```js
```

---

# 🧠 Points clés d’implémentation

- **Détection & auto-remplissage** : le `content.js` cherche un couple `username/password` et propose un bouton flottant si des comptes existent pour le domaine courant. Il prend en charge plusieurs comptes et déclenche des événements `input/change` pour les SPA.
- **Sauvegarde post-submit** : écoute `submit`, propose d’enregistrer (label = `document.title`, url = `location.origin`).
- **API** : appels aux endpoints fournis (login, list, read, create…). `read/{id}` demande le **mot de passe maître** via un header (exemple `X-Master-Password`). Adaptez à votre contrat exact.
- **JWT** : stocké dans `chrome.storage.session` quand disponible (sinon `local`). Vous pouvez ajouter une politique d’expiration (TTL) côté options.
- **Compat** : utilisez `globalThis.browser ?? globalThis.chrome` pour unifier Chrome/Brave/Firefox.
- **Sécurité** :
  - Privilégiez `storage.session` + verrouillage automatique (TTL + inactivité).
  - Ne logguez jamais les mots de passe/MP maître. 
  - Préférez le **déchiffrement côté client** (fournissez le ciphertext et le nonce, jamais le clair côté serveur) si vous visez un modèle zéro‑knowledge. Sinon, `read/{id}` avec mot de passe maître côté serveur comme vous l’avez prévu.
  - Restreignez les `host_permissions` si possible (liste blanche dans options).
  - Implémentez un **biometric unlock** plus tard via WebAuthn (clé locale pour déchiffrer une clé de session).

# ✅ À adapter à votre API

- Structure des réponses exactes (ex. `list` renvoie { id, label, username, url } ?)
- Nom du header/paramètre pour le mot de passe maître sur `read`/`update`/`delete`.
- Stratégie de matching domaine ↔ URL (tldts, eTLD+1…), prise en charge des sous-domaines et ports.
- Iframes & shadow DOM : injectez via `all_frames: true` (déjà), et envisagez une recherche récursive sur `shadowRoot`s.

# 🧪 Tests rapides

1. Dans options, mettre `https://raspi5.local/pm/api`.
2. Popup → **Créer** puis **Se connecter**.
3. Visiter un site de test avec un formulaire (ex. page locale), saisir puis soumettre → prompt de sauvegarde.
4. Recharger la page → bouton **Remplir (1)**, saisir MP maître → champs remplis.

# 🚀 Prochaines itérations

- UI plus riche (liste des comptes dans le popup, recherche, copier mdp).
- Détection améliorée (attributs `autocomplete`, heuristiques email/tel, ML léger si besoin).
- Mode « auto-fill silencieux » si un seul compte matche et que l’utilisateur l’autorise.
- Verrouillage après X minutes + réveil via MP maître ou WebAuthn.
- Import/export sécurisé (CSV chiffré en local).
