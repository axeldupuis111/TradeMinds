# Ce que le backtest a mesuré, et pourquoi on le construit

Mesure du 27 août 2026. Données brutes de la passe : `backtest-mesure-xauusd.txt`.

## Le point de départ

Une vidéo montre un outil de backtest fait avec Claude Code, sur une stratégie
d'ouverture de New York en M1 (« NY Open M5 FVG Retest ») appliquée à l'or. Ses
chiffres publics, sur 2024-01-03 → 2026-07-02 :

| | |
|---|---|
| trades | 408 |
| taux de réussite | 34,07 % |
| profit factor | 1,0335 |
| total | +9,0 R, soit +900 $ sur 10 000 $ |
| spread / glissement / commission | **0 / 0 / 0** |
| verdict affiché | vert, « EDGE DESTROYED BY COST : NO » |

## Ce qu'on a mesuré nous-mêmes

Même stratégie, paramètre pour paramètre, rejouée sur **710 187 bougies M1
réelles de XAUUSD** (Dukascopy, 24 mois, 2024-01 → 2025-12, zéro bougie écartée).
Moteur : 220 ms.

### En reprenant son réglage à coûts nuls

| | nous | lui |
|---|---|---|
| trades | 359 | 408 |
| taux de réussite | **34,26 %** | **34,07 %** |
| profit factor | 1,0091 | 1,0335 |
| total | +2,14 R | +9,0 R |

Deux implémentations indépendantes des mêmes règles tombent à **0,19 point** l'une
de l'autre sur le taux de réussite. Le moteur est juste, et le sien aussi.

Mais notre intervalle à 95 % de l'espérance va de **-0,139 à +0,151**. Il contient
zéro. Ces 359 trades ne démontrent rien du tout, et les 408 de la vidéo non plus.
Verdict : **on ne peut pas conclure.**

### En payant ce que l'or coûte vraiment

Spread 0,20 $, glissement 2 ticks, commission ~7 $/lot, soit 31 ticks d'aller-retour.

| | |
|---|---|
| espérance | **-0,3345 R par trade** |
| intervalle 95 % | -0,484 … -0,185 |
| profit factor | 0,62 |
| total | **-120,08 R** |
| drawdown maximum | 122,31 R |
| verdict | **négatif** |

À 1 % de risque par trade sur 10 000 $, -120 R c'est le compte vidé, plusieurs fois.

## La raison tient en une ligne

Le stop moyen de cette stratégie vaut **1,33 $ sur l'or**. L'aller-retour en coûte
**0,31 $**. Le trader paie donc **23 % de son risque à chaque trade**, avant même
d'avoir raison ou tort. Aucune méthode à 2R ne survit à ça.

Ce n'est pas une faute de calcul dans l'outil de la vidéo : ses maths sont
justes. C'est un **défaut de réglage laissé à zéro**, et une **absence
d'intervalle de confiance**. Deux omissions, et une stratégie qui ruine un compte
s'affiche en vert.

## Ce que ça décide pour nous

1. **Les coûts par défaut ne sont jamais nuls** (`coutsParDefaut`, épinglé par un test).
2. **L'espérance ne s'affiche jamais sans son intervalle à 95 %.**
3. **« Positif » exige que zéro soit hors de l'intervalle.** Le vert devient rare, c'est voulu.
4. **Sous 100 trades, aucun chiffre de performance n'est calculé**, pas même en interne.
5. **Le mot « rentable » n'apparaît nulle part.** On dit ce qu'on a mesuré, sur quelle
   période, avec quels coûts. La rentabilité d'un trader dépend de son exécution et de
   sa discipline autant que de sa méthode.

Le moteur n'est pas la fonctionnalité. La fonctionnalité, c'est la couche qui
refuse de conclure, et c'est elle qui nous distingue.

---

# Le catalogue, rejoué en entier sur du réel (2026-08-28)

Vingt-neuf blocs, chacun rejoué seul sur les **1 361 661 bougies M1 du Nasdaq**
regroupées en M5, quatre ans de marché.

