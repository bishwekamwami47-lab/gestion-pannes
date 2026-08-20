# Déploiement gratuit — Render + Neon (PostgreSQL)

Ce guide part du principe : un seul hébergeur (Render) sert Django **et** le frontend React compilé ;
Neon héberge la base PostgreSQL.

## 1. Neon — créer la base de données

1. Créez un compte sur https://neon.tech (gratuit).
2. **Create a project** → nom = `gestion-pannes` (région au choix).
3. Dans le projet, ouvrez **Connection Details** → copiez l'URL de connexion (format
   `postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/gestion-pannes?sslmode=require`).
   Gardez-la : c'est la variable `DATABASE_URL`.

> Neon met la base en sommeil après ~5 min sans activité ; au premier appel elle redémarre
> (quelques secondes). Normal.

## 2. Render — déployer le backend + frontend

1. Créez un compte sur https://render.com (gratuit).
2. **New → Web Service**, puis connectez votre dépôt GitHub `gestion-pannes`.
3. Paramètres :
   - **Name** : `gestion-pannes`
   - **Environment** : `Python`
   - **Build Command** :
     ```
     pip install -r backend/requirements.txt && npm --prefix frontend ci && npm --prefix frontend run build && python backend/manage.py collectstatic --noinput
     ```
   - **Start Command** : `./start.sh`
4. **Advanced → Environment Variables** :
   | Variable | Valeur |
   |---|---|
   | `SECRET_KEY` | Une clé aléatoire (générez-en une, ex. https://djecrety.ir) |
   | `DEBUG` | `False` |
   | `DATABASE_URL` | l'URL Neon copiée ci-dessus |
   | `ALLOWED_HOSTS` | `monsite.onrender.com` (votre URL Render) |
   | `CORS_ALLOWED_ORIGINS` | `https://monsite.onrender.com` |
   | `CSRF_TRUSTED_ORIGINS` | `https://monsite.onrender.com` |
   | `DJANGO_SERVE_SPA` | `True` |
5. **Create Web Service**. Au premier déploiement, la DB est créée automatiquement (`migrate` dans le Procfile).

## 3. Créer le premier compte admin

Depuis le terminal Render (onglet **Shell**, le temps que votre service tourne) :

```
python backend/manage.py createsuperuser
```

Ensuite connectez-vous à `https://monsite.onrender.com/admin/` pour créer les sites et les informaticiens.

> Astuce : créez un compte ADMIN_GENERAL via le shell avec un mot de passe fort.
> Les comptes INFORMATICIEN se créent depuis l'interface admin du site.

## 4. Vérifier

- Ouvrez `https://monsite.onrender.com` → l'application React se charge (côté login).
- Connectez-vous avec le compte admin créé.

## FAQ / incidents

- **Erreur 500 au premier chargement** : vérifiez que `DATABASE_URL` pointe bien vers Neon
  et que `DEBUG=False`. Consultez les logs Render.
- **Migrations** : le Procfile lance `migrate` au démarrage, automatique à chaque déploiement.
- **Données locales** : `db.sqlite3` n'est jamais envoyé ; Neon part de zéro,
  recréez sites + utilisateurs.
- **Nom de domaine** : Render gratuit fournit une URL `*.onrender.com`. Un domaine personnel
  nécessite le plan payant.

## Commandes locales utiles (pour reproduire en prod sur votre machine)

```powershell
# Tester le mode production-like en local (le mode "DEBUG=False" exige une SECRET_KEY)
$env:DJANGO_SERVE_SPA="True"
$env:DEBUG="False"
$env:SECRET_KEY="votre-cle"
$env:ALLOWED_HOSTS="localhost,127.0.0.1"
cd backend; ..\.venv\Scripts\python.exe manage.py collectstatic --noinput; ..\.venv\Scripts\python.exe manage.py runserver
```
> `gunicorn` ne fonctionne pas sous Windows (serveur Unix). En local, `runserver` suffit ;
> sur Render c'est `gunicorn` qui sert via `start.sh`.