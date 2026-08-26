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
