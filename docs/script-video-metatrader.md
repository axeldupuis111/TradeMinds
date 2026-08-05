# Script vidéo : connecter MetaTrader 4 / 5 à TradeDiscipline

Durée visée : **4 à 5 minutes**. Une seule vidéo pour MT4 et MT5, tournée sur
MT5, avec les différences MT4 annoncées à l'oral au moment où elles arrivent.
Tourner deux vidéos séparées doublerait le travail pour trois mots qui changent.

Format : capture d'écran plein écran + voix off. Pas de webcam, pas d'intro
animée. Personne ne regarde un tuto de branchement pour le style.

---

## Avant de lancer l'enregistrement

- [ ] Compte de démonstration MetaTrader propre, avec quelques trades clôturés
      dans les 90 derniers jours (sinon la fin de la vidéo ne montre rien).
- [ ] Compte TradeDiscipline de test en Premium, onglet Réglages ouvert.
- [ ] **Retélécharger le .mq5 depuis l'app** : l'EA a été corrigé (v1.10), un
      ancien fichier ne remonterait pas les trades ouverts longtemps.
- [ ] Zoom Windows à 125 % minimum, sinon les menus MetaTrader sont illisibles
      en vidéo.
- [ ] **Masquer le solde du compte et le token réel** au montage, ou utiliser un
      token de test à révoquer après.
- [ ] Fermer les notifications (mode Concentration de Windows).

---

## Plan 1 : l'accroche (0:00 à 0:20)

**À l'écran :** la page « Mes Trades » de TradeDiscipline, remplie.

**À dire :**

> En 5 minutes, tes trades MetaTrader arrivent tout seuls dans TradeDiscipline.
> Tu ne saisis plus rien à la main, et ça continue de tourner ensuite sans que
> tu y touches. C'est à faire une seule fois. Si tu es sur Exness, c'est la même
> chose : Exness utilise MetaTrader.

**Ne dis pas** « bonjour à tous, bienvenue sur cette nouvelle vidéo ». On entre
dans le sujet.

---

## Plan 2 : copier le token (0:20 à 0:40)

**À l'écran :** Réglages, la section MetaTrader, bouton « Copier ».

**À dire :**

> Dans Réglages, tu cliques sur Copier. Ce code, c'est ce qui relie MetaTrader à
> ton compte. Tu le gardes dans le presse-papiers, on s'en sert à la fin, une
> seule fois. Ne le partage avec personne.

---

## Plan 3 : télécharger le bon fichier (0:40 à 1:00)

**À l'écran :** les deux boutons de téléchargement, puis le dossier
Téléchargements avec le fichier dedans.

**À dire :**

> Deux fichiers : le .mq5 pour MetaTrader 5, le .mq4 pour MetaTrader 4. Si tu ne
> sais pas laquelle tu as, regarde la barre de titre de MetaTrader, c'est écrit
> dedans. Je prends le .mq5.

---

## Plan 4 : déposer le fichier au bon endroit (1:00 à 1:50)

C'est **le plan le plus important de la vidéo**. C'est là que la majorité des
gens abandonnent. Ralentis, montre chaque clic.

**À l'écran :** MetaTrader, menu Fichier, « Ouvrir le dossier des données »,
puis MQL5, puis Experts, puis le glisser-déposer du fichier.

**À dire :**

> Attention, c'est l'étape où tout le monde se plante. Le fichier ne sert à rien
> dans Téléchargements, il faut le déposer dans MetaTrader.
>
> Dans MetaTrader : Fichier, puis « Ouvrir le dossier des données ». Une fenêtre
> Windows s'ouvre. Tu entres dans le dossier MQL5, puis dans Experts. Sur
> MetaTrader 4 le dossier s'appelle MQL4, tout le reste est identique.
>
> Et tu glisses le fichier téléchargé dedans. Voilà, il est au bon endroit.

---

## Plan 5 : compiler (1:50 à 2:20)

**À l'écran :** F4, MetaEditor, double-clic sur TradeDiscipline, F7, et un zoom
sur « 0 error(s), 0 warning(s) ».

**À dire :**

