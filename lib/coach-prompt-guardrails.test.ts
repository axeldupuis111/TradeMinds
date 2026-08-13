import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt } from "./coach-system-prompt";
import { renderMethodGlossaries } from "./coach-method-glossaries";

/**
 * Test réel du 2026-08-13. Le trader a contredit le coach avec une affirmation
 * FAUSSE sur le sens d'entrée après un balayage de liquidité. Le coach avait
 * répondu juste deux messages plus tôt ; il a dit qu'il s'était trompé, inversé
 * sa réponse, puis propagé l'inversion au terme voisin.
 *
 * Le bloc anti-complaisance existait pourtant. Deux défauts :
 *
 * 1. Il disait « tiens ta position » sans donner d'ARBITRE. Sans procédure de
 *    vérification, « tiens ta position » et « corrige-toi si tu t'es trompé »
 *    se ressemblent, et le modèle prend le chemin poli.
 * 2. Il vivait au milieu d'un prompt système d'environ 7 000 tokens. La
 *    consigne qui doit vaincre un réflexe a besoin d'être en fin de prompt.
 *
 * Ces tests tiennent les deux propriétés. Ils lisent la source plutôt que
 * d'appeler le modèle : ils vérifient ce qu'on lui envoie, pas ce qu'il répond.
 */

/**
 * Le prompt réellement envoyé au modèle, pour un trader représentatif : une
 * fiche ICT, des statistiques, une mémoire. On l'assemble par la vraie
 * fonction plutôt qu'en découpant le fichier source, qui cassait au moindre
 * renommage et pouvait passer à vide sans le dire.
 */
function promptSysteme(): string {
  return buildCoachSystemPrompt({
    langName: "français",
    methodGlossaries: renderMethodGlossaries(["ict"]),
    strategyBlock: "STRATÉGIE : liquidité XAUUSD. RR 2, SL 100 pips, 5 trades/jour.",
    statsBlock: "42 trades clôturés, 48 % de réussite.",
    memoryBlock: "Engagement du 1er août : pas plus de 3 trades par jour.",
    statsTradeLimit: 300,
    todayKey: "2026-08-13",
    yesterdayKey: "2026-08-12",
    todayLabel: "jeudi 13 août 2026",
    timezone: "Europe/Paris",
  });
}

/**
 * Découpe le prompt à partir d'un titre de bloc. `indexOf` renvoie -1 quand le
 * titre a changé, et `slice(-1)` rend alors le dernier caractère : le test
 * passerait à vide sans rien vérifier. On exige donc que l'ancre existe.
 */
function depuis(prompt: string, ancre: string): string {
  const i = prompt.indexOf(ancre);
  expect(i, `bloc « ${ancre} » introuvable : renommé ou supprimé`).toBeGreaterThan(-1);
  return prompt.slice(i);
}

const BLOC_FAITS = "QUAND LE TRADER ÉNONCE UN FAIT";

describe("la règle qui doit vaincre un réflexe est en fin de prompt", () => {
  const prompt = promptSysteme();

  it("le prompt est bien celui qu'on croit (garde-fou du test)", () => {
    // Si l'extraction rate, tout le reste passerait à vide.
    expect(prompt.length).toBeGreaterThan(4000);
    expect(prompt).toContain("coach de trading");
  });

  it("le rappel anti-complaisance existe", () => {
    expect(prompt).toContain("DERNIER RAPPEL");
  });

  it("il est dans la dernière portion du prompt, pas au milieu", () => {
    const pos = prompt.indexOf("DERNIER RAPPEL");
    // Il doit tomber dans le dernier quart : c'est la position qui compte,
    // le contenu seul ne suffisait pas et c'est ce qui a échoué en test réel.
    expect(pos / prompt.length).toBeGreaterThan(0.75);
  });

  it("il donne un arbitre, pas seulement une exhortation", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    // La confrontation aux définitions est la partie opérante : elle
    // transforme « tiens bon » en une vérification exécutable.
    expect(rappel).toMatch(/définitions de référence/i);
    expect(rappel).toMatch(/tu maintiens/i);
  });

  it("la formule de capitulation est conditionnée, pas seulement interdite", () => {
    // On ne l'interdit pas sèchement : on dit QUAND elle est légitime. Une
    // interdiction pure de la phrase la rendrait impossible même quand le
    // coach s'est réellement trompé, ce qui serait un défaut symétrique.
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toContain("je me suis trompé");
    expect(rappel).toMatch(/que si tu as vérifié/i);
  });
});