La question posée n'est pas « ce bloc gagne-t-il de l'argent » (elle n'a pas de
sens hors d'une stratégie complète) mais **« ce bloc produit-il quelque chose »**.
Un bloc qui ne rend jamais un trade figure quand même au catalogue, le
compilateur le choisit, et le trader lit « zéro trade » en croyant que sa méthode
est en cause alors que la faute est chez nous.

## Ce que la mesure a trouvé

**Un bloc mort : le stop « derrière le dernier sommet ».**
**33 216 signaux, zéro trade.** Il lisait les pivots calculés par le *bloc de
niveau*, or seuls trois niveaux en calculent (trendline, liquidité de swing,
retracement). Avec n'importe quel autre niveau, aucun pivot n'existait et le
moteur refusait chaque trade **en silence**.

C'est exactement le genre de panne qu'on ne voit pas : le rapport dit « aucun
trade », le trader en conclut que sa méthode ne se déclenche jamais, et il a
tort. Le stop porte maintenant sa propre définition de sommet.

Corrigé : **170 trades** sur la même période.

**Une zone qui se déclenchait sur sa propre bougie de naissance.**
Un order block, un FVG ou un retracement naissent souvent *autour* du prix
courant. On déclarait alors que le prix en était « dehors », donc que la bougie
suivante y « entrait » : l'entrée se faisait sur l'impulsion au lieu du retour,
le contraire de ce que décrit la méthode. La position du prix est désormais
constatée à la naissance de la zone.

**Un piège de pivot sur le retracement.** En tolérant l'égalité, un marché plat
rend chaque bougie à la fois sommet et creux : la « jambe » se réduit à une seule
bougie et la tranche se recalcule sur du bruit. Comparaison stricte, et les deux
extrémités doivent être deux bougies distinctes.

## L'état après correction

| famille | blocs | tous vivants |
|---|---|---|
| niveaux | 12 | ✅ |
| déclencheurs | 6 | ✅ |
| stops | 5 | ✅ |
| confirmations | 8 | ✅ |

Deux écarts d'usage valent d'être notés, parce qu'ils ne sont pas des défauts :

- **`rsi` en mode excès : 4 trades contre 23 508 en mode élan.** Le même
  indicateur, le même seuil, la même série. C'est la démonstration chiffrée que
  les deux modes sont opposés et qu'en confondre un pour l'autre ne se voit
  dans aucun chiffre du rapport.
- **`divergence` : 3 213 trades contre 23 770 sans filtre.** Très sélectif, d'où
  la consigne donnée au compilateur de ne le poser que si le trader en parle.

## Ce que ça décide pour nous

6. **Un bloc ajouté au catalogue se rejoue sur les quatre ans avant d'être
   proposé.** Un bloc qui ne produit rien est un écran vide dont le trader
   s'accuse.
7. **Le catalogue doit rester d'accord avec lui-même de bout en bout.** Un test
   lit les fichiers source et vérifie que tout bloc proposé au modèle est connu
   du validateur ET visible dans l'éditeur. Un bloc que le modèle peut choisir
   mais que le trader ne peut pas corriger rompt toute la boucle de vérification.

---

# Ce que les captures d'écran ont révélé (2026-08-28)

Quatre captures d'un backtest réel sur le NAS100. Cinq défauts, dont trois
silencieux.

## 1. La droite dessinée n'était pas la droite calculée

Le moteur interpole une trendline sur l'**index** des bougies. Le graphique la
redessinait sur l'**horodatage**, en supposant un pas de temps constant. Les
deux ne coïncident que sur un marché ouvert en continu : dès qu'une nuit ou un
week-end passe, l'écart s'installe.

Sur le Nasdaq, la droite s'affichait à plusieurs centaines de points de son vrai
niveau, et **ses propres touches ne tombaient plus dessus**. Le trader regardait
un objet qui ne touchait rien, sous une légende disant « 3 touches ».

C'est le défaut le plus grave du lot : toute la fonctionnalité repose sur « je
regarde et je reconnais ma méthode ». Un graphique faux ne casse pas un chiffre,
il casse la seule vérification qui compte.

Les positions arrivent désormais en index de bougie, et l'accord est exact par
construction. Un test rejoue une série **trouée** et vérifie que chaque touche
tombe sur la droite ; un second vérifie que la conversion par le temps, elle, se
trompe de plus de dix ticks. Sur une série continue, la version fausse passait
sans broncher : c'est le trou qui révèle le défaut.

## 2. Un filtre déclaré qui ne filtrait rien

La fiche disait « je ne prends que dans le sens de la tendance H1 ». Traduit en
moyenne mobile à **4 bougies** sur un plan en M15, le filtre couvrait une heure
de données. Une moyenne aussi courte ne peut pas contredire une cassure : casser
le plus haut des vingt dernières bougies place forcément la clôture au-dessus.

Mesuré sur quatre ans de Nasdaq :

| période | trades gardés |
|---|---|
| MM4 (1 h de données) | **100 %** |
| MM20 | 100 % |
| MM40 | 98,8 % |
| MM80 (20 bougies H1) | 88,3 % |
| MM200 | 74,7 % |

L'écran affichait « filtre de tendance : traduit », et le backtest tournait sans
filtre directionnel. Le rapport était propre, les chiffres justes, et ils
décrivaient une autre stratégie que celle de la fiche.

Deux corrections. Le compilateur reçoit la règle de conversion : 20 à 50 bougies
**de l'unité de tendance**, converties dans l'unité du plan. Et le moteur compte
désormais, pour chaque filtre, **combien de signaux il a refusés** ; un filtre à
zéro refus est affiché comme tel.

⚠️ Ce compteur est pris DANS le moteur, pas par différence. Rejouer le plan privé
du filtre sous-compte : le moteur ne tient qu'une position à la fois, donc lever
un refus ouvre un trade plus tôt, qui bloque à son tour des signaux plus tardifs.
Mesuré : **34 signaux refusés pour un écart de 14 trades**.

## 3. Deux filtres du même type partageaient un seul calcul

Trouvé en écrivant le test précédent. Le moteur cherchait « la » confirmation
d'un type donné avec un `find`, puis précalculait sa série une fois. Deux blocs
du même type — le compilateur en pose jusqu'à trois — lisaient tous la série du
**premier**. Un filtre « moyenne 120 » tournait avec une moyenne 3.

## 4. L'écran annonçait douze trades quand il en avait trois

La phrase d'introduction des aperçus était écrite en dur. Sur un plan qui avait
produit trois trades, l'écran mentait sur ses propres données, juste au-dessus
d'un encart expliquant qu'il en manquait 97.

## 5. Deux fautes de finition

« 1 règles non mécanisables », et une explication coupée en plein mot
(« filtre directionnel explic »). La coupe se fait maintenant sur un espace,
avec des points de suspension, et la place accordée à une justification est
passée de 200 à 320 caractères : c'est le texte sur lequel le trader décide si
la machine a compris sa méthode.

---

# Deuxième passe de captures (2026-08-28)

La trendline touche enfin ses sommets. Quatre défauts restants, tous sur la
lisibilité de l'aperçu, c'est-à-dire sur la seule vérification qui compte.

## 1. Un trade long perdait son propre début

Sur un gagnant de +2R, le trait d'entrée flottait **sous toutes les bougies
visibles**. La borne de largeur de la fenêtre rognait à gauche depuis la
**sortie** : dès qu'un trade durait plus de cent quarante bougies, le rognage
passait devant l'entrée, et l'aperçu montrait une fin de trade sans son début.

Le signal est maintenant une borne dure. Un trade plus long que la limite rend
une fenêtre plus large : des bougies fines valent mieux qu'un trade amputé. Le
calcul est sorti du worker vers `apercu.ts` pour être testable, ce qu'il n'était
pas.

## 2. Soixante pour cent du cadre pour un objectif jamais atteint

L'objectif ancrait l'échelle au même titre que l'entrée et le stop. Sur un trade
perdant à 2R, il se trouve à deux fois le risque au-dessus de l'entrée, dans une
zone où le prix n'est jamais allé : le cadre s'étirait pour l'accueillir et les
bougies s'écrasaient sur le tiers inférieur.

**Le cadre montre ce qui s'est passé, pas ce qui était espéré.** L'échelle
s'ancre sur l'entrée, le stop et la **sortie** — trois faits du trade. Un
objectif atteint y entre par la sortie ; un objectif manqué s'affiche en marge,
comme le niveau hors cadre. La zone verte est bornée au cadre : peindre jusqu'à
un objectif hors champ donnait à un trade perdant l'allure d'un gagnant.

## 3. « 0 signal refusé » sur sept signaux ne prouve rien

L'alerte de filtre inerte s'affichait sur un plan qui n'avait produit que sept
signaux. Sur sept tirages, ne jamais tomber du mauvais côté n'a rien
d'étonnant : c'était refaire à l'échelle du filtre l'erreur que toute cette
fonctionnalité corrige à l'échelle du résultat.

Le compte s'affiche désormais avec son dénominateur (« 0 refusés sur 7
examinés »), et l'alerte ne se déclenche qu'à partir de trente occasions.

