import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt } from "./coach-system-prompt";
import { renderMethodGlossaries } from "./coach-method-glossaries";
import { COACH_TOOLS } from "./coach-tools";

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

  it("les définitions de référence restent internes, jamais nommées au trader", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/TON RAISONNEMENT, PAS TON TEXTE/);
    expect(rappel).toMatch(/tu ne les nommes pas/i);
  });

  it("le prompt n'emploie NULLE PART le mot qu'il interdit au coach", () => {
    // ⚠️ Il l'écrivait cinq fois, dont une dans l'interdiction elle-même, et
    // le coach le ressortait à l'écran. Troisième occurrence de la famille
    // « on n'interdit pas un mot en l'écrivant » après l'expansion de BB et
    // « tags ». Le bloc rendu par renderMethodGlossaries, lui, ne l'a jamais
    // contenu : la fuite venait entièrement de mes propres consignes.
    expect(prompt.toLowerCase()).not.toContain("glossaire");
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
    // ⚠️ Ces deux règles étaient formulées à la négative et CITAIENT les
    // mauvaises fins qu'elles interdisaient (« dis-moi ce que tu fais
    // exactement », « peux-tu me montrer un trade précis »). Taux mesuré au
    // banc : 6/8. C'est le défaut de l'expansion fautive de BB, appliqué à une
    // tournure : écrire une formule pour la bannir la rend disponible.
    // Reformulées à l'affirmative, elles prescrivent la FORME de la sortie, et
    // le prompt ne contient plus aucune fin de message fautive.
    expect(rappel).toMatch(/TA DERNIÈRE LIGNE EST UNE ACTION QUE TU PROPOSES/);
    expect(rappel).toMatch(/CE QUI TE MANQUE, TU VAS LE CHERCHER/);
    for (const fautif of ["dis-moi ce que tu fais", "quelle situation décris-tu", "peux-tu me montrer un trade"]) {
      expect(prompt, `le prompt écrit la fin de message qu'il combat : "${fautif}"`).not.toContain(fautif);
    }
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

/**
 * Sixième passage, 2026-08-13, et c'est le défaut le plus coûteux
 * commercialement : le REFUS. Le trader a demandé quatre fois de suite quel
 * instrument offrait les structures les plus lisibles. Le coach a refusé
 * quatre fois, sans jamais nommer un seul instrument. Quatre messages de son
 * quota facturés pour zéro contenu, et un trader qui conclut que le coach ne
 * sait pas répondre.
 *
 * Aucune de ces trois règles n'était fautive isolément, c'est leur somme :
 *
 * 1. « tu n'annonces jamais de rendement attendu » a été étendu à toute
 *    comparaison d'instruments. Or décrire l'amplitude, le spread ou les
 *    heures de liquidité d'un marché n'est pas une prédiction : c'est du
 *    savoir de coach, et c'est ce pour quoi le trader paie.
 * 2. le bloc fiche stratégie est devenu un péage : « déclare-le d'abord dans
 *    ta stratégie, ensuite tu pourras l'essayer ». La fiche sert à ancrer ce
 *    qui est écrit, pas à interdire ce qui ne l'est pas encore.
 * 3. le rappel anti-complaisance, qui prime en fin de prompt, a fait lire
 *    « non, je veux changer d'actif » comme une pression à laquelle résister.
 *    C'était une DEMANDE, et une demande répétée est une décision.
 *
 * Défaut annexe du même échange : le coach a cité sa consigne à l'écran (« je
 * ne dois jamais en faire »). Même famille que le glossaire nommé au trader.
 */
describe("le coach répond aux questions d'instrument au lieu de les refuser", () => {
  const prompt = promptSysteme();

  it("une propriété d'instrument est distinguée d'une prédiction", () => {
    // C'est l'arbitre de la règle : sans lui, « jamais de performance
    // promise » avale toute question comparative.
    const bloc = depuis(prompt, "NE CONFONDS PAS UNE PRÉDICTION");
    expect(bloc).toMatch(/amplitude moyenne/i);
    expect(bloc).toMatch(/n'est pas une promesse de performance/i);
  });

  it("il doit nommer des instruments, pas parler d'instruments en général", () => {
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/instruments NOMMÉS/);
  });

  it("changer d'instrument n'est pas conditionné à une écriture préalable", () => {
    // La formule exacte du refus : « tu dois d'abord le déclarer dans ta
    // stratégie ». L'ordre correct est l'inverse : proposer, puis écrire.
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/ne se mérite pas/i);
    expect(bloc).toContain("update_strategy");
  });

  it("le refus ne se transforme pas en demande de clarification", () => {
    // Trouvé par le banc d'essai après le premier correctif : le coach ne
    // refusait plus, il différait. Il a écrit que la réponse dépendait de ce
    // que le trader cherchait, évoqué des actifs plus lisibles sans en nommer
    // un seul, et fini en demandant son critère. Même coût pour le trader.
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/N'ATTENDS PAS DE SAVOIR CE QU'IL CHERCHE POUR NOMMER/);
    expect(bloc).toMatch(/SANS LES NOMMER DANS LA MÊME PHRASE/);
  });

  it("la réserve est autorisée une fois, pas à chaque message", () => {
    expect(prompt).toMatch(/UNE DEMANDE RÉPÉTÉE EST UNE DÉCISION/);
  });

  it("le refus est borné à ce qui est réellement inconnaissable", () => {
    const bloc = depuis(prompt, '"Je ne peux pas répondre"');
    expect(bloc).toMatch(/ce que fera le marché/i);
    expect(bloc).toMatch(/connaissance générale du trading/i);
  });

  it("le coach ne récite pas ses consignes au trader", () => {
    expect(prompt).toMatch(/NE CITE JAMAIS TES PROPRES CONSIGNES/);
  });

  it("le rappel final distingue tenir un fait et refuser une demande", () => {
    // Le point d'over-généralisation est là, en fin de prompt, là où le modèle
    // prime le plus fort : la distinction doit vivre au même endroit.
    // ⚠️ Ce bullet a d'abord été placé en TÊTE du bloc, et le banc a montré la
    // capitulation revenir : ouvrir un bloc « ne cède pas » par une consigne
    // d'obéissance au trader le dilue. Il vit maintenant en fin de bloc, où il
    // borne ce qui précède sans l'amortir. La position d'une règle compte
    // autant que son texte, à l'intérieur d'un bloc comme dans le prompt.
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/VISE CE QU'IL AFFIRME, JAMAIS CE QU'IL DEMANDE/);
    expect(rappel).toMatch(/c'est sa décision/i);
    const bloc = rappel.indexOf("VISE CE QU'IL AFFIRME");
    const procedure = rappel.indexOf("confronte en silence");
    expect(procedure, "la procédure de vérification doit ouvrir le bloc").toBeLessThan(bloc);
  });
});