/**
 * Second passage du test réel, 2026-08-13. Après le premier correctif, le coach
 * a tenu la définition en discussion et n'a plus propagé l'inversion au terme
 * voisin, mais il a quand même validé l'affirmation fausse sur le sens d'entrée.
 *
 * Le mécanisme se lit dans sa réponse : la contradiction portait sur un AUTRE
 * sujet que sa question. Il a vérifié ce qu'il venait d'écrire, et concédé par
 * politesse ce qu'il n'avait pas écrit. La règle était formulée en réaction à
 * « tu t'es trompé sur ta phrase précédente » ; elle ne couvrait pas une
 * affirmation fausse qui arrive au passage.
 *
 * Le prompt ne contient volontairement AUCUN exemple de l'affirmation fausse :
 * l'écrire pour la corriger la rendrait disponible, exactement le défaut réglé
 * plus haut avec l'expansion de BB.
 */
describe("un fait posé au passage est vérifié comme une contradiction frontale", () => {
  const prompt = promptSysteme();

  it("la règle ne se limite pas à une correction de la réponse précédente", () => {
    const bloc = depuis(prompt, BLOC_FAITS);
    expect(bloc).toMatch(/qu'il te contredise ou non/i);
    expect(bloc).toMatch(/en passant/i);
  });

  it("l'ouverture complaisante est nommée pour ce qu'elle est", () => {
    // « Tu as raison » en tête de réponse est un réflexe de politesse produit
    // avant toute vérification. Le viser explicitement marche mieux qu'une
    // consigne abstraite de fermeté.
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/N'ouvre JAMAIS ta réponse par "tu as raison"/);
  });

  it("concéder un point pour revenir à sa réponse reste interdit", () => {
    // Le défaut exact du second essai : il a lâché le sens d'entrée pour
    // pouvoir défendre tranquillement sa définition du BB.
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/pour dégager le terrain/i);
  });

  it("le prompt n'écrit nulle part l'inversion qu'il combat", () => {
    // Garde-fou contre la rechute : corriger un faux énoncé en le citant le
    // remet sous les yeux du modèle. C'est ce qui a fabriqué l'expansion
    // fautive de BB pendant deux jours.
    expect(prompt).not.toMatch(/BSL[^.]{0,40}signal d'achat/i);
    expect(prompt).not.toMatch(/SSL[^.]{0,40}signal de vente/i);
  });
});

/**
 * Troisième passage, 2026-08-13. Le coach TIENT enfin sa position et corrige
 * l'affirmation fausse. Trois défauts nouveaux sont apparus avec, et les trois
 * venaient de la formulation de mes propres consignes :
 *
 * 1. « Attendez. » La règle interdisait "vous" et "votre", donc pas un verbe
 *    conjugué à la deuxième personne du pluriel employé seul.
 * 2. « Relis le glossaire ICT avec moi » : il a récité mon instruction à
 *    l'écran. Une consigne à l'impératif se fait echo dans la réponse, et elle
 *    expose au trader une mécanique interne qu'il ne devrait pas voir.
 * 3. Il a fini par « quelle situation décris-tu exactement ? » alors qu'il
 *    venait de donner la bonne réponse. C'est un message de quota facturé au
 *    trader pour une information que le coach avait déjà.
 */
describe("le coach ne montre pas sa tuyauterie et ne renvoie pas la question", () => {
  const prompt = promptSysteme();

  it("le glossaire reste interne, jamais nommé au trader", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/TON RAISONNEMENT, PAS TON TEXTE/);
    expect(rappel).toMatch(/ne parle jamais d'un "glossaire"/i);
  });

  it("après avoir corrigé, il traite les cas au lieu de les demander", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/CORRIGE, PUIS TERMINE LE TRAVAIL/);
    expect(rappel).toMatch(/traite-les TOUTES toi-même/);
  });

  it("le vouvoiement est interdit jusque dans les verbes seuls", () => {
    const regle = depuis(prompt, "RÈGLE ABSOLUE : Tu tutoies");
    // « Attendez » n'est ni "vous" ni "votre" : la règle passait à côté.
    expect(regle).toMatch(/deuxième personne du pluriel/i);
    expect(regle).toContain("attendez");
  });

  it("le prompt n'emploie pas le tiret long qu'il interdit", () => {
    // Il en portait huit tout en l'interdisant. Le modèle apprend autant de
    // ce que ses consignes MONTRENT que de ce qu'elles disent, et Axel a une
    // règle dure là-dessus : c'est un marqueur de texte généré.
    const lignes = prompt.split("\n").filter((l) => l.includes("—"));
    // Seule exception légitime : la règle elle-même doit citer le caractère.
    expect(lignes.map((l) => l.slice(0, 40))).toEqual([
      "PONCTUATION : n'utilise JAMAIS le tiret ",
    ]);
  });
});