## 4. Deux libellés superposés

Le nom de la trendline se posait sur le prix d'entrée quand les deux tombaient à
la même hauteur. Décalé quand l'écart est inférieur à quatorze pixels.

---

# Sept trades en quatre ans pour une méthode hebdomadaire (2026-08-28)

Axel prend plusieurs trades par semaine avec sa méthode de trendline. Le moteur
en trouvait **sept en quatre ans**. Un facteur cent : ce n'est pas un réglage,
c'est une définition fausse.

## La cause

Le moteur ne suivait qu'**une seule droite candidate à la fois**, ancrée sur
deux pivots **consécutifs**. Dès qu'un pivot ne tombait pas dessus, la candidate
était jetée et remplacée par la paire (pivot précédent, nouveau pivot). Pour
atteindre trois touches, il fallait donc trois pivots consécutifs alignés.

Personne ne trace comme ça. Un trader regarde les derniers sommets, relie **ceux
qui s'alignent**, et ignore les autres : sa droite passe par les pivots 1, 4 et
9 sans rien devoir aux 2, 3, 5 à 8.

## La mesure

Sur les 23 489 bougies H1 du Nasdaq, trois touches exigées :

| pivots | tolérance | pivots consécutifs | pivots au choix | rapport |
|---|---|---|---|---|
| 3 | 6 pts | 157 | 2 496 | ×16 |
| 3 | 20 pts | 420 | 2 625 | ×6 |
| 5 | 6 pts | **75** | **1 419** | **×19** |
| 5 | 20 pts | 220 | 1 603 | ×7 |
| 5 | 50 pts | 437 | 1 389 | ×3 |

