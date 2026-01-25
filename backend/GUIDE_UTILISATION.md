# 📘 Guide d'Utilisation - Workflow de Sélection de Projets

## 🚀 Démarrage Rapide

### 1️⃣ Exécuter la Migration

D'abord, il faut créer la table `propositions_projets` dans la base de données :

```bash
# Activer l'environnement virtuel
.\venv\Scripts\Activate.ps1

# Exécuter la migration
alembic upgrade head
```

### 2️⃣ Configurer les Variables d'Environnement

Ajouter dans votre fichier `.env` :

```env
FRONTEND_URL=http://localhost:3000
```

### 3️⃣ Démarrer le Serveur

```bash
uvicorn app.main:app --reload
```

Le serveur sera accessible sur : `http://localhost:8000`
Documentation API : `http://localhost:8000/docs`

---

## 📋 Workflow Complet

### Étape 1 : ADMIN propose 3 projets

**Endpoint :** `POST /affectation/demande/{demande_id}/proposer-projets`

**Exemple avec curl :**
```bash
curl -X POST "http://localhost:8000/affectation/demande/1/proposer-projets"
```

**Exemple avec Postman/Thunder Client :**
- Method: `POST`
- URL: `http://localhost:8000/affectation/demande/1/proposer-projets`

**Réponse :**
```json
{
  "message": "3 projets proposés et email envoyé ✅",
  "token": "abc123xyz...",
  "projets": [
    {
      "projet_id": 1,
      "code_projet": "PROJ-001",
      "intitule": "Développement Application Web",
      "score": 85
    },
    {
      "projet_id": 2,
      "code_projet": "PROJ-002",
      "intitule": "Système de Gestion",
      "score": 78
    },
    {
      "projet_id": 3,
      "code_projet": "PROJ-003",
      "intitule": "API REST",
      "score": 72
    }
  ],
  "date_expiration": "2024-01-29T22:11:17"
}
```

**Ce qui se passe :**
- ✅ Le système génère un token unique (valide 7 jours)
- ✅ Crée 3 propositions en base de données
- ✅ Envoie un email au stagiaire avec le lien de sélection

---

### Étape 2 : STAGIAIRE voit les projets (via token)

**Endpoint :** `GET /affectation/selection-projet?token={token}`

**Exemple :**
```bash
curl "http://localhost:8000/affectation/selection-projet?token=abc123xyz..."
```

**Réponse :**
```json
{
  "projets": [
    {
      "projet_id": 1,
      "code_projet": "PROJ-001",
      "intitule": "Développement Application Web",
      "description": "...",
      "objectifs": "...",
      "livrables": "...",
      "departement": "INFORMATIQUE",
      "type_stage": "PFE",
      "duree_semaines": 4,
      "niveau_requis": "MASTER",
      "competences": ["Python", "FastAPI", "React"]
    },
    // ... 2 autres projets
  ],
  "date_expiration": "2024-01-29T22:11:17"
}
```

---

### Étape 3 : STAGIAIRE choisit 1 projet

**Endpoint :** `POST /affectation/choisir-projet`

**Body (JSON) :**
```json
{
  "token": "abc123xyz...",
  "projet_id": 1
}
```

**Exemple avec curl :**
```bash
curl -X POST "http://localhost:8000/affectation/choisir-projet" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123xyz...",
    "projet_id": 1
  }'
```

**Réponse :**
```json
{
  "message": "Projet choisi et verrouillé ✅",
  "projet_id": 1,
  "projet_intitule": "Développement Application Web"
}
```

**Ce qui se passe :**
- ✅ Le choix est verrouillé (statut = CHOISI)
- ✅ Les autres propositions sont marquées comme EXPIRE
- ✅ Le projet passe en statut AFFECTE
- ✅ La demande passe en statut ACCEPTEE

---

### Étape 4 : ENCADREUR voit les projets choisis

**Endpoint :** `GET /affectation/encadreur/{encadreur_id}/projets-choisis`

**Exemple :**
```bash
curl "http://localhost:8000/affectation/encadreur/1/projets-choisis"
```

**Réponse :**
```json
{
  "encadreur_id": 1,
  "departement": "INFORMATIQUE",
  "projets_choisis": [
    {
      "projet_id": 1,
      "code_projet": "PROJ-001",
      "intitule": "Développement Application Web",
      "description": "...",
      "stagiaire_nom": "Ahmed Ben Ali",
      "stagiaire_email": "ahmed@example.com",
      "date_choix": "2024-01-22T22:15:30",
      "demande_id": 1
    }
  ]
}
```

---

## 🧪 Test Complet du Workflow

### Prérequis
1. Avoir une demande de stage créée (ID = 1 par exemple)
2. Avoir au moins 3 projets disponibles dans le même département
3. Configuration email configurée dans `.env`

### Script de Test (Python)

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. ADMIN propose 3 projets
response = requests.post(f"{BASE_URL}/affectation/demande/1/proposer-projets")
data = response.json()
token = data["token"]
print(f"✅ Token généré: {token}")

# 2. STAGIAIRE voit les projets
response = requests.get(f"{BASE_URL}/affectation/selection-projet", params={"token": token})
projets = response.json()["projets"]
print(f"✅ {len(projets)} projets disponibles")

# 3. STAGIAIRE choisit le premier projet
projet_id = projets[0]["projet_id"]
response = requests.post(
    f"{BASE_URL}/affectation/choisir-projet",
    json={"token": token, "projet_id": projet_id}
)
print(response.json())

# 4. ENCADREUR voit les projets choisis
response = requests.get(f"{BASE_URL}/affectation/encadreur/1/projets-choisis")
print(response.json())
```

---

## 📧 Configuration Email

Pour que les emails fonctionnent, ajouter dans `.env` :

```env
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@cni.tn
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

---

## 🔍 Vérification dans la Base de Données

### Voir les propositions créées :
```sql
SELECT * FROM propositions_projets;
```

### Voir les projets choisis :
```sql
SELECT * FROM propositions_projets WHERE statut = 'CHOISI';
```

### Voir les projets affectés :
```sql
SELECT * FROM projets WHERE status = 'AFFECTE';
```

---

## ⚠️ Gestion des Erreurs

### Token invalide
```json
{
  "detail": "Token invalide"
}
```

### Token expiré
```json
{
  "detail": "Token expiré"
}
```

### Projet déjà choisi
```json
{
  "detail": "Un projet a déjà été choisi"
}
```

### Pas assez de projets
```json
{
  "detail": "Pas assez de projets disponibles. Trouvé: 2"
}
```

---

## 📝 Notes Importantes

1. **Token unique** : Le même token est utilisé pour les 3 propositions d'une même demande
2. **Expiration** : Le token expire après 7 jours
3. **Verrouillage** : Une fois un projet choisi, les autres deviennent inaccessibles
4. **Email requis** : L'email doit être configuré pour que le workflow fonctionne complètement
5. **Frontend URL** : Configurer `FRONTEND_URL` dans `.env` pour les liens dans les emails

---

## 🎯 Prochaines Étapes

Après la sélection du projet :
1. Assigner un encadreur au projet
2. Créer le compte stagiaire
3. Créer le stage final
4. Envoyer les identifiants de connexion

---

## 📞 Support

Pour toute question ou problème, vérifier :
- Les logs du serveur
- La documentation Swagger : `http://localhost:8000/docs`
- Les tables en base de données