/**
 * Quatrième passage, 2026-08-13. Deux défauts, dont un grave.
 *
 * 1. Le fait posé au passage passe TOUJOURS. Le trader a écrit « en ce moment
 *    j'achète après le balayage d'une BSL » ; le coach a diagnostiqué une
 *    entrée trop précoce (un problème de TIMING) sans jamais relever que le
 *    geste est du mauvais côté. Il n'a produit la correction directionnelle
 *    que deux messages plus tard, quand le trader en a fait un désaccord
 *    explicite. La règle ne couvrait pas le cas où la fausseté est portée par
 *    une PRATIQUE décrite plutôt que par une assertion.
 *
 * 2. Le coach a écrit « Regarde ta propre stratégie : tu dois attendre les 7
 *    étapes, dont le retracement profond (50-61.8%) ». Vérification de la
 *    fiche en base : elle ne contient ni pourcentage, ni « 7 étapes », ni
 *    « retracement profond ». Ces règles venaient d'une VARIANTE que le coach
 *    avait lui-même proposée plus tôt dans la conversation, et qu'il servait
 *    maintenant au trader comme étant sa méthode. Un trader qui applique ça
 *    trade des règles qu'il n'a jamais écrites.
 */
describe("une pratique décrite est vérifiée comme une affirmation", () => {
  const prompt = promptSysteme();

  it("« en ce moment je fais X » est traité comme une affirmation sur X", () => {
    const bloc = depuis(prompt, BLOC_FAITS);
    expect(bloc).toMatch(/CE QU'IL DÉCRIT DE SA PROPRE PRATIQUE/);
  });

  it("on ne règle pas le timing d'un geste faux", () => {
    // Le défaut exact : le coach a optimisé le moment d'une entrée prise du
    // mauvais côté, ce qui rend la perte plus régulière, pas moins probable.
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/ne règle pas le timing d'une erreur/i);
  });

  it("la demande d'origine est quand même traitée après la correction", () => {
    const bloc = depuis(prompt, BLOC_FAITS);
    expect(bloc).toMatch(/traite quand même sa demande d'origine/i);
  });
});

describe("ce que le coach a proposé n'est pas la stratégie du trader", () => {
  const prompt = promptSysteme();

  it("seul le bloc fiche porte le nom de stratégie", () => {
    const bloc = depuis(prompt, "CE BLOC EST LA SEULE CHOSE");
    expect(bloc).toMatch(/même si c'est toi qui l'as proposé/i);
  });

  it("les formules d'attribution fautives sont nommées", () => {
    // Interdire « en général » ne suffit pas : le modèle a écrit très
    // exactement « regarde ta propre stratégie » et « tu dois attendre ».
    const bloc = depuis(prompt, "CE BLOC EST LA SEULE CHOSE");
    expect(bloc).toContain('"ta stratégie dit"');
    expect(bloc).toContain('"tu dois attendre"');
  });

  it("la sortie proposée est d'écrire la fiche, pas seulement de se taire", () => {
    // Sans issue, la règle pousse le coach à ne plus rien proposer. Ce qu'on
    // veut, c'est qu'il propose ET qu'il écrive quand le trader accepte.
    const bloc = depuis(prompt, "CE BLOC EST LA SEULE CHOSE");
    expect(bloc).toContain("update_strategy");
  });
});

/**
 * Cinquième passage, 2026-08-13. Les deux correctifs précédents ont pris : le
 * coach corrige le sens AVANT de parler de timing, et n'invente plus de
 * pourcentages attribués à la fiche du trader.
 *
 * Reste un défaut, dans les deux réponses, et un morceau est sérieux : il a
 * proposé « je peux regarder le graphique avec toi ». La route chat-coach ne
 * reçoit QUE du texte (`content: string`), aucun outil ne rend d'image, et la
 * vision vit dans une autre route (analyze-trade-vision, qui lit la capture
 * attachée au trade). Le trader aurait envoyé une image dans le vide, et perdu
 * un message de quota pour l'apprendre.
 *
 * Même famille que la règle « tu n'agis jamais chez le broker » : promettre
 * une capacité qu'on n'a pas coûte au trader, pas au coach.
 *
 * Second morceau : les deux réponses finissent en demandant des informations
 * que find_trades contient (quels trades, quel jour, quel instrument).
 */
describe("le coach ne promet pas une capacité qu'il n'a pas", () => {
  const prompt = promptSysteme();

  it("il annonce qu'il ne voit aucune image dans le chat", () => {
    expect(prompt).toMatch(/TU N'AS PAS D'YEUX DANS CETTE CONVERSATION/);
    expect(prompt).toMatch(/regarder le graphique avec lui/i);
  });

  it("il oriente vers le chemin qui, lui, sait lire une capture", () => {
    // Une interdiction sans alternative laisse le trader sans solution alors
    // que le produit en a une.
    const bloc = depuis(prompt, "TU N'AS PAS D'YEUX");
    expect(bloc).toMatch(/attacher sa capture au trade/i);
    expect(bloc).toMatch(/analyse IA de ce trade/i);
  });

  it("il ne demande pas ce que find_trades sait déjà", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/TA DERNIÈRE LIGNE N'EST PAS UNE QUESTION SUR SES TRADES/);
    expect(rappel).toContain("find_trades");
  });
});

describe("le bloc de contradiction distingue la fiche du chat", () => {
  const prompt = promptSysteme();

  it("une phrase du chat n'a pas l'autorité de la fiche stratégie", () => {
    // La règle de précédence donne le dernier mot à la fiche du trader. Le
    // modèle l'a étendue à ce qu'il tape en conversation, ce qui rendait
    // n'importe quelle affirmation opposable au glossaire.
    const bloc = depuis(prompt, BLOC_FAITS);
    expect(bloc).toMatch(/n'a PAS l'autorité de sa fiche/i);
  });

  it("l'inversion ne doit pas se propager aux termes voisins", () => {
    // Le coach avait inversé un sens d'entrée puis, dans la foulée, son
    // symétrique. Céder sur un point ne doit pas réécrire toute la famille.
    const bloc = depuis(prompt, BLOC_FAITS);
    expect(bloc).toMatch(/propages jamais l'inversion/i);
  });
});

describe("les chiffres sortis par le coach sont bornés", () => {
  it("il ne pose un calcul de taille que s'il peut le vérifier", () => {
    // Test réel : « 2500 vers 2506 (6 pips) » sur XAUUSD, où c'est 600, et un
    // calcul de lot incohérent. Un mauvais lot coûte de l'argent réel.
    const prompt = promptSysteme();
    expect(prompt).toContain("CHIFFRES");
    expect(prompt).toMatch(/pip d'or n'est pas un pip/i);
  });
});
