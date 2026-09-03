/**
 * CE QUE LE TRADER RÉPOND LUI-MÊME, RANGÉ DANS SA FICHE.
 *
 * ── POURQUOI DANS `raw_text` ET PAS DANS UNE TABLE ──────────────────────────
 *
 * Ses réponses aux treize questions SONT sa stratégie : « je ne trade pas la
 * demi-heure qui suit une annonce » a exactement le même statut que « je risque
 * 1 % par trade », qui est déjà dans sa fiche. Les ranger ailleurs créerait une
 * deuxième fiche, que le coach ne lirait pas et que le trader ne relirait
 * jamais.
 *
 * ⚠️ MÊME DISCIPLINE QUE LE BLOC DE BACKTEST, POUR LES MÊMES RAISONS :
 *
 * 1. **UN BLOC DÉLIMITÉ, REMPLACÉ ET JAMAIS EMPILÉ.**
 * 2. **DES BORNES INDÉPENDANTES DE LA LANGUE**, sinon changer l'interface de
 *    langue entre deux enregistrements laisse deux blocs dont l'ancien devient
 *    introuvable.
 *
 * ⚠️⚠️ ET LE BLOC EST RETIRÉ AVANT LA COMPILATION. C'est la leçon la plus chère
 * de ce chantier : l'outil écrivait sa propre sortie dans la fiche, puis la
 * relisait comme si le trader l'avait écrite, et listait « Largeur du pivot :
 * 10 → 5 » parmi ses règles de méthode. Même ici, où le texte vient pourtant de
 * lui, la mise en forme est la nôtre : on ne la redonne pas à lire au
 * compilateur comme si c'était sa prose.
 */

const OUVERTURE = "[TRADEDISCIPLINE:PLAN]";
const FERMETURE = "[/TRADEDISCIPLINE:PLAN]";

/** Préfixe de la ligne qui porte la méthode déclarée. Indépendant de la langue. */
const CLE_METHODE = "methode";

export interface BlocPlan {
  /** Titre déjà traduit, avec sa date. */
  titre: string;
  /** Le code de la méthode de référence déclarée, quand il y en a une. */
  methode?: string;
  /** Les réponses, par code de question. Les vides ne sont pas écrites. */
  reponses: Record<string, string>;
  /** L'intitulé traduit de chaque question, pour que la fiche se relise. */
  intitules: Record<string, string>;
}

/**
 * Une valeur écrite sur une ligne, débarrassée de ce qui casserait la relecture.
 *
 * ⚠️ LES RETOURS À LA LIGNE SONT LE SEUL VRAI DANGER. Une réponse sur deux
 * lignes ferait passer la seconde pour une nouvelle clé, et la relecture
 * rendrait des paires absurdes. On les remplace, on ne les refuse pas : refuser
 * une réponse parce qu'elle est bien rédigée serait absurde.
 */
function surUneLigne(v: string): string {
  return v.replace(/\r?\n/g, " ").trim();
}

export function composerBlocPlan(b: BlocPlan): string {
  const lignes: string[] = [b.titre, ""];
  if (b.methode) lignes.push(`- ${CLE_METHODE}: ${b.methode}`);
  for (const [code, valeur] of Object.entries(b.reponses)) {
    const propre = surUneLigne(valeur);
    if (propre.length === 0) continue;
    const intitule = b.intitules[code] ?? code;
    lignes.push(`- ${code}: ${intitule} : ${propre}`);
  }
  return [OUVERTURE, ...lignes, FERMETURE].join("\n");
}

/**
 * Relit le bloc, s'il existe.
 *
 * ⚠️ ON RELIT LE CODE, PAS L'INTITULÉ. L'intitulé est traduit et changera ; le
 * code ne bouge pas. Un trader qui passe son interface en anglais doit retrouver
 * ses réponses.
 */
export function lireBlocPlan(rawText: string): { methode?: string; reponses: Record<string, string> } {
  const base = rawText ?? "";
  const debut = base.indexOf(OUVERTURE);
  if (debut === -1) return { reponses: {} };
  const fin = base.indexOf(FERMETURE, debut);
  const corps = base.slice(debut + OUVERTURE.length, fin === -1 ? undefined : fin);

  const reponses: Record<string, string> = {};
  let methode: string | undefined;

  for (const ligne of corps.split("\n")) {
    const t = ligne.trim();
    if (!t.startsWith("- ")) continue;
    const sansTiret = t.slice(2);
    const sep = sansTiret.indexOf(":");
    if (sep === -1) continue;
    const code = sansTiret.slice(0, sep).trim();
    const reste = sansTiret.slice(sep + 1).trim();
    if (code === CLE_METHODE) {
      methode = reste;
      continue;
    }
    // L'intitulé traduit précède la réponse, séparé par « : ». Il peut manquer
    // sur un bloc écrit par une version plus ancienne : on garde alors tout.
    const sepIntitule = reste.indexOf(" : ");
    reponses[code] = sepIntitule === -1 ? reste : reste.slice(sepIntitule + 3).trim();
  }

  return { methode, reponses };
}

/**
 * Insère ou remplace le bloc dans la fiche, sans toucher au reste.
 *
 * ⚠️ LE TEXTE DU TRADER PASSE AVANT : le bloc se met à la fin.
 */
export function ecrireLePlanDansLaFiche(rawText: string, bloc: string): string {
  const base = rawText ?? "";
  const debut = base.indexOf(OUVERTURE);
  if (debut !== -1) {
    const fin = base.indexOf(FERMETURE, debut);
    // Une ouverture sans fermeture veut dire que quelqu'un a édité le bloc à la
    // main : on ajoute à la suite plutôt que d'avaler la fin de sa fiche.
    if (fin !== -1) {
      const avant = base.slice(0, debut).replace(/\s+$/, "");
      const apres = base.slice(fin + FERMETURE.length).replace(/^\s+/, "");
      return [avant, bloc, apres].filter((p) => p.length > 0).join("\n\n");
    }
  }
  const propre = base.replace(/\s+$/, "");
  return propre.length > 0 ? `${propre}\n\n${bloc}` : bloc;
}

/** La fiche débarrassée du bloc de plan. Voir l'avertissement en tête. */
export function sansLeBlocDePlan(rawText: string): string {
  const base = rawText ?? "";
  const debut = base.indexOf(OUVERTURE);
  if (debut === -1) return base;
  const fin = base.indexOf(FERMETURE, debut);
  const apres = fin === -1 ? "" : base.slice(fin + FERMETURE.length);
  return (base.slice(0, debut) + apres).trim();
}
