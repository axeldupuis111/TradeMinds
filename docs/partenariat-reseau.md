# Dossier : partenariat avec un réseau de collaborateurs

Contexte : une société disposant de plusieurs milliers de collaborateurs propose
d'envoyer son réseau chercher des utilisateurs. Répartition demandée : 20 % des
revenus pour le collaborateur qui apporte l'abonné, 10 % pour la société, soit
**30 % du CA encaissé qui sort**.

Ce document sert à trancher les conditions AVANT de construire, parce que deux
points (le taux et la structure de paiement) décident de tout le reste.

---

## 1. Le taux : 30 % passe, mais pas partout

Chiffres issus de `lib/product-margin.ts` (marge au PIRE CAS, abonné qui consomme
tous ses quotas, infrastructure amortie sur 1 000 abonnés) :

| Plan | Prix | Marge à plein quota | Commission à 30 % | Reste |
|---|---|---|---|---|
| Plus | 14,99 € | 4,80 € | 4,50 € | **+0,30 €** |
| Premium | 29,99 € | 1,10 € | 9,00 € | **-7,90 €** |

Lecture : à plein quota, un abonné Premium apporté par le réseau coûte près de
8 € par mois. Le Plus tient de justesse.

Nuance importante : le plein quota n'est pas la consommation réelle. L'usage IA
mesuré aujourd'hui est très en dessous des plafonds, donc en moyenne 30 % se
paie sans difficulté. Le problème est la queue de distribution : avec des
milliers de collaborateurs, les gros consommateurs arrivent mécaniquement, et la
règle dure du produit (le pire cas doit rester à l'équilibre, tenue par
`lib/product-margin.test.ts`) devient fausse dès qu'on sort 30 %.

Trois façons de refermer l'écart, par ordre de préférence :

1. **Assiette limitée aux 12 premiers mois** de chaque abonnement. C'est déjà ce
   que fait le contrat influenceur actuel et ce que calcule
   `app/api/admin/affiliation/route.ts`. Après 12 mois l'abonné redevient
   pleinement rentable, ce qui absorbe les mois déficitaires.
2. **Barème progressif**, appliqué au réseau pris comme un tout (et non
   collaborateur par collaborateur). Les seuils du contrat influenceur (25 % à
   11 abonnés, 30 % à 41) n'ont aucun sens ici : une société qui met des
   centaines de personnes sur le terrain les franchit en trois semaines, et
   l'échelle devient un taux fixe de 30 % déguisé. Le barème réseau est donc
   posé à sa mesure : **20 % jusqu'à 49 abonnés actifs, 25 % de 50 à 199, 30 %
   au delà**. Le partenaire arrive bien aux 30 % qu'il demande, mais après avoir
   prouvé le volume. Les influenceurs déjà sous contrat gardent leurs seuils :
   changer leur barème rétroactivement ferait baisser une rémunération signée.
3. **Plafonner le coût IA** des comptes apportés par le réseau si le déficit se
   matérialise. À garder en réserve, c'est une dégradation du produit.

Recommandation : leur donner le barème actuel tel quel (donc 30 % une fois le
palier atteint, sur 12 mois), et les laisser faire leur découpage 20/10 en
interne. On ne crée pas un régime spécial.

### Le piège TVA, qui transforme 30 % en 36 %

Si la société facture sa commission avec TVA à 20 %, TradeDiscipline étant en
franchise de TVA (art. 293 B) ne la récupère pas : 30 % deviennent 36 % de coût
réel. Le contrat doit écrire **« 30 % toutes taxes comprises »**, pas « 30 % HT ».
Cette seule phrase vaut 6 points de marge.

### Le plafond de la micro-entreprise

Les commissions versées ne sont pas déductibles du chiffre d'affaires : les
cotisations (24,6 % dans le modèle) restent dues sur le brut encaissé, et le
plafond de CA de la micro-entreprise se calcule aussi sur le brut. Si le réseau
fonctionne ne serait-ce qu'à 10 %, le plafond saute dans l'année. Le passage en
société (EURL ou SASU) n'est pas une conséquence lointaine de ce partenariat,
c'en est un prérequis à préparer en parallèle.

---

## 2. La décision structurante : un seul contrat, un seul paiement

**Ne jamais contractualiser avec les collaborateurs.** Trois raisons :

- Chacun devrait avoir un statut (auto-entrepreneur ou VDI) et émettre une
  facture. Multiplier ça par plusieurs milliers est ingérable seul.
- Payer directement des milliers de personnes fait de TradeDiscipline
  l'organisateur d'un réseau de vente, avec les obligations qui vont avec.
- Le moindre litige avec un collaborateur remonterait directement.

Montage retenu : **un contrat avec la société, une facture par mois, un virement
par mois.** La société redistribue à ses collaborateurs selon SON découpage
20/10, sous sa seule responsabilité. Le contrat doit contenir une clause où elle
garantit être seule employeur ou donneur d'ordre de ses collaborateurs, et
garantir TradeDiscipline contre toute réclamation de leur part.

Conséquence côté produit : on doit quand même suivre les ventes **collaborateur
par collaborateur**, sans les payer. Sans ce détail, la société ne peut pas
faire son propre découpage, personne ne peut vérifier un montant, et aucune
fraude n'est détectable.

---

## 3. Garde-fous juridiques à écrire au contrat

