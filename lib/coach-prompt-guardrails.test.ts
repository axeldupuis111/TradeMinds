import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const SOURCE = readFileSync(
  join(process.cwd(), "app", "api", "chat-coach", "route.ts"),
  "utf8",
);

/** Le gabarit du prompt système, du backtick ouvrant au backtick fermant. */
function promptSysteme(): string {
  const debut = SOURCE.indexOf("const systemPrompt = `");
  expect(debut, "le prompt système a été renommé").toBeGreaterThan(-1);
  const corps = SOURCE.slice(debut + "const systemPrompt = `".length);
  const fin = corps.indexOf("`;");
  expect(fin, "fin du gabarit introuvable").toBeGreaterThan(0);
  return corps.slice(0, fin);
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