Le moteur suit désormais plusieurs droites en parallèle. Chaque pivot qui ne
tombe sur aucune droite vivante en ouvre de nouvelles, appariées avec chacun des
six derniers pivots et non plus avec le seul précédent. La droite exposée est la
**confirmée la plus proche du prix** : celle que le trader surveille, celle qui
est sur le point d'être cassée.

## Ce que ça change sur la stratégie complète

NAS100 en H1, trendline à trois touches, cassure, stop derrière le dernier
pivot, RR 1:2, filtre de tendance MM40, coûts réels :

| pivots | tolérance | trades sur 4 ans | par semaine | espérance |
|---|---|---|---|---|
| 5 | 6 pts | 128 | 0,6 | +0,217 R [-0,04 ; 0,47] |
| 5 | 20 pts | 164 | 0,8 | +0,118 R [-0,11 ; 0,34] |
| 3 | 20 pts | 270 | 1,3 | -0,015 R [-0,19 ; 0,16] |

**Sept trades sont devenus 128 à 270**, soit environ un par semaine. L'ordre de
grandeur correspond enfin à ce que décrit le trader.

⚠️ Et le verdict reste **non concluant** dans les six réglages testés : zéro est
dans l'intervalle à chaque fois. Le meilleur chiffre (+0,217 R) est le meilleur
de six essais, ce qui est exactement la situation contre laquelle le compteur de
rejeux existe. On a corrigé la mesure, pas trouvé un avantage.

## Ce que ça décide pour nous

8. **Un écart d'un facteur dix entre ce que le trader vit et ce que le moteur
   trouve est un bug, pas une découverte.** Le premier réflexe doit être de
   remettre en cause la définition, pas la stratégie.
9. **La tolérance d'alignement se mesure sur le PRIX, pas sur le spread.** Un
   trait tracé à la main a une épaisseur, de l'ordre du millième du prix. Le
   spread n'a rien à voir avec la précision de la main.

---

# Un pire recul de -148,4 % (2026-08-28)

Avec 634 trades, l'outil conclut enfin quelque chose : « on ne peut pas
conclure », +0,0712 R par trade, intervalle [-0,042 ; 0,185], zéro dedans. C'est
le bon comportement.

Mais juste en dessous, la carte « ce que ça fait à ton compte » affichait :

> Pire recul du compte : **-148,4 %**

On ne perd pas cent quarante-huit pour cent d'un compte. Le calcul multipliait le
pire recul en R par le risque par trade (29,7 × 5), c'est-à-dire qu'il rapportait
un recul au capital de **départ**, alors qu'un recul se mesure depuis le
**sommet** qui le précède.

Les mêmes 29,7 R survenus après une hausse à +50 R font tomber un compte de 3,5
fois la mise à 2,0 fois : c'est **-42 %**, pas -148 %.

Mesuré sur la stratégie compilée, quatre ans de NAS100 :

| risque par trade | pire recul, vrai calcul | ce qui s'affichait |
|---|---|---|
| 5 % | -76,6 % | -175,9 % |
| 2 % | -46,3 % | -70,4 % |
| 1 % | -27,9 % | -35,2 % |
| 0,5 % | -15,6 % | -17,6 % |

