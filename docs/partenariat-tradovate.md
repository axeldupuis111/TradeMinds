# Dossier de partenariat Tradovate / NinjaTrader Ecosystem

Objectif : obtenir des identifiants OAuth partenaires pour Tradovate, afin que
nos utilisateurs connectent leur compte en saisissant seulement leur login dans
une fenêtre Tradovate, au lieu d'aller acheter et générer eux-mêmes une clé API.

C'est le modèle que TradeZella utilise déjà. Tant que nous n'avons pas ce statut,
notre parcours Tradovate reste inaccessible à la majorité des traders de prop
firm, quelle que soit la qualité du guide.

---

## 1. Ce qu'il faut savoir avant d'envoyer

Ce qui est établi (sources en fin de document) :

- Les identifiants OAuth ne sont délivrés qu'aux partenaires approuvés de
  l'écosystème NinjaTrader, après une candidature et une revue formelle.
- Le processus de candidature n'est pas public : il n'existe pas de formulaire
  en ligne. Tout part d'une prise de contact, puis NinjaTrader indique les
  étapes.
- Sans ce statut, chaque utilisateur doit avoir : un compte réel approvisionné à
  1 000 $ minimum, plus l'add-on API à environ 25 $ par mois. C'est exactement le
  mur que rencontre la communauté de GD Invest.
- Une licence vendeur de niveau entreprise est évoquée par des développeurs
  tiers comme possiblement nécessaire pour authentifier des utilisateurs autres
  que soi-même. À faire confirmer par NinjaTrader : c'est la question qui
  détermine le coût réel du partenariat, donc à poser dès le premier échange.

Point d'attention : les données de marché temps réel relèvent d'un accord séparé
avec le CME et coûtent cher. **Nous n'en avons pas besoin.** Notre usage est en
lecture seule et post-trade : historique des exécutions et solde du compte. Il
faut le dire explicitement dès le premier message, sinon la demande risque d'être
orientée vers une offre market data hors de proportion avec notre besoin.

### Où envoyer

| Voie | Adresse | Usage |
|---|---|---|
| Ecosystem (voie principale) | info@ninjatraderecosystem.com | Candidature vendeur / partenaire |
| Partner API (voie technique) | https://partner.ninjatrader.com/ (bouton « Get Started » / « Talk to Sales ») | Accès Partner API et OAuth |
| Support Tradovate | https://support.ninjatrader.com | Repli si les deux premières restent sans réponse |

Recommandation : envoyer le message ci-dessous à l'adresse Ecosystem, et déposer
la même demande via « Talk to Sales » sur le portail partenaire le même jour. Les
deux voies existent, aucune n'est documentée comme prioritaire, et une relance
sous 10 jours ouvrés est normale.

**Envoyer depuis contact@tradediscipline.app**, pas depuis une adresse Gmail.
Une candidature partenaire qui arrive d'une adresse au nom du domaine se lit
comme une entreprise ; la même depuis un webmail personnel se lit comme un
projet individuel, et c'est exactement le doute qu'on cherche à éviter vu notre
taille. L'adresse du domaine confirme au passage que nous le contrôlons, ce
qu'ils vérifieront de toute façon avant de délivrer des identifiants OAuth.

---

## 2. Le point qui fâche : notre taille

Chiffres réels au 5 août 2026, comptés en base :

| | |
|---|---|
| Comptes inscrits | 28 |
| Dont abonnés payants | 12 (9 premium, 3 plus) |
| Utilisateurs avec au moins un trade importé | 6 |
| Utilisateurs suivant un challenge prop firm | 8 |
| Connexions Tradovate jamais créées | 0 |

Il faut le regarder en face : 28 comptes, c'est petit pour une candidature
partenaire, et ils vont le voir. Deux options, et c'est ta décision :

1. **Envoyer maintenant** en assumant la taille et en misant sur le reste :
   12 abonnés payants (donc un produit qui se vend, pas un projet du week-end),
   cinq rails brokers déjà construits, un périmètre en lecture seule sans données
   de marché, et une demande qui **réduit** le nombre d'endroits où des mots de
   passe Tradovate sont stockés. Le processus de revue prend du temps de toute
   façon : déposer tôt fait gagner ce délai.
2. **Attendre** d'avoir des utilisateurs futures réels à montrer. Mais on tourne
   en rond : ils n'arriveront pas tant que le parcours Tradovate reste
   inaccessible, et le partenariat de GD Invest est justement ce qui pourrait
   les amener.

Ma recommandation : envoyer maintenant, sans gonfler les chiffres. Une
candidature honnête et techniquement précise à 28 utilisateurs vaut mieux qu'une
candidature gonflée qui s'effondre au premier appel. Le dossier ci-dessous ne
met donc pas les effectifs en avant, mais ne les cache pas non plus si on
demande.

Deux choses valent la peine d'être signalées au passage, indépendamment de la
candidature :

- **Aucun utilisateur n'a jamais créé de connexion Tradovate.** Le rail est
  construit, il n'a jamais servi. Cela confirme le diagnostic de GD Invest, et
  cela veut aussi dire que la migration de commission et mes correctifs ne
  peuvent rien casser pour personne.
- **Seuls trois rails ont réellement produit des trades** : saisie manuelle,
  MT5 et MT4. cTrader, NinjaTrader, TradingView et Tradovate sont à zéro. Le
  temps investi en futures n'a encore rien rapporté, ce qui est un argument de
  plus pour ne pas construire davantage sur ce rail avant d'avoir la réponse à
  la question 3 ci-dessous.

---

## 3. Message de premier contact (à envoyer tel quel, en anglais)

