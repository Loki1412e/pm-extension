# Gestion des Erreurs API

## Structure des Réponses

### Succès (status 200)
```json
{
  "status": 200,
  "ok": true,
  "meta": { "identifier": "passmanager_api" },
  // ... autres données spécifiques
}
```

### Erreur (status != 200)
```json
{
  "status": 400-500,
  "error": "Message d'erreur formaté",
  "meta": { "identifier": "passmanager_api" }
}
```

### Erreur de connexion (status 0)
```json
{
  "status": 0,
  "error": "Impossible de joindre l'API..."
}
```

## Types d'Erreurs FastAPI

### 1. HTTPException personnalisées (votre code)
Quand vous faites `raise HTTPException(status_code=..., detail=...)`, FastAPI retourne :
```json
{
  "detail": "Votre message d'erreur"
}
```
→ **Traité par** : `parseFastAPIError()` retourne directement le `detail` si ce n'est pas un tableau.

### 2. Erreurs de validation Pydantic (automatiques)
Quand les données ne correspondent pas au modèle Pydantic, FastAPI retourne :
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "username"],
      "msg": "Field required"
    }
  ]
}
```
→ **Traité par** : `parseFastAPIError()` parse chaque erreur et formate un message user-friendly.

### 3. Erreurs serveur 500 (non gérées)
Exceptions Python non catchées :
```json
{
  "detail": "Internal Server Error"
}
```
→ **Traité par** : `parseFastAPIError()` retourne le message tel quel.

## Utilisation dans background.js

### ✅ Bon
```javascript
const res = await api.login(username, password);
if (res.status === 200) {
  // Succès
} else {
  throw new Error(res.error); // ← Utiliser res.error
}
```

### ❌ Mauvais
```javascript
const res = await api.login(username, password);
if (res.status === 200) {
  // Succès
} else {
  throw new Error(res.message); // ← res.message n'existe pas !
}
```

## Cas Particuliers

### Identifiant API invalide
Si `meta.identifier !== "passmanager_api"` :
```javascript
{
  status: 0,
  error: "L'identifiant API reçu n'est pas celui attendu..."
}
```

### API non joignable
Si `fetch()` échoue (CORS, réseau, etc.) :
```javascript
{
  status: 0,
  error: "Impossible de joindre l'API: [raison]..."
}
```

## Mapping des Codes de Statut

| Code | Signification | Géré par |
|------|---------------|----------|
| 200 | Succès | Application |
| 400 | Bad Request (validation) | `parseFastAPIError()` |
| 401 | Non authentifié | FastAPI |
| 403 | Interdit | FastAPI |
| 404 | Non trouvé | FastAPI |
| 422 | Unprocessable Entity (Pydantic) | `parseFastAPIError()` |
| 500 | Erreur serveur | FastAPI |
| 0 | Problème réseau/connexion | `fetchWithHandling()` |