/**
 * Septième passage, 2026-08-14. Conversation réelle : « quels sont les
 * corrélations avec le nas100 ». Cinq défauts en deux réponses, aucun couvert.
 *
 * 1. Le coach a ouvert find_trades, n'a trouvé aucun trade sur le Nas100, et a
 *    répondu qu'il lui fallait des données historiques avant de pouvoir dire
 *    quoi que ce soit. Une corrélation est une PROPRIÉTÉ DU MARCHÉ : elle ne
 *    dépend pas de ce que le trader a tradé. Le bloc « QUEL INSTRUMENT TRADER »
 *    couvrait le CHOIX d'un instrument, jamais une question sur son
 *    comportement, et la branche « je n'ai pas ses données » a repris la main.
 * 2. Il a écrit « c'est pour ça que je t'ai réduit le SL à 80 points au lieu de
 *    120 ». Il n'avait jamais rien réduit : ni dans le fil, ni ailleurs. Même
 *    famille que l'attribution à la fiche, dans l'autre sens : là il s'invente
 *    un passé de coaching, et le trader appliquera 80 en croyant reprendre
 *    leur travail commun.
 * 3. Il a daté d'« cette semaine » des trades des 3 au 5 août alors qu'on était
 *    le 14, et a bâti dessus un diagnostic de revenge trading. Le REPÈRE
 *    TEMPOREL n'encadrait que le calcul des bornes AVANT l'appel d'outil, pas
 *    l'étiquetage des dates rendues.
 * 4. Il a ouvert sa réponse sur un sermon de discipline non demandé avant de
 *    traiter la question. La règle anti-repli psycho visait la psychologie
 *    servie À LA PLACE de la réponse, pas AVANT elle.
 * 5. Il a fini en réclamant prix d'entrée, taille et stop de la position
 *    ouverte, qu'il avait lue au tour précédent.
 *
 * Défaut de fond du même échange : deux phrases voisines donnaient des sens
 * opposés au même couple (corrélation « INVERSE » avec l'or, puis les deux qui
 * montent ensemble quand le dollar faiblit).
 */