Pas un avis d'avocat, une liste de points à faire relire :

- **Interdiction de la vente pyramidale** (art. L.121-15 du code de la
  consommation) : la rémunération doit provenir uniquement d'abonnements
  réellement payés, jamais du recrutement de nouveaux collaborateurs. Aucun
  droit d'entrée, aucun kit payant, aucune prime au recrutement. À écrire noir
  sur blanc, c'est ce qui sépare un programme d'affiliation légal d'un système
  interdit.
- **Aucune promesse de gain.** Interdiction faite aux collaborateurs de
  présenter TradeDiscipline comme un moyen de devenir rentable, de diffuser des
  signaux, ou d'utiliser des captures de performance comme argument. Le filtre
  anti promesse de gain existe déjà côté communautés, il faut le doubler d'une
  charte acceptée par chaque collaborateur à son inscription (case cochée,
  horodatée, stockée).
- **Pas de lien de subordination** : aucune instruction, aucun objectif imposé,
  aucune exclusivité, sinon le statut de la relation devient discutable.
- **Données personnelles** : la société garantit avoir le consentement de ses
  collaborateurs pour la création de leurs comptes et l'affichage de leurs
  statistiques.
- **Clause de sortie** : résiliation possible à tout moment avec préavis, et
  arrêt immédiat en cas de manquement à la charte par un collaborateur.

---

## 4. Ce qui est construit (et comment l'allumer)

Écrit le 17 août 2026. Migration `20260817_partner_network.sql` **à appliquer**.

| Brique | Où |
|---|---|
| Tables partners / partner_reps / referral_attributions / commission_events | `migrations/20260817_partner_network.sql` |
| Codes, barème, attribution, commissions | `lib/partners.ts` (+ 16 tests) |
| Attribution posée dès l'inscription | `app/api/referral/claim` + `components/dashboard/SignupAttribution.tsx` |
| Résolution des codes au paiement | `app/api/stripe/checkout` |
| Écriture des commissions et des reprises | `app/api/stripe/webhook` |
| Inscription self-service des collaborateurs | `/partner/join` + `app/api/partner/join` |
| Suivi d'un collaborateur, sans compte | `/partner/stats/[token]` |
| Relevé mensuel par réseau | onglet **Réseaux** de l'admin + `app/api/admin/partners` |

Une fois la migration appliquée, créer le réseau est **un seul INSERT**. Tout le
reste est self-service :

```sql
INSERT INTO partners (slug, name, kind, rep_prefix, join_code, flat_rate)
VALUES ('lml', 'Nom de la société', 'network', 'LML', 'CODEAENVOYER', NULL);
```

`join_code` est ce que le partenaire diffuse à son réseau, avec le lien
`https://tradediscipline.app/partner/join?code=CODEAENVOYER`. `flat_rate` à NULL
laisse courir le barème progressif ; le renseigner (0.30) fige un taux négocié.

Ce qui n'est PAS construit, volontairement : l'espace de gestion du partenaire
(il ne peut pas encore désactiver un collaborateur lui-même, c'est un UPDATE en
base), l'import CSV, et les alertes anti-fraude automatiques. Ces trois briques
se dimensionnent avec les chiffres du pilote, pas avant.

---

## 5. Ce qu'il restera à construire

Trois briques déjà en place limitent la fraude : aucune commission avant
encaissement réel, reprise automatique sur remboursement (ligne négative), et
auto-parrainage refusé à l'écriture de l'attribution. Restent, à dimensionner
avec les chiffres du pilote :

- **Espace de gestion du partenaire** : désactiver un collaborateur, consulter
  son réseau sans passer par nous. Aujourd'hui c'est un UPDATE en base.
- **Import CSV** de collaborateurs, si la société veut en pré-créer une liste
  déjà identifiée plutôt que de laisser chacun s'inscrire.
- **Détection des rafales** : un code qui enregistre 50 inscriptions dans la
  journée doit lever une alerte, pas être payé en silence.
- **Support de niveau 1 assuré par la société**, appuyé sur une page d'aide
  dédiée. Les collaborateurs ne doivent pas écrire à
  contact@tradediscipline.app : à quelques milliers, c'est le poste qui coûte le
  plus cher.
- **Relevé figé et exportable** au 5 du mois, envoyé à la société. Aujourd'hui
  l'écran calcule à la volée.

---

## 6. Recommandation de déploiement

Ne pas ouvrir à des milliers de collaborateurs le premier jour. Un pilote sur 20
à 30 collaborateurs pendant 6 à 8 semaines. Ce qui est livré aujourd'hui suffit
exactement à ça, et répondra aux vraies questions : combien d'abonnés par
collaborateur, quel taux de remboursement, quel volume de support, quelle
consommation IA réelle des comptes apportés. Les briques restantes de la section
5 ne se dimensionnent correctement qu'avec ces chiffres.

---

## 7. À trancher par Axel avant de commencer

1. Taux confirmé au barème existant plafonné à 30 %, ou taux négocié à part.
2. Mention « toutes taxes comprises » acceptée par la société.
3. Calendrier du passage en société.
4. Qui signe côté partenaire (SIREN, représentant légal), et relecture du
   contrat par l'avocat déjà prévu pour le contrat influenceur.
5. Feu vert sur le pilote avant tout développement de la phase 2.
