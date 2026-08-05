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
| Envoi à info@ninjatraderecosystem.com | à faire |
| Dépôt via partner.ninjatrader.com « Talk to Sales » | à faire |
| Relance à J+10 ouvrés | à faire |
| Réponse sur la question 3 (add-on individuel encore requis ou non) | en attente |

Une seule chose reste à ta main avant l'envoi : vérifier que tu veux bien
publier l'adresse d'Angres dans ce dossier. Elle figure déjà dans les mentions
légales du site, donc elle est publique, mais si la domiciliation aboutit d'ici
là, autant y mettre la nouvelle.

La question 3 est celle qui décide de tout. Si les utilisateurs finaux doivent
malgré tout payer l'add-on à 25 $ par mois même via OAuth partenaire, alors le
partenariat ne règle pas le problème de GD Invest et il faut arrêter d'investir
sur ce rail pour pousser NinjaTrader et l'import CSV à la place.

---

## Sources

- Accès API Tradovate, conditions et coût : https://danetrades.com/help-center/accounts-connections/tradovate-api-requirements-and-subscription/
- OAuth réservé aux partenaires approuvés, revue formelle : https://community.tradovate.com/t/api-access-for-3rd-party-app-development/11941
- Licence vendeur entreprise évoquée, coûts : https://community.tradovate.com/t/third-party-oauth-integration/12456
- Portail Partner API : https://partner.ninjatrader.com/
- Programme vendeur Ecosystem et adresse de contact : https://ninjatraderecosystem.com/article/ninjatrader-vendor-program/
- Parcours TradeZella pour comparaison (login seul, pas de clé API) : https://help.tradezella.com/en/articles/9557659-tradovate-how-to-sync-your-tradovate-account-with-tradezella
