# Déploiement

Le front et le serveur sont séparés : le front est statique (Vercel), le serveur tient les comptes, les positions et les combats (VPS).

## 1. Serveur (VPS Ubuntu 24.04)
1. Pointer un sous-domaine (ex. `api.mondomaine.com`) vers l'IP du serveur (enregistrement DNS de type A).
2. Copier le dossier `server/` sur le serveur, puis :
   ```bash
   cd server
   DOMAIN=api.mondomaine.com ORIGINS=https://abidjan-life.vercel.app bash install.sh
   ```
   Le script installe Node.js, crée le service systemd, active le pare-feu, configure Caddy (HTTPS automatique) et affiche la clé d'administration.
3. Vérifier : `curl https://api.mondomaine.com/api/status`.

## 2. Front (Vercel)
1. Importer le dépôt sur Vercel, **Root Directory = `web`**, aucun build.
2. Éditer `web/config.js` :
   ```js
   window.ABIDJAN_CONFIG = { server: "https://api.mondomaine.com" };
   ```
3. Déployer. Ajouter l'adresse Vercel dans `ALLOWED_ORIGINS` du serveur (voir `install.sh`).

## 3. Saisons
```bash
bash saison.sh season "2026-11-02 20:00" "2026-11-07 20:00"   # fin des inscriptions, fin du jeu (UTC)
bash saison.sh free                                          # retour au monde libre
```

## Sécurité
- Mots de passe hachés (scrypt) ; limitation du nombre de tentatives de connexion.
- Origines autorisées contrôlées (`ALLOWED_ORIGINS`) ; ne jamais laisser `*` en production.
- Le port 3000 n'est ouvert que sans domaine (test) ; en production seul HTTPS (443) est exposé.
- Avant tout concours avec récompense réelle : vérification par SMS (non incluse) et validation juridique.
