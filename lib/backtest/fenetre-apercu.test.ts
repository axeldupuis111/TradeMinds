import { describe, expect, it } from "vitest";
import { FENETRE, fenetreApercu } from "./apercu";

/**
 * LA FENÊTRE D'APERÇU CONTIENT-ELLE TOUJOURS LE TRADE ?
 *
 * ⚠️ NÉ D'UNE CAPTURE D'ÉCRAN. Sur un trade gagnant de +2R, le trait d'entrée
 * flottait SOUS toutes les bougies visibles : la fenêtre ne contenait pas le
 * moment où la position s'était ouverte. En cause, une borne de largeur qui
 * rognait à gauche depuis la SORTIE. Dès qu'un trade durait plus de cent
 * quarante bougies, le rognage passait devant l'entrée.
 *
 * L'aperçu n'a qu'une raison d'être : que le trader dise « oui, c'est ma
 * méthode » ou « non ». Un aperçu qui montre la fin d'un trade sans son début
 * ne permet ni l'un ni l'autre.
 */

describe("les bornes de la fenêtre d'aperçu", () => {
  it("montre du contexte avant le signal et après la sortie", () => {
    const { debut, fin } = fenetreApercu(500, 520, 500, 2000);
    expect(debut).toBe(500 - FENETRE.avant);
    expect(fin).toBe(520 + FENETRE.apres);
  });

  it("remonte jusqu'à l'ancrage d'une droite plus ancienne", () => {
    // Une trendline dont on ne voit ni le départ ni les touches ne se vérifie
    // pas : la fenêtre remonte donc jusqu'à son premier ancrage.
    // L'ancrage doit être PLUS ANCIEN que le contexte par défaut, sinon celui-ci
    // le couvre déjà et c'est lui qui commande.
    const { debut } = fenetreApercu(500, 520, 420, 2000);
    expect(debut).toBe(420 - FENETRE.margeAncre);
    expect(fenetreApercu(500, 520, 470, 2000).debut).toBe(500 - FENETRE.avant);
  });

  it("borne la largeur quand l'ancrage est très ancien", () => {
    // Sans borne, la fenêtre atteint des centaines de bougies et chacune
    // devient un cheveu : un graphique illisible remplacé par un autre.
    const { debut, fin } = fenetreApercu(500, 520, 50, 2000);
    expect(fin - debut).toBe(FENETRE.max);
  });

  it("GARDE LE SIGNAL VISIBLE même quand le trade est très long", () => {
    // ⚠️ LE TEST QUI ÉPINGLE LE DÉFAUT VU À L'ÉCRAN. Un trade de six cents
    // bougies : la borne de largeur voudrait couper à `fin - 140`, c'est-à-dire
    // quatre cent soixante bougies APRÈS l'entrée. On préfère une fenêtre plus
    // large, avec des bougies plus fines, à un trade amputé de son début.
    const iSignal = 500;
    const iSortie = 1100;
    const { debut, fin } = fenetreApercu(iSignal, iSortie, iSignal, 2000);

    expect(debut).toBeLessThanOrEqual(iSignal);
    expect(fin).toBeGreaterThanOrEqual(iSortie);
    // Et la fenêtre a bien dû s'élargir au-delà de la borne pour y arriver.
    expect(fin - debut).toBeGreaterThan(FENETRE.max);
  });

  it("ne sort jamais de la série", () => {
    const court = fenetreApercu(2, 5, 0, 20);
    expect(court.debut).toBe(0);
    expect(court.fin).toBe(19);
  });
});