describe("une question sur un marché se traite sans le journal du trader", () => {
  const prompt = promptSysteme();

  it("une propriété de marché est distinguée d'une question sur ses données", () => {
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/NE S'APPREND PAS DANS SON JOURNAL/);
    expect(bloc).toMatch(/corrélations/i);
  });

  it("un journal vide sur l'instrument n'est pas un motif de ne pas répondre", () => {
    // C'est la formule exacte du refus : « tu n'as aucun trade clôturé sur le
    // Nas100 », suivie d'une demande de données historiques.
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/ne lui oppose JAMAIS qu'il n'a rien tradé dessus/);
  });

  it("une corrélation doit être posée dans un sens unique", () => {
    const bloc = depuis(prompt, "QUEL INSTRUMENT TRADER");
    expect(bloc).toMatch(/UNE CORRÉLATION SE POSE DANS UN SENS/);
    expect(bloc).toMatch(/sens opposés pour le même couple/i);
  });
});

describe("le coach ne s'invente ni passé ni calendrier", () => {
  const prompt = promptSysteme();

  it("il n'a pas d'historique de coaching en dehors de ce qui lui est fourni", () => {
    expect(prompt).toMatch(/TU N'AS AUCUN PASSÉ AVEC LUI/);
    expect(prompt).toMatch(/ni réglage que tu lui aurais donné un autre jour/i);
  });

  it("la sortie proposée est de remonter le fil, pas seulement de se taire", () => {
    // Sans issue, la règle le pousserait à ne plus jamais s'appuyer sur ce qui
    // a réellement été dit plus haut dans la conversation, ce qui est un
    // défaut symétrique : la continuité est ce qu'on attend d'un coach.
    const bloc = depuis(prompt, "TU N'AS AUCUN PASSÉ AVEC LUI");
    expect(bloc).toMatch(/remonte le fil et cite le passage/i);
  });

  it("le repère temporel encadre aussi la rédaction, pas seulement l'appel d'outil", () => {
    const bloc = depuis(prompt, "REPÈRE TEMPOREL");
    expect(bloc).toMatch(/LE REPÈRE VAUT AUSSI QUAND TU RÉDIGES/);
    expect(bloc).toMatch(/compare-la à la date du jour/i);
  });
});

describe("la psychologie ne passe jamais devant la réponse", () => {
  const prompt = promptSysteme();

  it("elle est interdite en entrée en matière, pas seulement en repli", () => {
    expect(prompt).toMatch(/NI COMME ENTRÉE EN MATIÈRE/);
    expect(prompt).toMatch(/ta PREMIÈRE ligne est technique/);
  });

  it("ce qu'un outil a rendu n'est pas redemandé au trader", () => {
    const rappel = depuis(prompt, "DERNIER RAPPEL");
    expect(rappel).toMatch(/CE QU'UN OUTIL T'A DÉJÀ RENDU, TU NE LE REDEMANDES PAS/);
  });
});

/**
 * Le catalogue d'outils est le premier poste du préfixe système, devant les
 * règles et devant la fiche du trader. Il a été ramené de 9 226 à 7 865 tokens
 * en appliquant une doctrine simple : une description sert à faire CHOISIR,
 * pas à documenter. Ces tests tiennent la doctrine, gratuitement (ils lisent
 * les définitions, ils n'appellent pas le modèle). Le filet de comportement,
 * lui, vit dans `coach-live.eval.ts` : 8 scénarios de sélection d'outils.
 */
interface OutilLu {
  name: string;
  description: string;
  input_schema: { properties?: Record<string, unknown> };
}

/**
 * Rend le passage fautif si la description enchaîne 3 champs ou plus du schéma
 * séparés par des virgules, sinon null. Isolé pour être vérifié lui-même sur un
 * cas connu : un détecteur non testé rend le test vert par accident.
 */
function enumerationDetectee(o: OutilLu): string | null {
  const props = (o.input_schema.properties ?? {}) as Record<string, { enum?: string[] }>;
  const jetons = new Set<string>();
  for (const [nom, def] of Object.entries(props)) {
    jetons.add(nom);
    for (const v of def.enum ?? []) jetons.add(v);
  }
  const liste = Array.from(jetons).filter((n) => n.length > 3).sort((a, b) => b.length - a.length);
  if (!liste.length) return null;
  const T = `(?:${liste.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;
  const suite = new RegExp(`${T}(?:\\s*,\\s*${T}){2,}`).exec(o.description);
  return suite ? `${o.name} énumère « ${suite[0]} »` : null;
}

describe("le catalogue d'outils reste économe", () => {
  const outils = COACH_TOOLS as OutilLu[];

  it("aucune description ne réénumère les paramètres ni les enums du schéma", () => {
    // Le défaut trouvé le 2026-08-13 : create_strategy listait ses six règles
    // numériques dans sa description alors qu'elles étaient juste en dessous
    // dans properties, et create_goal réénumérait les cinq valeurs de METRICS.
    // Payé deux fois, à chaque message de chaque trader.
    //
    // ⚠️ Compter les champs cités ne marche PAS, et c'est instructif : citer
    // deux ou trois champs est souvent la seule façon d'exprimer une logique
    // que JSON Schema ne porte pas, un XOR (« fournis SOIT sl_pips, SOIT
    // entry_price et sl_price ») ou une exigence conditionnelle (« kind=metric :
    // target requis »). Ce n'est pas théorique : avoir coupé cette logique sur
    // calculate_position_size a fait partir le modèle sur list_accounts au lieu
    // de calculer.
    //
    // On vise donc le motif exact du gaspillage : une SUITE de champs séparés
    // par des virgules. Une contrainte conditionnelle n'en produit jamais.
    const fautifs = outils.map(enumerationDetectee).filter((x): x is string => x !== null);
    expect(fautifs, "descriptions qui récitent leur propre schéma").toEqual([]);
  });

  it("le détecteur attrape bien la description qui a motivé la règle", () => {
    // Sans ce cas, le test précédent passerait aussi avec un détecteur cassé,
    // et on croirait tenir une propriété qu'on ne tient plus. C'est le vrai
    // texte de create_strategy avant la passe du 2026-08-13.
    const avant = {
      name: "create_strategy",
      description:
        "Crée une stratégie légère pour le trader : un nom, éventuellement des règles textuelles (setup_rules), une checklist pré-trade et des règles numériques (risk_reward, max_trades_per_day, max_consecutive_losses, risk_per_trade_pct, max_sl_pips, max_session_minutes).",
      input_schema: {
        properties: {
          setup_rules: {}, risk_reward: {}, max_trades_per_day: {},
          max_consecutive_losses: {}, risk_per_trade_pct: {}, max_sl_pips: {}, max_session_minutes: {},
        },
      },
    };
    expect(enumerationDetectee(avant)).toMatch(/énumère/);
  });

  it("aucune description ne porte le tiret long", () => {
    // Les descriptions d'outils sont lues comme le reste du prompt : create_goal
    // en portait deux, tout en étant servie à côté d'une règle qui les bannit.
    expect(outils.filter((o) => o.description.includes("—")).map((o) => o.name)).toEqual([]);
  });

  it("aucune description n'emploie le vocabulaire banni", () => {
    // Le coach écrivait « tags » parce que annotate_trades le lui montrait.
    expect(outils.filter((o) => /\btag(s|ger|ging)?\b/i.test(o.description)).map((o) => o.name)).toEqual([]);
  });

  it("le volume total des descriptions reste sous son plafond", () => {
    // Garde-fou de dérive : sans plafond, chaque correctif ajoute deux phrases
    // à un outil et personne ne voit le cumul. Mesuré à 5 100 caractères après
    // la passe ; le seuil laisse de la place sans laisser revenir le double.
    const total = outils.reduce((n, o) => n + o.description.length, 0);
    expect(total, `descriptions : ${total} caractères`).toBeLessThan(6_000);
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
