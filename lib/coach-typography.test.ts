import { describe, expect, it } from "vitest";
import { createDashStripper, stripLongDashes } from "./coach-typography";

/**
 * Le filtre doit être invisible quand il n'y a rien à corriger, et donner
 * exactement le même résultat que le texte soit reçu d'un bloc ou fragment par
 * fragment. C'est cette seconde propriété qui est délicate : « mot — mot »
 * arrive souvent en trois morceaux dans le flux.
 */

describe("remplacement du tiret long", () => {
  it("remplace une incise par une virgule", () => {
    expect(stripLongDashes("le mental se traite — jamais en esquive")).toBe(
      "le mental se traite, jamais en esquive",
    );
  });

  it("traite le demi-cadratin de la même façon", () => {
    expect(stripLongDashes("ta méthode – est-ce défini ?")).toBe("ta méthode, est-ce défini ?");
  });

  it("lit une plage de valeurs comme une plage", () => {
    // « 50–60 % » n'est pas une incise : « 50, 60 % » serait faux.
    expect(stripLongDashes("retrace de 50–60 % du move")).toBe("retrace de 50 à 60 % du move");
  });

  it("garde une puce de liste comme puce", () => {
    expect(stripLongDashes("— premier point\n— second point")).toBe("- premier point\n- second point");
  });

  it("ne double pas la ponctuation existante", () => {
    // En milieu de ligne le tiret est une incise, pas une puce : le remplacer
    // par une virgule donnerait « : , » et « , , » sans ce nettoyage.
    expect(stripLongDashes("trois règles : — le stop, — le risque")).toBe(
      "trois règles : le stop, le risque",
    );
  });

  it("ne touche pas un texte qui n'en contient pas", () => {
    const propre = "BSL balayée puis rejetée : la lecture est vendeuse (jamais l'inverse).";
    expect(stripLongDashes(propre)).toBe(propre);
  });

  it("laisse le trait d'union tranquille", () => {
    expect(stripLongDashes("au-dessus, contre-tendance, risque/récompense")).toBe(
      "au-dessus, contre-tendance, risque/récompense",
    );
  });
});

describe("filtre incrémental sur le flux", () => {
  /** Rejoue un texte découpé en fragments, comme le fait le modèle. */
  function parFragments(fragments: string[]): string {
    const f = createDashStripper();
    return fragments.map((x) => f.push(x)).join("") + f.flush();
  }

  it("donne le même résultat que le traitement d'un bloc", () => {
    const entier = "ta méthode — est-ce défini ?";
    expect(parFragments(["ta méthode", " ", "—", " ", "est-ce défini ?"])).toBe(
      stripLongDashes(entier),
    );
  });

  it("gère le tiret seul dans son propre fragment", () => {
    // Le cas qui produisait « ,  » : l'espace de gauche était déjà parti.
    expect(parFragments(["mot ", "—", " suite"])).toBe("mot, suite");
  });

  it("gère le tiret collé à la fin d'un fragment", () => {
    expect(parFragments(["mot —", " suite"])).toBe("mot, suite");
  });

  it("gère le tiret collé au début du fragment suivant", () => {
    expect(parFragments(["mot ", "— suite"])).toBe("mot, suite");
  });

  it("n'avale pas l'espace final quand aucun tiret ne suit", () => {
    // Sans flush(), la retenue disparaîtrait silencieusement.
    expect(parFragments(["deux ", "mots"])).toBe("deux mots");
    expect(parFragments(["fin de phrase "])).toBe("fin de phrase ");
  });

  it("laisse passer un flux ordinaire caractère par caractère", () => {
    const texte = "BSL balayée puis rejetée : lecture vendeuse.";
    expect(parFragments(texte.split(""))).toBe(texte);
  });

  it("traite plusieurs tirets dans le même flux", () => {
    expect(parFragments(["a ", "—", " b et c ", "—", " d"])).toBe("a, b et c, d");
  });
});
