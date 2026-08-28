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