Un nombre impossible ne se contente pas d'être faux : il décrédibilise tous les
chiffres justes qui l'entourent. Le trader qui lit -148 % cesse de croire
l'intervalle de confiance affiché deux centimètres plus haut.

Le calcul est maintenant une fonction pure et testée. Elle détecte aussi la
**ruine** : à 5 % par trade, il faut -20 R depuis le départ pour tout perdre. Un
compte vidé au trade 150 ne prend pas les 484 suivants, et le total de la période
ne veut alors plus rien dire — l'écran le dit au lieu d'afficher un gain qui
suppose de continuer à trader sans argent.

## Ce que ça décide pour nous

10. **Un chiffre borné par nature doit être borné dans le code.** Un pourcentage
    de perte ne dépasse pas cent. Quand la formule le permet, c'est la formule
    qui est fausse, pas le cas limite qui est rare.

---

# Les propositions (2026-08-29)

Demande d'Axel : « j'aimerais avoir plein de possibilités, d'options, de
propositions à activer et à accepter : réduire le risque, améliorer les gains,
plus de trades ».

Deux de ces trois-là se proposent honnêtement. Le troisième, non, et il valait
mieux savoir le dire que faire semblant.

## Ce qu'on s'autorise

Trois objectifs, chacun avec des leviers **choisis par raisonnement, pas par
balayage** :

| objectif | pourquoi ces leviers |
|---|---|
| Avoir assez de trades | une droite plus épaisse, un pivot plus étroit, une unité de temps plus fine produisent **mécaniquement** plus d'occasions |
| Protéger le compte | baisser le risque, couper la journée après N pertes : on ne cherche pas à gagner, on cherche à survivre |
| Alléger les coûts | le coût d'un aller-retour est **fixe en points** ; ce qui change, c'est la taille du risque auquel il se compare |

## Ce qu'on refuse, et c'est écrit à l'écran

**Il n'y a pas de bouton « améliorer mes gains ».** Essayer vingt réglages et
garder celui qui sort le meilleur chiffre en trouve toujours un, même dans du
hasard pur. Le faire à la place du trader serait pire que le trader qui le fait
à la main, parce que ça aurait l'air d'un conseil.

Trois garde-fous dans le code, pas seulement dans les commentaires :

1. **Le module ne lit jamais l'espérance ni le total d'une variante.** Un test
   lit le fichier source et échoue si `esperance`, `lireBacktest`, `totalR` ou
   un `.sort(` y apparaissent.
2. **Aucune proposition ne porte de chiffre de performance.** Un test épingle la
   liste exacte des champs rendus : trades, recul du compte, part des coûts.
3. **Le filtre porte sur l'OBJECTIF, jamais sur le résultat.** « Ce réglage
   produit plus de trades » est un fait mécanique sur la taille de
   l'échantillon ; « ce réglage a rapporté davantage » serait un choix fait
   après coup sur une période connue.

## Ce que la mesure a corrigé en route

**Une proposition « plus de trades » qui en rendait moins.** Sur la vraie
stratégie, « épaissir la trendline » donnait 449 trades au lieu de 522 : une
droite plus épaisse se confirme plus tôt, donc meurt plus tôt. Elle figurait
pourtant sous cet objectif. Chaque proposition est maintenant vérifiée contre sa
propre promesse, avec un écart minimal de 10 % pour ne pas encombrer la liste de
changements invisibles.

**Baisser le risque ne divise pas le recul proportionnellement.** On croit qu'en
divisant son risque par deux on divise son pire recul par deux. C'est faux dès
que le compte a grossi : le recul se mesure depuis le sommet, et un risque plus
petit fait aussi un sommet plus bas. Sur la même suite montée à +50 R puis rendue
de 29,7 R, passer de 5 % à 2,5 % fait -42,4 % → -32,7 %, pas la moitié. Ne pas
le savoir aurait fait écrire un conseil faux.

## Le coût

Sept propositions mesurées en **3,7 secondes** sur quatre ans de Nasdaq. C'est
pour ça qu'elles sont **sur demande** : les calculer à chaque lancement ferait
payer cette attente à tout le monde, y compris à ceux qui ne les regardent pas.

## Deux clés de traduction affichées brutes

`bt_collisions_1` s'est affichée telle quelle dans le rapport. Le test de parité
ne pouvait pas l'attraper : il compare les quatre langues entre elles, et la clé
manquait dans les quatre. Un nouveau test part du **code** et vérifie que ce
qu'il appelle existe.