> Retour dans MetaTrader, tu appuies sur F4. MetaEditor s'ouvre. À gauche, tu
> déplies Experts et tu double-cliques sur TradeDiscipline. Puis F7 pour
> compiler.
>
> En bas, tu dois lire « 0 error, 0 warning ». Si tu as une erreur ici, c'est
> presque toujours que le fichier n'est pas dans le bon dossier : refais l'étape
> d'avant.

---

## Plan 6 : autoriser l'accès web (2:20 à 3:10)

Deuxième plan critique. **Zoome sur l'URL au moment de la taper.**

**À l'écran :** Outils, Options, onglet Conseillers Experts, les deux cases
cochées, double-clic sur la ligne vide, saisie de l'URL.

**À dire :**

> Outils, puis Options, onglet Conseillers Experts. Sur MetaTrader 4 l'onglet
> s'appelle Expert Advisors.
>
> Tu coches « Autoriser le trading algorithmique », et « Autoriser les
> WebRequest pour les URL listées ». Puis dans la liste juste en dessous, tu
> double-cliques sur la ligne vide et tu tapes exactement ça :
> https www point tradediscipline point app.
>
> Trois choses à ne pas rater : il faut le www, il ne faut pas de barre oblique
> à la fin, et il ne faut pas ajouter slash api. C'est la première cause de
> « rien ne se synchronise ». Entrée, puis OK.

---

## Plan 7 : attacher l'EA au graphique (3:10 à 4:10)

**À l'écran :** n'importe quel graphique, Ctrl+N, glisser TradeDiscipline sur le
graphique, onglet Général, la case à cocher, onglet Paramètres d'entrée, collage
du token, OK. Puis zoom sur le visage souriant en haut à droite.

**À dire :**

> Ouvre n'importe quel graphique, peu importe lequel. Ctrl+N pour le Navigateur,
> tu déplies Expert Advisors. Si TradeDiscipline n'apparaît pas, clic droit,
> Actualiser.
>
> Tu le glisses sur le graphique. Onglet Général : tu coches « Autoriser le
> trading algorithmique ». Rassure-toi, cet outil ne passe aucun ordre, il lit
> seulement ton historique, mais MetaTrader demande cette case pour autoriser la
> connexion.
>
> Onglet Paramètres d'entrée : sur la ligne SyncToken, double-clic dans la
> colonne Valeur, et tu colles le code copié au début. OK.
>
> En haut à droite du graphique, tu dois voir TradeDiscipline avec un visage
> souriant. Si c'est un visage triste ou une croix, clique sur le bouton
> AutoTrading dans la barre d'outils pour qu'il passe au vert.

---

## Plan 8 : la preuve (4:10 à 4:40)

Ne coupe pas ici. **C'est le plan qui donne envie de le faire.**

**À l'écran :** l'onglet Experts en bas de MetaTrader avec la ligne de
démarrage, puis bascule sur TradeDiscipline et rafraîchis « Mes Trades » qui se
remplit.

**À dire :**

> En bas de MetaTrader, onglet Experts, tu lis « demarrage, envoi de
> l'historique des 90 derniers jours ». Sur MetaTrader 4, cet onglet s'appelle
> Journal.
>
> Et voilà. Tes 90 derniers jours sont arrivés. À partir de maintenant, chaque
> trade que tu clôtures remonte tout seul.

---

## Plan 9 : la fin (4:40 à 5:00)

**À dire :**

> Si rien n'arrive, trois causes dans cet ordre : le bouton AutoTrading n'est
> pas vert, l'URL a été tapée sans le www, ou le token a été collé avec un
> espace. Vérifie ces trois-là.
>
> Laisse MetaTrader ouvert pour que la synchro tourne. C'est tout.

---

## Ce qu'il ne faut pas faire

- **Ne pas couper au montage pendant les étapes 4 et 6.** Ce sont celles qui
  bloquent ; les accélérer annule l'intérêt de la vidéo.
- **Ne pas dire « c'est très simple ».** Celui qui bloque se sent bête et
  abandonne. Dire plutôt « c'est l'étape où tout le monde se plante ».
- **Ne pas montrer ton vrai solde ni ton vrai token.**
- **Ne pas promettre de gain.** Rien sur la performance, uniquement le
  branchement (même règle que pour les défis communautaires).

## Après le tournage

Mettre la vidéo en lien depuis le guide MetaTrader dans l'app
(`lib/sync-guides/metatrader.ts`). Dis-le moi et je câble le lien.
