# Ce que le backtest a dit de la fiche « liquidité BSL/SSL »

Mesure du 27 août 2026, sur 710 187 bougies M1 réelles de XAUUSD (2024-01 → 2025-12).
Chiffres bruts : `backtest-mesure-fiche-axel.txt`.

C'est la première fiche réelle passée au compilateur, et elle a servi à
dimensionner le catalogue de blocs. Elle ne compilait pas : le bloc FVG existant
était une **continuation après cassure**, alors que cette méthode est un
**retournement après balayage**. Trois blocs ont été ajoutés pour elle
(`liquidite_swing`, `balayage_puis_fvg`, stop `extreme_balayage`).

## Ce qui s'est traduit en blocs

| Phrase de la fiche | Bloc |
|---|---|
| « les zones de BSL et SSL au-dessus ou en dessous des anciens sommets et creux » | `liquidite_swing` |
| « j'attends qu'une de ces liquidités soit prise » | temps 1 du déclencheur |
| « une réaction du prix qui montre que le marché rejette cette zone » | temps 2, l'impulsion reconnue à son déséquilibre |
| « le retracement ne doit pas dépasser la zone de prise de liquidité » | invalidation permanente |
| « un FVG situé entre ce BB et le retracement » | temps 3, le déséquilibre à retester |
| « mon entrée se fait dans le FVG » | entrée à l'ouverture suivante |

## Ce qui NE s'est PAS traduit, et qu'il faut dire

**Deux seuils manquants.** « Une réaction **claire** » et « un retracement
**propre** » n'ont pas de valeur chiffrée. Le moteur a pris l'impulsion qui laisse
un déséquilibre, faute de mieux. C'est une interprétation, pas la règle.

**Cinq paramètres absents de la fiche, et ce sont les plus lourds :**

1. **Aucun stop.** Le texte ne dit jamais où il se place. On a déduit
   « au-delà de l'extrême du balayage » du mot invalidation. C'est une déduction.
2. **Aucun objectif.** Rien, nulle part. Ni R:R, ni niveau.
3. **Aucun risque par trade.**
4. **Aucune séance ni plage horaire.**
5. **Aucune unité de temps** pour les « anciens sommets ».

Conséquence directe, et c'est le résultat le plus utile de la mesure : appliquée
littéralement, la fiche produit **15 trades par jour**. Personne ne trade ça. Ce
chiffre n'est pas un défaut du moteur, c'est la preuve chiffrée qu'il manque des
règles.

## Neuf mécanisations, et un résultat qui ne bouge pas

Neuf façons plausibles de combler les trous (structure 1h/2h/4h, séance
14h-20h, plafond de trades, bougie de réaction, objectif 2R ou 3R) :

| mécanisation | trades | /jour | espérance coûts réels | **espérance à coûts nuls** |
|---|---|---|---|---|
| littérale | 11 016 | 15,1 | -0,529 R | **+0,000 R** |
| structure 1h | 8 833 | 12,1 | -0,484 R | **-0,007 R** |
| structure 2h | 8 023 | 11,0 | -0,486 R | **-0,001 R** |
| structure 4h | 7 252 | 9,9 | -0,469 R | **+0,010 R** |
| 2h + séance | 2 569 | 3,5 | -0,339 R | **+0,009 R** |
| 2h + séance + 2/jour | 919 | 1,3 | -0,272 R | **+0,008 R** |
| + bougie de réaction | 432 | 0,6 | -0,203 R | **-0,049 R** |
| objectif 3R | 428 | 0,6 | -0,250 R | **-0,096 R** |
| 4h + séance + 2/jour | 398 | 0,5 | -0,182 R | **-0,012 R** |

**À coûts nuls, l'espérance tourne autour de zéro dans les neuf cas.** Ce n'est
pas un réglage malchanceux : c'est constant. La version mécanique de cette
entrée n'a pas d'avantage mesurable sur l'or en M1, avant même de payer quoi que
ce soit.

Les coûts font ensuite le reste : sur un risque moyen de 1,43 $, l'aller-retour
coûte 0,31 $, soit **21,7 % du risque à chaque trade**.

## La lecture honnête

Ce n'est pas « la stratégie perd de l'argent ». C'est :

- **la part mécanisable de la fiche n'a pas d'avantage démontrable** ;
- **la part non mécanisable est précisément celle où un trader discrétionnaire
  décide** : ce qui fait qu'une réaction est « claire », qu'un retracement est
  « propre », que le contexte est bon ;
- **et la fiche décrit une entrée, pas une stratégie.** Sans stop, sans objectif,
  sans risque et sans séance, elle ne peut ni être testée, ni être exécutée deux
  fois de la même façon par la même personne.

C'est exactement ce que l'outil doit rendre : pas un verdict sur le trader, mais
la liste de ce qu'il lui reste à écrire pour que sa méthode devienne vérifiable.
