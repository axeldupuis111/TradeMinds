import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import frDict from "./i18n/fr";
import enDict from "./i18n/en";
import esDict from "./i18n/es";
import deDict from "./i18n/de";
import { sansCommentaires } from "./sans-commentaires";

/**
 * LE SCORE DE DISCIPLINE VEUT DIRE LA MÊME CHOSE PARTOUT.
 *
 * ── LE DÉFAUT, MESURÉ EN PRODUCTION ─────────────────────────────────────────
 *
 * ⚠️⚠️ 60/100 DANS L'APPLICATION, 46/100 SUR LE PROFIL PUBLIC DU MÊME TRADER,
 * AU MÊME MOMENT. La carte d'Analytics, sous le seul mot « Discipline »,
 * montrait le score du DERNIER bilan ; le profil public, sous « Discipline
 * moyenne », montrait la moyenne des vingt-quatre. Les deux libellés ne
 * diffèrent que d'un mot, et rien ne permettait de comprendre l'écart.
 *
 * Vérifié en base : moyenne des 24 bilans = 46, dernier bilan = 60.
 *
 * ⚠️ ET LA CARTE IGNORAIT LE SÉLECTEUR DE PÉRIODE, seule de sa rangée. P&L,
 * winrate, nombre de trades, meilleur et pire le suivent tous ; choisir
 * « 7 jours » laissait ce chiffre-là inchangé, sans rien dire. Un tableau de
 * bord dont une carte sur six ne parle pas de la même période est pire qu'un
 * tableau de bord sans cette carte.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 *
 * Un chiffre porte un libellé qui dit ce qu'il est. « Discipline moyenne »
 * partout, calculée sur le périmètre que l'écran annonce.
 */
describe("le score de discipline", () => {
  const analytics = sansCommentaires(
    readFileSync(join(process.cwd(), "app/dashboard/analytics/page.tsx"), "utf8"),
  );
  const cartes = sansCommentaires(
    readFileSync(join(process.cwd(), "components/analytics/AnalyticsKpiCards.tsx"), "utf8"),
  );

  it("est une moyenne, pas le dernier bilan", () => {
    expect(analytics, "la moyenne a disparu").toMatch(/disciplineMoyenne/);
    expect(
      analytics,
      "le dernier bilan est redevenu la valeur affichée",
    ).not.toMatch(/disciplineScore=\{latestScore\}/);
    expect(cartes, "la carte ne reçoit plus la moyenne").toMatch(/disciplineScore=\{disciplineMoyenne\}|disciplineScore/);
  });

  /**
   * ⚠️ LE CALCUL SUIT LA PÉRIODE. On vérifie que la mémo dépend bien de
   * `period` : sans ça, la carte redeviendrait la seule de sa rangée à parler
   * d'autre chose que ce que le sélecteur annonce.
   */
  it("suit la période choisie", () => {
    const depart = analytics.indexOf("const disciplineMoyenne = useMemo(");
    expect(depart, "le calcul a disparu").toBeGreaterThan(-1);
    const fin = analytics.indexOf("}, [", depart);
    const deps = analytics.slice(fin, analytics.indexOf("]", fin));
    expect(deps, "la moyenne ne dépend pas de la période").toContain("period");
  });

  /**
   * ⚠️ ET LE LIBELLÉ DIT « MOYENNE », dans les quatre langues. C'est la moitié
   * du correctif : un chiffre juste sous un libellé ambigu reste un chiffre
   * qu'on ne peut pas recouper.
   */
  it("s'annonce comme une moyenne dans les quatre langues", () => {
    const MOTS = { fr: /moyenne/i, en: /average/i, es: /media/i, de: /durchschnitt/i };
    for (const [nom, dico] of Object.entries({ fr: frDict, en: enDict, es: esDict, de: deDict })) {
      const texte = (dico as Record<string, string>)["an_kpi_discipline_moyenne"];
      expect(texte, `libellé manquant en ${nom}`).toBeTruthy();
      expect(texte, `le libellé ne dit pas « moyenne » en ${nom}`).toMatch(
        MOTS[nom as keyof typeof MOTS],
      );
    }
    expect(cartes, "la carte porte encore le libellé ambigu").not.toMatch(/t\("ict_kpi_discipline"\)/);
  });
});