> **Subject:** Partner OAuth access request for Tradovate integration (TradeDiscipline, EU)
>
> Hello,
>
> I am the founder of TradeDiscipline (https://www.tradediscipline.app), a trading
> journal and discipline analytics platform based in France, operated by Axel
> Dupuis, a registered French sole trader (entreprise individuelle), SIRET
> 938 244 373 00024.
>
> We already import trade history from MetaTrader 4 and 5, cTrader, NinjaTrader 8
> and TradingView, and we have a working Tradovate integration built on the
> standard REST API. It is live today, but it requires each individual user to
> purchase the API Access add-on and generate their own cid/sec key pair. In
> practice most of our futures users trade prop firm accounts where that add-on
> is not available to them, so the integration is out of reach for them.
>
> I would like to apply for partner OAuth credentials so that our users can
> authorize TradeDiscipline through Tradovate's own login screen instead.
>
> To be explicit about scope: **we do not need real-time market data.** Our use is
> read-only and post-trade. We read filled orders and cash balance in order to
> build the user's trading journal. We never place, modify or cancel orders, and
> we do not need streaming quotes, so no CME market data licence should be
> involved on our side.
>
> Could you tell me:
>
> 1. What the application process is for partner OAuth credentials, and what
>    documentation you need from us.
> 2. Whether an enterprise vendor licence is required for an application that
>    authenticates its own end users, and what it costs.
> 3. Whether our end users still need the individual API Access add-on once we
>    authenticate them through partner OAuth. This is the decisive point for us.
>
> A short technical summary is attached / included below. I am happy to walk
> through the integration on a call.
>
> Best regards,
> Axel Dupuis
> Founder, TradeDiscipline
> contact@tradediscipline.app

---

## 4. Fiche technique (à joindre ou à coller sous le message)

### Company

| | |
|---|---|
| Product | TradeDiscipline |
| Website | https://www.tradediscipline.app |
| Legal entity | Axel Dupuis, French sole trader (entreprise individuelle) |
| SIRET / SIREN | 938 244 373 00024 / 938 244 373 |
| Registered address | 87 rue Georges Clémenceau, 62143 Angres, France |
| Founded | 2026 |
| Contact | contact@tradediscipline.app |
| Hosting | Vercel (EU region, Paris) and Supabase (EU data, Frankfurt) |

### What the product does

TradeDiscipline is a trading journal built around trading discipline rather than
performance alone. It imports a trader's executions, then measures behaviour:
respect of the trading plan, emotional patterns, rule breaks, drawdown
discipline, and progress against self-set goals. It includes an AI review of
individual trades, a monthly report, and a leaderboard based on discipline
metrics.

It is available in French, English, Spanish and German. Payments run through
Stripe (live since June 2026).

### Requested scope

| | |
|---|---|
| Access type | Read-only, post-trade |
| Endpoints needed | `/fill/list`, `/contract/item`, `/product/item`, `/account/list`, `/cashBalance/getcashbalancesnapshot`, `/position/list` |
| Order placement | None. We never place, modify or cancel orders. |
| Real-time market data | Not required. No streaming quotes, no CME licence needed. |
| Frequency | One pull per connected account per hour |
| Environments | Live and demo |

### Current integration status

The integration is already built and running against the standard REST API:

- Authentication via `/auth/accessTokenRequest`, one token per sync pass, with
  explicit handling of the `p-ticket` penalty response.
- Fills are aggregated into complete round-turn positions using average-cost
  netting, with each contract's `valuePerPoint` resolved through
  `/contract/item` and `/product/item`.
- Cash balance and open positions feed the user's account view.
- Hourly server-side sync, per-connection health status, and re-entrant upsert
  logic so a re-sync never duplicates or overwrites a trade.

Moving to partner OAuth changes only the authentication step. Everything
downstream stays as it is.

### Security handling

- Credentials are encrypted at the application layer with AES-256-GCM before
  storage. The database never sees plaintext, and secrets are never returned to
  the browser once saved.
- Row-level security scopes every connection to its owner.
- Users can pause or delete a connection at any time; deleting it stops all
  access immediately.
- Hosted in the EU (Vercel, region cdg1). GDPR applies, with published privacy
  terms in four languages.

With partner OAuth we would stop storing broker passwords entirely, which is a
security improvement for us and for Tradovate's users. That argument is worth
making explicitly: it is in their interest too.

### Stage and scale

We are early stage and will not pretend otherwise: TradeDiscipline launched
commercially in June 2026 and currently has 28 registered accounts, 12 of them
paying subscribers. 8 of those users track a prop firm evaluation challenge,
which is precisely the population blocked by the current Tradovate requirements.

We would rather apply with accurate numbers than inflated ones. What we bring is
not volume today, it is a finished, security-conscious integration and five
broker rails already in production (MetaTrader 4 and 5, cTrader, NinjaTrader 8,
TradingView, Tradovate). We are also being approached by trading education
partners in France whose communities trade prop firm futures accounts, and the
Tradovate onboarding friction is the specific blocker they raise.

---

## 5. Suivi

| Étape | État |
|---|---|
| Envoi à info@ninjatraderecosystem.com | FAIT le 2026-08-05 |
| Message posté sur community.tradovate.com (Intégration OAuth tierce) | FAIT le 2026-08-05 |
| **Réponse reçue le 2026-08-06** | voir ci-dessous |
| Profil éditeur Impact + preuve de propriété du domaine | FAIT le 2026-08-14 (candidature NinjaTrader US en cours d'examen) |
| Inscription au programme d'affiliation (20 $ par nouvel inscrit NinjaTrader) | FAIT le 2026-08-14 |
| API License Agreement (4 p., version 30/09/2024) | **SIGNÉ le 2026-08-14** |
| Ecosystem Vendor Listing Agreement (10 p.) | **SIGNÉ le 2026-08-15** via DocuSign |
| **Question 3 (add-on individuel encore requis ou non)** | TOUJOURS SANS RÉPONSE, et absente des deux contrats |
| Avenant art. 15 actant l'exemption de frais pour les utilisateurs finaux | À OBTENIR avant de signer le contrat fournisseur |
| Message à Michaelanne (question a/b + demande d'avenant) | ENVOYÉ le 2026-08-14 |
| **Réponse du 2026-08-14 16h46** | **hors sujet : répond sur la clé API, pas sur l'add-on** |
| ~~Relance séparant clé / add-on / compte minimum~~ | abandonnée : sa réponse est probablement un OUI |
| ~~Avenant art. 15 comme préalable~~ | **déclassé** : devient une phrase du mail, ne bloque plus rien |
| **Identifiants OAuth partenaires + doc du flux** | LE SEUL BLOCAGE RESTANT. DocuSign ne les apporte pas : mail à envoyer |
| Plomberie OAuth côté TradeDiscipline | **FAITE le 2026-08-15** (`60a1924`), n'attend que les deux secrets |
| Repli si pas de réponse sous 48 h | relancer PAR ÉCRIT ; ne pas passer par le Calendly (voir note ci-dessous) |

### Réponse de NinjaTrader (2026-08-06)

Michaelanne Chapel, Business Development Manager North America
(michaelanne.chapel@ninjatrader.com). Contenu :

- La même API dessert NinjaTrader et Tradovate : **un seul chemin d'intégration**,
  rien à adapter par plateforme.
- L'accès est réservé aux membres du **NinjaTrader Vendor Program**.
- **Le programme est gratuit.**
- **Pour un membre, ils lèvent les frais d'API et les conditions financières.**
  C'est-à-dire les 25 $ par mois et le compte réel approvisionné à 1 000 $.
- C'est un programme de **co-marketing** : ils demandent un site public, et
  d'être listés comme **Connection ou Integration, pas comme Brokerage**.
- **Aucun support technique dédié** : on travaille seuls à partir de la
  documentation publique.

Autrement dit le mur décrit en section 2 tombe, et le coût est nul. Le seul
point à reconfirmer noir sur blanc : la levée des frais vaut-elle aussi pour
**nos utilisateurs finaux**, ou seulement pour notre accès à nous ? C'est la
question posée en retour.

À noter : être listé dans l'annuaire NinjaTrader est une vraie distribution
pour un produit à 28 comptes. Le co-marketing est un bénéfice, pas une
contrainte.

Une seule chose reste à ta main avant l'envoi : vérifier que tu veux bien
publier l'adresse d'Angres dans ce dossier. Elle figure déjà dans les mentions
légales du site, donc elle est publique, mais si la domiciliation aboutit d'ici
là, autant y mettre la nouvelle.

### Deuxième réponse (2026-08-14)

Après une erreur administrative de leur côté, le dossier est traité. Michaelanne
envoie les **contrats fournisseur et API à signer**, propose son aide pour
obtenir l'accès API puis un relais vers son équipe d'intégration, et signale un
programme d'affiliation distinct (20 $ par nouvel inscrit NinjaTrader via lien
de suivi, plateforme Impact).

Avantages fournisseur confirmés : référencement gratuit sur ninjatraderecosystem.com,
version Entreprise de NinjaTrader offerte (1 499 $) avec flux Kinetick, outils de
licence, webinaires, support en 7 langues, et **examen de conformité gratuit des
supports marketing** (utile vu les règles NFA/CFTC sur la promotion de futures).

La question 3 reste sans réponse écrite : à poser dans le message qui accompagne
le retour des contrats, avant signature.

### Relecture des deux contrats (2026-08-14)

**Constat central : ni l'un ni l'autre ne mentionne les frais d'API, l'add-on à
25 $ ou le compte à 1 000 $.** Les deux sont muets. L'exemption annoncée par
Michaelanne n'existe que dans un mail, que les clauses « Entire Agreement »
(art. 18 des deux contrats) rendent sans effet une fois la signature apposée.
D'où l'avenant à demander.

**API License Agreement** (signé le 2026-08-14) :

- Art. 1 : la licence est accordée *solely* pour connecter un logiciel de
  passage d'ordres. Notre usage lecture seule post-trade n'y figure pas, et
  l'art. 2 (i) interdit littéralement d'accéder au compte d'un client « for any
  purpose ». À faire couvrir par écrit : notre périmètre réel.
- Art. 3 : tout « NinjaTrader Content » mis en cache doit être supprimé ou
  rafraîchi sous 24 h. Incompatible avec un journal si l'historique d'exécutions
  n'est pas qualifié de Customer Data (art. 5). À faire trancher par écrit.
- Art. 4 : interdiction d'utiliser l'API avec du copyleft (GPL/LGPL/AGPL).
  Vérifié le 2026-08-14 sur les 600 paquets de node_modules : aucune dépendance
  GPL/LGPL/AGPL, seulement du MPL-2.0 (axe-core, dompurify, lightningcss,
  web-push), hors définition du contrat. **Ajouter une dépendance AGPL
  résilierait la licence automatiquement.**
- Art. 12 : indemnisation non plafonnée, frais d'avocat inclus, avec renonciation
  à se défendre soi-même. Survit à la résiliation.
- Préambule : modification unilatérale du contrat par simple mise à jour de la
  doc en ligne. Art. 9 et 10 : aucun support garanti, résiliation immédiate.
  **Le rail peut être coupé sans préavis : ne rien construire de plus dessus.**
- Art. 15 : droit de l'Illinois, tribunaux de Cook County (Chicago).
- Art. 17 : aucun droit d'utiliser le nom ni les logos NinjaTrader sans accord
  exprès préalable. À obtenir, sinon nos guides et écrans de connexion sont
  formellement en infraction.

**Ecosystem Vendor Listing Agreement** (non signé) :

- Ce n'est **pas** un contrat d'accès API : c'est un référencement dans
  l'annuaire (art. 1.2 et 1.3), résiliable par eux à tout moment sans préavis
  ni motif (art. 2.3).
- Art. 8 : les avantages annoncés y sont bien écrits (Media Kit, licence
  Enterprise multi-brokers, gestion de licences, données Kinetick). Ce point
  était la première inquiétude, il est levé.
- Art. 6.1.7 : indemnisation étendue à « votre activité en général », amendes
  de régulateurs et honoraires d'experts inclus, même sans procédure engagée.
  Clause la plus large des deux documents.
- Art. 4.1 et 4.2 : obligation de toujours présenter NinjaTrader positivement
  en public et de ne leur adresser toute critique qu'en privé. **Contrainte
  directe sur la ligne éditoriale du blog et sur les comparatifs de
  plateformes.**
- Art. 15 : tout avenant doit être écrit, signé des deux parties et annexé.
  C'est le mécanisme à utiliser pour l'exemption de frais.

### Troisième réponse (2026-08-14, 16h46) : elle ne répond pas à la question

Réponse intégrale de Michaelanne :

> During development, you can build in an OAuth connection, which allows your
> end user to log in with their credentials without needing to secure their own
> API key.

**Ce n'est ni (a) ni (b).** La question portait sur l'add-on payant et le compte
approvisionné ; la réponse porte sur la clé API. Ce sont trois objets distincts,
et les confondre est exactement ce qui nous ferait signer à l'aveugle :

| Objet | Nature | Statut après sa réponse |
|---|---|---|
| Clé API | identifiant technique | **réglé** : l'utilisateur n'a pas à en générer une |
| Add-on API Access (~25 $/mois) | droit payant sur le compte | **sans réponse** |
| Compte approvisionné ≥ 1 000 $ | condition d'éligibilité | **sans réponse** |

Ne pas avoir à générer une clé ne dit rien sur le fait de devoir détenir le droit
qui va avec. Dans un modèle OAuth partenaire, il est courant que le vendeur porte
les identifiants client pendant que l'utilisateur doit malgré tout détenir
l'entitlement sur son propre compte. C'est précisément le cas qui nous tuerait.

Deux réserves supplémentaires sur cette phrase :

1. **« During development »** borne l'affirmation à la phase de développement.
   C'est la seule phase qui ne nous intéresse pas.
2. Elle laisse sans réponse **l'avenant art. 15** et la **confirmation du
   périmètre lecture seule**, tous deux demandés explicitement.

**Décision : ne pas signer l'Ecosystem Vendor Listing Agreement.** C'est le seul
levier restant, l'API License Agreement étant déjà signé.

### Ce qu'il faut obtenir par écrit, dans l'ordre

1. **Add-on et compte minimum** : réponse binaire, en production, pas en
   développement. C'est la seule question qui décide de la suite.
2. **Avenant art. 15** actant l'exemption, signé des deux parties et annexé.
   Sans lui, la clause « Entire Agreement » (art. 18) efface tout ce qui a été
   dit par mail.
3. **Périmètre lecture seule**, à traiter SÉPARÉMENT et après. L'API License
   Agreement déjà signé accorde la licence *solely* pour le passage d'ordres
   (art. 1) et interdit d'accéder au compte d'un client « for any purpose »
   (art. 2 (i)). Notre usage réel n'y est couvert par rien. C'est une exposition
   ouverte, mais la mettre dans le même message diluerait la question 1 : elle a
   déjà répondu à un fragment d'un message qui en contenait trois.

### Pourquoi un message plus COURT que le précédent

Le mail du 2026-08-14 posait trois demandes et exposait le contexte. Elle a
répondu à la plus facile. Un message qui contient une seule question fermée, avec
les trois objets explicitement séparés, ne peut pas recevoir une réponse
partielle sans que le trou soit visible.

### Brouillon à envoyer (non envoyé, à relire par Axel)

> Hello Michaelanne,
>
> Thank you. I think we may be answering two different questions, so let me
> separate them.
>
> You confirmed the end user will not need to secure their own API key. That
> settles the credential.
>
> What I still need is the entitlement behind it. On a Tradovate or NinjaTrader
> account today, API access is a paid add-on of about $25 per month and it
> requires a funded account of $1,000 or more. Three separate things:
>
> 1. API key: confirmed, the user does not need one.
> 2. API Access add-on, about $25 per month: does the end user still have to
>    purchase it? Yes or no.
> 3. Funded account of $1,000 or more: does the end user still have to meet it?
>    Yes or no.
>
> You also wrote "during development". Does the same apply in production, with
> real end users connecting through our vendor OAuth?
>
> This decides whether we ship the integration at all. Most of our futures users
> trade prop firm evaluation accounts, where the add-on cannot be purchased even
> if they wanted to.
>
> If 2 and 3 are waived for users connecting through our vendor credential, I
> will sign and return the Listing Agreement the same day, with a one paragraph
> addendum under section 15 recording the waiver. Neither agreement mentions
> fees or end user requirements, and section 18 would otherwise override
> anything agreed by email.
>
> Fifteen minutes on your Calendly works too if that is faster.
>
> Best regards,
> Axel

### Correction de ma lecture (2026-08-15)

Axel objecte, et il a raison sur un point que j'avais sous-estimé : **sur
Tradovate, la clé API est précisément ce que délivre l'add-on à 25 $/mois.** Elle
n'est pas obtenable autrement. Donc « l'utilisateur final n'a pas besoin de
sécuriser sa propre clé API » pointe bien vers « il n'a pas à acheter l'add-on
qui la délivre ». Sa lecture est probablement la bonne.

Deux choses restent vraies malgré ça :

1. **Le compte approvisionné à 1 000 $ n'est pas lié à la clé.** C'est une
   condition d'éligibilité au niveau du compte, distincte de l'entitlement API.
   Sa phrase n'en dit rien, et c'est le second mur pour les traders de prop firm.
2. **L'art. 18 (« Entire Agreement ») efface les mails.** Une fois le Listing
   Agreement signé, cette phrase n'a plus aucune valeur opposable.

### Changement de méthode : ne plus redemander, faire écrire

Ma première recommandation était de reposer la question en séparant les trois
objets. C'est moins bon que ceci : **prendre sa réponse pour argent comptant et
lui demander de l'inscrire dans l'avenant.**

Pourquoi c'est plus fort :

- Si elle pense déjà ce qu'Axel comprend, l'écrire ne lui coûte rien : elle
  signe sans discuter, et la question est réglée de façon opposable.
- Si elle refuse de l'écrire, **c'est la réponse**, obtenue sans débat et sans
  coût.
- Ça sort du registre « répondez à ma question » (où elle a déjà répondu à côté
  une fois) pour entrer dans « acter ce que vous venez de me dire », beaucoup
  plus facile à accepter.
- Le compte à 1 000 $ se règle au passage, sans en faire un sujet séparé : il
  est simplement dans le texte proposé.

**On n'a pas besoin de gagner le débat d'interprétation. On a besoin de la
phrase dans le contrat.**

### Avenant proposé (à joindre au Listing Agreement)

> **Addendum 1 to the Ecosystem Vendor Listing Agreement**
> between NinjaTrader, LLC and [entité], dated [date].
>
> End users who connect their Tradovate or NinjaTrader account to
> TradeDiscipline through Vendor's partner OAuth credential are not required to
> purchase the individual API Access add-on, and are not subject to the minimum
> funded account balance otherwise applicable to individual API access. This
> applies in production for the term of the Agreement.

Un paragraphe, les deux conditions couvertes, et « in production » qui neutralise
le « during development » de son mail.

### Message d'accompagnement (non envoyé, à relire par Axel)

> Hello Michaelanne,
>
> That is exactly what I hoped, thank you.
>
> Since neither agreement mentions API fees or end user requirements, and
> section 18 makes the signed text override anything agreed by email, let us put
> your sentence where it will still be true in a year. Section 15 contemplates
> exactly this, and one paragraph is enough:
>
> "End users who connect their Tradovate or NinjaTrader account to
> TradeDiscipline through Vendor's partner OAuth credential are not required to
> purchase the individual API Access add-on, and are not subject to the minimum
> funded account balance otherwise applicable to individual API access. This
> applies in production for the term of the Agreement."
>
> I added the funded account balance because it is a separate account level
> requirement from the API key, and it is the other reason our prop firm users
> cannot use the individual route today.
>
> Send it back signed alongside the Listing Agreement and I will return both the
> same day. Happy to take fifteen minutes on your Calendly if that is quicker.
>
> Best regards,
> Axel

### Si elle refuse ou temporise sur l'avenant

Un refus d'écrire ce qu'elle vient d'affirmer est une information, pas un
incident : cela veut dire que l'exemption n'est pas dans son pouvoir, ou qu'elle
ne couvre pas le compte minimum. Dans ce cas, ne pas signer le Listing Agreement
et appliquer la conclusion écrite plus haut (pousser NinjaTrader et l'import
CSV).

### Décision d'Axel (2026-08-15) : signer les deux, viser la vitesse

Élément nouveau et décisif : **un partenaire ne signera que si la connexion
Tradovate et NinjaTrader fonctionne.** Attendre a donc un coût réel, ce que
j'avais nié. Décision : signer les deux contrats sans attendre l'avenant.

**L'avenant n'est pas abandonné, il est déclassé** : il passe de condition
préalable à une phrase dans le mail, qui ne bloque rien. Si l'exemption est
fausse, on veut l'apprendre maintenant, pas après le travail d'intégration.

### Ce qui bloque réellement n'est pas contractuel

État du code au 2026-08-15 : `lib/sync/tradovate.ts` s'authentifie via
`auth/accessTokenRequest` avec **username + password + cid + sec**. C'est le
chemin par CLÉ API INDIVIDUELLE, donc précisément celui qui exige l'add-on à
25 $ et le compte à 1 000 $. C'est le mur que l'OAuth partenaire doit faire
tomber : **l'OAuth n'est pas un confort d'ergonomie, c'est tout l'intérêt du
partenariat.**

Ce qui manque pour construire, et rien d'autre :

1. Les **identifiants OAuth partenaires** (client id et secret), sandbox d'abord.
2. La **documentation du flux** : endpoint d'autorisation, échange de jeton,
   scopes, rafraîchissement.

Sa phrase « During development, you can build in an OAuth connection » se lit
comme une autorisation à construire dès maintenant. Le mail doit donc demander
ces deux choses, pas rouvrir un débat.

### Message à envoyer (non envoyé)

⚠️ **Correction du 2026-08-15 : les contrats sont signés VIA DOCUSIGN**, qui les
renvoie automatiquement. Rien à joindre, rien à transmettre. Le mail ci-dessous
ne sert donc plus à livrer les documents mais à demander la seule chose que
DocuSign n'apporte pas : **les identifiants OAuth et la doc du flux**. Sans lui,
le dossier peut dormir côté NinjaTrader alors que tout est signé de notre côté.

Il y ajoute l'**URL de callback à déclarer chez eux**, qui leur serait demandée
de toute façon : la donner d'emblée économise un aller-retour.

> Hello Michaelanne,
>
> Both agreements are signed and returned through DocuSign: the API License
> Agreement and the Ecosystem Vendor Listing Agreement.
>
> To start building the OAuth connection you described, I need two things:
>
> 1. The partner OAuth client id and secret, sandbox first if you prefer to
>    start there.
> 2. The developer documentation for the flow, so I match your expectations on
>    scopes and token refresh.
>
> Our callback URL, to whitelist on your side:
> https://tradediscipline.app/api/broker/tradovate/oauth/callback
>
> Email works best for this: credentials and technical documentation are easier
> to hand over in writing, and it gives us both a clear record to refer back to.
>
> Our integration already reads the Tradovate REST API in read only mode, so
> once users authenticate through your OAuth window instead of individual API
> keys, we are close to done.
>
> One line for the record, and nothing needs to wait for it: I understood from
> your message that end users connecting through our vendor OAuth will not need
> to purchase the individual API Access add-on, nor meet the minimum funded
> account balance. If that is not the case in production, please tell me now,
> because most of our futures users trade prop firm evaluation accounts where
> that add-on cannot be purchased.
>
> Best regards,
> Axel

⚠️ **NE PAS PROPOSER LE CALENDLY.** Axel ne parle pas anglais à l'oral. Ce n'est
pas un handicap dans ce dossier : ce qu'on demande (un `client_secret`, une
documentation d'API) **ne peut pas être transmis en visio de toute façon**.
L'écrit est la bonne forme, et le mail le dit avec une raison professionnelle
qui n'évoque jamais la langue : « credentials and technical documentation are
easier to hand over in writing, and it gives us both a clear record ».

Si l'interlocuteur insiste sur un appel, une phrase suffit :
« Thank you, I would rather keep this in writing so I can implement directly
from your documentation. If anything is unclear I will follow up by email. »
Un développeur qui veut la spec par écrit est la norme, personne ne s'en étonne.

Ses mails en anglais sont bien écrits : le dossier se traite intégralement à
l'écrit, du premier contact à la livraison des identifiants.

Pourquoi cette forme : les contrats partent signés, donc plus rien n'est retenu.
La demande porte sur les deux seules choses qui débloquent l'ingénierie. Et la
question des frais est là, datée, écrite, sans conditionner quoi que ce soit :
si la réponse est mauvaise, on l'apprend avant d'avoir construit.

### Ce qui reste exposé, assumé en connaissance de cause

- **Art. 18** : l'exemption reste dans un mail, pas dans le contrat. Si elle se
  révèle fausse, aucun recours écrit.
- **API License Agreement art. 1 et 2 (i)** : licence accordée *solely* pour le
  passage d'ordres, et interdiction d'accéder au compte d'un client « for any
  purpose ». Notre usage lecture seule n'y est couvert par rien. À faire
  confirmer par écrit quand la relation sera établie, sans bloquer maintenant.
- **Art. 3** : purge du cache sous 24 h, incompatible avec un journal si
  l'historique d'exécutions n'est pas qualifié de Customer Data (art. 5).
- **Art. 4** : aucune dépendance GPL/LGPL/AGPL. Vérifié le 2026-08-14, à
  revérifier avant chaque ajout de dépendance : une AGPL résilie la licence
  automatiquement.
- **Art. 4.1 et 4.2 du Listing** : obligation de présenter NinjaTrader
  positivement en public. Vérifié le 2026-08-15 : le blog ne les compare
  défavorablement nulle part, ils n'y figurent que comme plateforme supportée.
  Contrainte théorique aujourd'hui, à garder en tête avant tout comparatif.

### Si la réponse est « oui, l'add-on reste dû »

Alors le partenariat ne règle pas le problème de GD Invest, et la conclusion
écrite plus haut s'applique : arrêter d'investir sur le rail Tradovate, pousser
NinjaTrader et l'import CSV. Dans ce cas, ne pas signer le Listing Agreement du
tout : il n'apporterait qu'un référencement, en échange d'une indemnisation
étendue à « votre activité en général » (art. 6.1.7) et d'une obligation de
présenter NinjaTrader positivement en public (art. 4.1 et 4.2), qui contraindrait
la ligne éditoriale du blog et les comparatifs de plateformes.

La question 3 est celle qui décide de tout. Si les utilisateurs finaux doivent
malgré tout payer l'add-on à 25 $ par mois même via OAuth partenaire, alors le
partenariat ne règle pas le problème de GD Invest et il faut arrêter d'investir
sur ce rail pour pousser NinjaTrader et l'import CSV à la place.

---

## 6. Réponse du 2026-08-17 : la question des frais est tranchée

Deux mails le même jour, à 07h49 et 07h51 heure Pacifique.

### Ce qui est acquis

La question posée trois fois (6, 14 et 15 août) a bien sa réponse, mais elle est
répartie sur deux mails antérieurs, ce qui explique qu'on ait pu la croire sans
réponse :

- **5 août** : « As a member of the Vendor Program, we can waive the API fee and
  financial requirements to gain access. » Cela couvre les deux volets : l'add-on
  à 25 $ par mois **et** le compte approvisionné à 1 000 $.
- **14 août** : « your end user to log in with their credentials *without*
  needing to secure their own API key. »
- **15 août** : le mail d'Axel énonce la conséquence en clair (« end users will
  not need the individual API Access add-on, nor meet the minimum funded account
  balance. If that is not the case in production, please tell me now »). La
  réponse du 17 ne la contredit pas.

C'est donc la réponse (b). Le mur qui bloquait la communauté GD Invest tombe.

### Ce qui n'est toujours pas livré

- Pas de `client_id` / `client_secret`, même en bac à sable.
- Pas de documentation du flux (scopes, rafraîchissement des jetons).
- Aucune réaction à l'avenant proposé le 15 août. Ni refus, ni acceptation.

À la place, elle demande **un username Tradovate à activer pour l'accès API**.
Un compte NinjaTrader ne convient pas. À défaut, un essai suffit
(https://www.tradovate.com/trial/), sans ouverture de compte ni dossier, mais
l'adresse email liée doit être une vraie adresse, pas un alias de masquage.

Le compte existait déjà : **username `TradeDisciplineApp`**, rattaché à
`contact@tradediscipline.app`, l'adresse utilisée dans tout le fil. Rien à créer.

Note pour retrouver l'entrée d'inscription si besoin un jour : le titre
« Inscrivez-vous dès maintenant pour votre essai gratuit » de la page /trial est
du texte mort, sans lien. La seule porte est le bouton « Ouvrir un compte », qui
pointe vers https://trader.tradovate.com/register et n'est, malgré son libellé,
qu'un formulaire email sans dossier ni dépôt.

### Deux réserves à garder à l'esprit

1. **La formulation.** « The Tradovate username you would like enabled for API
   access » est le vocabulaire du modèle par utilisateur, pas celui d'un client
   OAuth partenaire. C'est probablement le compte développeur, mais tant que les
   identifiants ne sont pas là, on ne peut pas l'affirmer.
2. **Les comptes de prop firm.** La levée des frais ne dit rien du point
   technique : un compte d'évaluation vit sous l'entité Tradovate de la prop
   firm, pas sous celle du trader. Que notre credential vendeur puisse lire ces
   sous-comptes se vérifiera au premier test réel, pas par mail. C'est la
   dernière inconnue qui peut encore faire échouer le rail.

L'exemption reste dans des mails et non dans les contrats signés, qui portent une
clause d'intégralité (voir « Ce qui reste exposé »). Ce n'est pas bloquant :
conserver le fil archivé, et glisser l'avenant dans un prochain échange sans en
faire un préalable.

## 7. Mise en conformité du site (exigée par le Vendor Program)

Le second mail du 17 août livre le media kit et demande **une date cible de fin**
avant de débloquer la licence Enterprise, le compte Kinetick et le référencement
sur l'Ecosystem.

Référence : *NinjaTrader Vendor Professional and Compliance Guidelines*, rev
2.11.2025, https://ninjatraderecosystem.com/downloads/VendorGuidelines.pdf

### Ce qui a été fait le 2026-08-17

- `lib/legal/disclosures.ts` : les textes de l'annexe A, anglais **mot pour mot**
  (coquilles d'origine comprises, c'est volontaire : c'est ce texte que la revue
  de conformité compare), plus des traductions fr / de / es.
- `components/legal/RiskDisclosure.tsx` : le bloc rendu, avec les options
  `hypothetical`, `testimonials` et `trademark`, plus un export `TrademarkNotice`
  pour la mention de marque seule.
- Montage sur toutes les pages : landing, pages légales, FAQ, contact,
  connexion, réinitialisation de mot de passe, blog (liste et article), page SEO
  journal de trading, profils publics, pages partenaires, et l'application
  connectée (dans le conteneur scrollable du tableau de bord, sinon le shell
  `h-screen` la pousserait hors écran).
- Mention de marque là où la plateforme est nommée : page SEO, articles de blog
  qui la citent (détection sur le contenu rendu), section synchro des réglages.
- `hypothetical` activé sur la landing (maquettes produit chiffrées) et sur le
  tableau de bord (projections, et trades fabriqués en mode démo).

Point de forme : les guidelines exigent un texte **visible**, dans un style
proche du contenu principal. Un lien peut s'ajouter au texte, jamais le
remplacer. D'où un vrai bloc rendu et non un renvoi vers les mentions légales.

### Les emails, couverts le 2026-08-17

L'annexe A vise « all emails sent and received ». Deux familles, deux endroits :

- **Emails produit** (rappel quotidien, rapport hebdo, réactivation,
  félicitations d'abonnement) : l'avertissement est posé dans le gabarit partagé
  `lib/email-template.ts`, dans la langue du destinataire. Il est au niveau du
  layout et non de chaque route, pour qu'un futur email ne puisse pas partir
  sans. Repli sur l'anglais si la langue est inconnue : mieux vaut la mauvaise
  langue que rien.
- **Emails d'authentification Supabase** : les cinq fichiers de
  `email-templates/` portent l'avertissement en français. Ils vivent dans le
  dashboard Supabase, donc **à recoller à la main**, voir `TODO_SUPABASE.md`.

Les alertes internes (`cron-alert`, `ai-credit-alert`) restent en texte brut et
hors périmètre : elles ne partent qu'à nous.

### Décision sur le lien d'affiliation : non, et pourquoi

Ils fournissent un lien tracké (`ninjatraderdomesticvendor.sjv.io`) et demandent
que les logos NinjaTrader et Kinetick pointent dessus. **Non posé, décision du
2026-08-17.**

La relecture du mail lève l'ambiguïté : la phrase est « *when adding logos to
your site*, please use the following links ». C'est une condition, pas une
obligation. Le bloc entier est d'ailleurs intitulé « Website Integration
*Suggestions* », au même titre que la section de menu « NinjaTrader » /
« Recommended » / « Trading Platform ». Seuls les avertissements sont exigés, et
ils sont en place. Ne pas afficher les logos est donc conforme.

Ce qui fait pencher la balance : poser un lien d'affiliation rémunéré vers un
courtier en futures, sur un site qui s'adresse à des particuliers européens,
sort du régime du logo partenaire pour entrer dans celui de la publicité pour un
produit financier. Le gain est de 20 $ par inscription, à comparer au risque
d'ouvrir un débat de qualification que rien n'oblige à ouvrir aujourd'hui.

Réversible en une heure si Axel décide l'inverse : le lien est dans le mail du
2026-08-17 et le media kit reste accessible.

### Les réseaux sociaux : sans objet

L'annexe A demande un lien vers l'avertissement dans la description de chaque
profil social (X, Facebook, LinkedIn, Instagram, TikTok, StockTwits, Pinterest,
Vimeo). Vérifié avec Axel le 2026-08-17 : **TradeDiscipline n'a aucun compte sur
ces plateformes.** L'exigence porte sur les profils existants, il n'y a donc
rien à faire.

À reprendre le jour où un compte est ouvert. Texte à mettre dans la bio :

> Le trading comporte un risque substantiel de perte en capital. Avertissement
> complet : tradediscipline.app/mentions-legales

Version anglaise, pour un compte anglophone :

> Trading involves substantial risk of loss. Full risk disclosure:
> tradediscipline.app/mentions-legales

Les deux tiennent dans les 160 caractères de X et les 150 d'Instagram. C'est le
seul endroit où les guidelines acceptent un lien à la place du texte.

### État de la mise en conformité au 2026-08-17 : complète

Plus rien en attente côté TradeDiscipline. Les templates Supabase ont été
recollés et le parcours « mot de passe oublié » rejoué en réel le même jour.
La suite dépend de NinjaTrader : identifiants OAuth, puis leur revue de
conformité.

### Deux points d'exposition repérés en lisant les guidelines

1. **Les profils publics affichaient un taux de rendement. Retiré le
   2026-08-17.** `PublicProfileView` publiait `pnlPct` et une courbe d'equity,
   et la carte Open Graph du profil portait la même tuile « P&L » : c'est ce que
   les réseaux sociaux affichent en aperçu quand un profil est partagé, donc la
   surface la plus publique du produit. Les guidelines l'interdisent : « Include
   any specific numerical or statistical information about the past performance
   of any actual accounts (including rate of return) », sauf à démontrer à la
   NFA que le chiffre représente tous les comptes comparables sur la période.

   Un second argument a emporté la décision, indépendant de NinjaTrader : le
   pourcentage était **faux**. Il divisait le P&L par un solde de départ fictif
   de 10 000, identique pour tout le monde, et n'a donc jamais été le rendement
   du compte de personne.

   Ce qui remplace : la tuile devient « Sessions reviewed » (comptée en base, et
   non sur la lecture bornée à 60), et la courbe d'equity devient la courbe du
   score de discipline. Même poids visuel, métrique que le produit revendique
   vraiment, et plus rien à défendre en revue. Le P&L reste entier dans le
   tableau de bord privé, qui n'est pas une surface publique.

2. **Les clés `testimonial_*` de `lib/i18n` sont mortes.** Vérifié le
   2026-08-17 : aucun composant ne les rend. Aucun témoignage n'est donc affiché,
   et la mention correspondante n'est pas due. Si les témoignages reviennent un
   jour sur la landing, `RiskDisclosure` porte déjà l'option `testimonials`.

---

## 8. Réponses du 2026-08-17 au soir : accès API ouvert, identifiants toujours pas là

Deux mails, à trois minutes d'intervalle.

### Ce qui est gagné

- **La question des comptes de prop firm est répondue, et bien.** « While prop
  users are not able to generate their own API key, by utilizing an OAuth
  connection, your end users can connect to your product without needing to pay
  for/generate their own API key. » C'est exactement le cas que nous avions
  isolé comme dernière inconnue, et la réponse porte nommément sur les prop
  users.
- **La revue de conformité est lancée** : « I've asked our Compliance team to
  review your materials. » Elle est partie le jour même où le travail a été
  terminé.
- **L'accès API est activé** sur `TradeDisciplineApp`.
- **Pas de bac à sable.** Développement et tests contre l'environnement de démo,
  `demo.tradovateapi.com`, en trading simulé sur données de marché réelles.
  `lib/sync/tradovate-oauth.ts` gère déjà les deux environnements.
- **Le Market Data WebSocket est fermé aux vendeurs** non enregistrés comme sous
  vendeur CME. Sans effet sur nous : notre usage est post-trade et ne demande
  aucune donnée de marché. C'est la position tenue depuis le premier message, et
  elle se révèle payante.

### Ce qui manque encore, et le point à ne pas manquer

Toujours **pas de `client_id` ni de `client_secret`**. Elle écrit que
l'information est couverte par les documents. Elle ne l'est pas, et leur propre
guide dit le contraire :

> « client id and client secret, which will be supplied by Tradovate »
> (https://github.com/tradovate/example-api-oauth)

Autrement dit ces identifiants ne se génèrent pas depuis notre compte : ils sont
émis par eux. « Activer l'accès API sur le username » et « délivrer des
identifiants OAuth partenaires » sont deux choses différentes, et seule la
première a eu lieu. C'est le seul point qui bloque encore, et il faut le
reformuler en citant leur propre phrase.

L'avenant est resté sans réponse pour la troisième fois. Ne pas insister
maintenant : la revue de conformité est en cours, c'est elle qui compte.

### Y a-t-il une action de notre côté pour obtenir les identifiants ? Non

Question posée par Axel, et elle méritait d'être posée avant d'écrire : inutile
de relancer si c'est à nous de cliquer quelque part. Sources lues le 2026-08-17.

Le guide OAuth le dit deux fois, et n'évoque ni page, ni formulaire, ni réglage
d'application :

> « We navigate to a special OAuth URL using our client id and client secret,
> **which will be supplied by Tradovate**. »
> « Replace the values with your special client variables, **provided to you by
> Tradovate**. »

La référence d'API dit la même chose des identifiants de compte :

> « `cid` is a client app id **provided by Tradovate**. `sec` is a secret (or
> API key) **provided by Tradovate**. »

Et elle décrit le chemin individuel, celui que le partenariat sert précisément à
contourner, à ne surtout pas emprunter :

> « You need a LIVE account with more than $1000 in equity. You need a
> subscription to API Access. You'll need to generate an API Key. »

**Une piste reste à écarter avant d'écrire.** Le mail annonce « your API key
should be enabled now ». Si une paire `cid` / `sec` est apparue dans le compte
`TradeDisciplineApp`, il n'est pas exclu qu'elle serve de `client_id` /
`client_secret` : leur exemple OAuth utilise `CLIENT_ID=1`, un petit entier, et
la référence montre `cid: 8`, du même genre. Le vocabulaire concorde aussi,
« client app id » contre `client_id`.

À vérifier en deux minutes dans l'application Tradovate avant toute relance. Si
la paire existe, on l'essaie contre l'environnement de démo : le parcours dira
oui ou non sans qu'aucun mail soit nécessaire. Si elle n'existe pas, ou si
l'écran de consentement répond « client_id inconnu », alors la relance est
fondée et se cite d'elle-même.

### Ce que la documentation a permis de trancher dans le code

Le fichier documentait deux divergences entre la référence d'API et l'exemple
officiel : le chemin et l'encodage. La version précédente pariait sur la
référence, avec une variable d'environnement pour rattraper un 404.

**Le chemin `/v1/auth/oauthtoken` était une erreur.** Vérifié en ouvrant
api.tradovate.com : cette chaîne n'apparaît nulle part dans la référence, qui
documente `POST /auth/oauthtoken` avec un exemple de requête en
`application/json`. Le préfixe venait d'une source périmée, et le code
l'appelait en premier. Il est relégué en dernier recours.

Reste la divergence sur l'encodage, réelle : la référence montre du JSON,
l'exemple officiel poste un formulaire. Le point de terminaison accepte un champ
`httpAuth` étranger à la RFC 6749, donc « la RFC impose le formulaire » ne
tranche pas. Les trois combinaisons sont essayées dans l'ordre, référence
d'abord, et surtout les deux encodages du BON chemin avant d'en changer : sinon
une simple erreur de type de contenu ferait conclure à un mauvais chemin.

Frontière tenue par des tests : on réessaie sur ce qui signale une mauvaise
porte (404, 405, 415, ou un 400 sans champ `error`), jamais sur un refus OAuth
argumenté. Un code d'autorisation est à usage unique, le rejouer serait pire que
l'échec d'origine.

---

## 9. Réponse du 2026-08-18 : l'OAuth se déclare soi-même, et la conformité répond

### Correction : les identifiants ne sont PAS à demander

Conclusion inverse de celle du 2026-08-17, et c'est la documentation publique qui
était périmée, pas la lecture. Michaelanne décrit un parcours en libre-service
dans Web Trader :

1. Application Settings
2. onglet API Access
3. **OAuth Registration**
4. formulaire : App Title, Redirect URI, liens de politique optionnels, permissions
5. Generate

> « The Client ID and Client Secret will be displayed once at creation, so be
> sure to store them securely. »

⚠️ **Affichés UNE SEULE FOIS.** Les copier immédiatement, les poser dans Vercel,
ne pas fermer l'onglet avant de les avoir enregistrés ailleurs.

Le guide OAuth de GitHub dit toujours « supplied by Tradovate » : il décrit un
état antérieur au libre-service. Ne plus s'y fier sur ce point.

Elle ajoute une précision, et se contredit dans le même mail : « You will be
prompted to sign an API agreement within the dashboard, but you should **not**
have to complete a self-attestation », puis « After completing the API
self-attestation and signing the digital agreement... ». À trancher par
l'observation : se déconnecter, se reconnecter, et regarder ce que l'écran
propose réellement.

Redirect URI à saisir dans le formulaire, à l'octet près :

    https://tradediscipline.app/api/broker/tradovate/oauth/callback

### Revue de conformité : rendue, avec une liste de corrections

L'équipe Compliance a rendu son avis. **Aucune remarque sur les avertissements**,
qui étaient l'essentiel du travail de la veille : ils passent. Les remarques
portent toutes sur des promesses de résultat trop affirmatives, plus un lien
mort.

Traité le 2026-08-18 :

| Demande | Traitement |
|---|---|
| « The AI sees what you don't » | « what you may not » |
| « Try it free » mène à un 404 | vrai bug, voir ci-dessous |
| « Our plans pay for themselves » | « can pay for themselves » |
| « it's already paid off » | « it could be paid off » |
| « Paid off by the first mistake » | « Potentially paid off... » |
| « Paid back in one trade » | « Potentially paid back... » |
| « covers your month » | « could cover your month » |
| titre de l'article prop firm | « How to potentially pass... » |

**Les quatre langues ont été traitées, pas seulement l'anglais.** La revue ne
portait que sur la version anglaise, mais `fr`, `de` et `es` affichent exactement
les mêmes promesses. Les corriger en anglais seulement aurait produit un site
conforme dans une langue sur quatre, ce qui n'a de sens ni vis-à-vis de la NFA
ni vis-à-vis du lecteur.

Pour l'anglais, l'instruction est suivie au mot près : c'est cette version que
leur équipe relit. Pour les trois autres, une tournure équivalente et naturelle,
en conservant les mots-clés de référencement.

### Le 404 : un vrai bug, trouvé grâce à eux

`components/landing/CoachOperator.tsx` pointait vers `/auth/signup`, une route
qui n'a jamais existé. Tous les autres appels à l'action de la landing vont sur
`/login`, qui porte le mode inscription. Le bouton « Try it free » de la section
Operator envoyait donc sur une page 404 chaque visiteur qui cliquait.

Impossible de dater le début. À retenir : une revue de conformité externe a
trouvé un bug de conversion que personne n'avait vu.

---

## 10. Relecture du texte réel de l'API License Agreement (2026-08-18)

Le contrat que la plateforme fait signer dans l'onglet « Accès à l'API » est **le
même** que celui signé par DocuSign le 14 août. La signature en ligne est la
façon dont Tradovate débloque l'accès, pas un nouvel engagement.

⚠️ La numérotation utilisée dans la section « Ce qui reste exposé » est décalée
d'un article par rapport au texte réel. Numérotation correcte, vérifiée sur le
document affiché :

| Article | Objet |
|---|---|
| 1 | Licence, accordée « solely » pour le passage d'ordres |
| 2 | Restrictions, dont la purge du cache sous 24 h |
| 3 | Copyleft interdit (GPL / LGPL / AGPL) |
| 4 | Customer Data |
| 10 | Indemnisation |
| 13 | Droit de l'Illinois, tribunaux de Cook County |
| 16 | Clause d'intégralité |

### La purge sous 24 h ne nous concerne pas, et voici pourquoi

C'était l'inquiétude la plus sérieuse : un journal de trading qui doit effacer
l'historique toutes les 24 h n'est pas un journal. Le texte la lève.

L'article 2 vise le **NinjaTrader Content**, défini à l'article 1 (ii) comme
« certain content and market data made available by NinjaTrader ». C'est la
donnée de marché, que nous n'utilisons pas.

Les exécutions et le solde d'un utilisateur relèvent de l'article 4, **Customer
Data**, dont le régime est tout autre : « each party may use such Customer Data
for any purpose authorized by such Customer under its Customer Agreement,
provided that such Customer has provided its consent ». C'est exactement notre
modèle : l'utilisateur connecte son compte, donc il consent, et nos CGU sont le
Customer Agreement qui porte ce consentement.

Conclusion : rien à purger, à condition de ne jamais stocker de données de
marché. C'est déjà la ligne tenue depuis le premier message.

### Ce qui reste réellement exposé

**Article 1.** La licence est accordée « solely for the purpose of connecting
Your order entry and/or trading program(s) software to NinjaTrader's electronic
order entry system to facilitate the entry of futures and options on futures
trading by Your customers ». Notre usage, lecture seule et post-trade, n'entre
pas dans cette phrase. Le texte ne l'autorise pas plus qu'il ne l'interdit : il
ne l'envisage pas.

La défense pratique n'est pas contractuelle, elle est documentaire : NinjaTrader
a explicitement validé notre usage OAuth en lecture seule par écrit, les 5, 14 et
17 août. Garder ce fil.

**Article 13.** Droit de l'Illinois, litiges à Cook County uniquement. Pour une
entreprise individuelle française, plaider à Chicago n'est pas une option
économique. Asymétrie réelle, standard, et non négociable à notre taille.

**Article 16, et c'est le point neuf.** La clause d'intégralité dit que le
contrat « supersedes all previous agreements » et constitue « the full and entire
understanding ». Le signer aujourd'hui redate donc cette clause **après** les
mails des 5, 14 et 17 août qui confirment la levée des frais. Cela ne change rien
à la situation pratique, et il faut signer pour obtenir l'OAuth, mais c'est un
argument de plus pour obtenir l'avenant : la levée reste hors contrat, et le
contrat se réaffirme comme intégral à chaque signature.

### Article 3 : copyleft revérifié le 2026-08-18

Une dépendance sous GPL, LGPL ou AGPL résilie **immédiatement** toutes nos
licences. Contrôle refait ce jour sur les dépendances de production :

    npx license-checker --production --summary

Aucune GPL, LGPL ni AGPL. Deux points méritent une note pour éviter une panique
au prochain audit :

- `web-push` est en **MPL-2.0**, et `dompurify` en MPL-2.0 ou Apache-2.0. La
  MPL est un copyleft **de fichier** : elle n'exige la divulgation que des
  fichiers MPL modifiés, jamais d'un autre logiciel. Or l'article 3 ne vise que
  les licences qui pourraient exiger la divulgation « of any other software ».
  La MPL n'entre donc pas dans sa définition, tant que nous ne modifions pas ces
  paquets, ce que nous ne faisons pas.
- `UNLICENSED` est notre propre paquet, sans objet.

À refaire avant chaque ajout de dépendance. C'est la seule clause du contrat qui
se déclenche toute seule, sans mise en demeure.

---

## Sources

- Accès API Tradovate, conditions et coût : https://danetrades.com/help-center/accounts-connections/tradovate-api-requirements-and-subscription/
- OAuth réservé aux partenaires approuvés, revue formelle : https://community.tradovate.com/t/api-access-for-3rd-party-app-development/11941
- Licence vendeur entreprise évoquée, coûts : https://community.tradovate.com/t/third-party-oauth-integration/12456
- Portail Partner API : https://partner.ninjatrader.com/
- Programme vendeur Ecosystem et adresse de contact : https://ninjatraderecosystem.com/article/ninjatrader-vendor-program/
- Parcours TradeZella pour comparaison (login seul, pas de clé API) : https://help.tradezella.com/en/articles/9557659-tradovate-how-to-sync-your-tradovate-account-with-tradezella
