# Abidjan Life

Jeu de vie en monde ouvert 3D, dans le navigateur, situé à Yopougon (Abidjan, Côte d'Ivoire).
Marche, prends le gbaka ou le taxi, travaille, investis, achète tes meubles, vole une voiture, fais face à la police — et, en ligne, retrouve tes amis, forme un clan et participe à des saisons de survie.

- **Front** : page statique (three.js), déployable sur Vercel → dossier [`web/`](web)
- **Serveur multijoueur** : Node.js + WebSocket → dossier [`server/`](server)
- Fonctionne **en solo** sans serveur ; le multijoueur s'active dès qu'une adresse de serveur est configurée.

## Fonctionnalités
- Monde ouvert : Cosmos, Gandhi, Selmer, Sicogi, Toits Rouges, Ficgayo… routes, circulation, bus SOTRA, gbakas, taxis.
- Téléphone : carte et GPS, taxi, lignes, quêtes, investissements, boulots, banque, bourse, business, élections (candidats fictifs), meubles, messages, social.
- Vie : faim, énergie, hygiène, loisirs ; logement et meubles personnalisables ; tenues et chaussures.
- Action : bagarres, vol et conduite de voitures, niveau de recherche et police.
- En ligne : comptes, amis, clans, chat, combats entre joueurs, saisons de survie (inscriptions puis clôture, dernier survivant).

## Démarrer en local
```bash
# Front seul (solo)
cd web && npx serve .

# Serveur multijoueur + jeu servi par le serveur
cd server && npm install && cp ../web/index.html public/index.html && npm start
# puis ouvrir http://localhost:3000
```

## Déploiement
Voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) (front sur Vercel, serveur sur un VPS Ubuntu).

## Commandes de jeu
| Action | Clavier | Mobile |
|---|---|---|
| Marcher | ZQSD / flèches (Maj : courir, Espace : sauter) | joystick |
| Interagir / monter / descendre | E | bouton E |
| Frapper | F | bouton COUP |
| Conduire | ZQSD / flèches, Espace : frein, S : marche arrière | joystick |
| Chat | Entrée (`/c` clan, `/m pseudo` privé) | bouton 💬 |

## Remarques
- L'argent du jeu est fictif. Les candidats, entreprises et marques des événements sont fictifs.
- Un concours avec récompense réelle relève de la réglementation locale : à faire valider avant lancement.
- Crédits et licences des ressources : voir [`CREDITS.md`](CREDITS.md).

## Licence
[MIT](LICENSE)
