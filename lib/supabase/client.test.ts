import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LE CLIENT DU NAVIGATEUR NE REDEMANDE PAS DIX-NEUF FOIS QUI EST CONNECTÉ.
 *
 * ⚠️⚠️ MESURÉ SUR LA PAGE DÉPLOYÉE : dix-neuf appels à `/auth/v1/user` pour une
 * seule ouverture du tableau de bord, onze lectures de `trades`, six de
 * `profiles`. `getUser()` n'est pas une lecture locale : c'est un aller-retour
 * HTTPS pour faire valider le jeton, et le produit l'écrit quatre-vingt-seize
 * fois, presque toujours juste avant la vraie requête.
 *
 * ⚠️ CE TEST TIENT LES TROIS PROMESSES DU MODULE, séparément : un seul client
 * par onglet, une seule requête pour une rafale d'appels, et une sortie de
 * session qui vide la mémoire SANS attendre la fenêtre.
 */
describe("le client Supabase du navigateur", () => {
  const reponse = { data: { user: { id: "u1" } }, error: null };

  /** Fabrique un faux client et rend le module fraîchement importé. */
  async function charger() {
    const getUser = vi.fn(async () => reponse);
    const abonnes: (() => void)[] = [];
    const faux = {
      auth: {
        getUser,
        onAuthStateChange: (cb: () => void) => {
          abonnes.push(cb);
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
    const fabrique = vi.fn(() => faux);
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({ createBrowserClient: fabrique }));
    const mod = await import("./client");
    return { mod, getUser, fabrique, faux, declencher: () => abonnes.forEach((c) => c()) };
  }

  beforeEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "cle");
  });

  it("ne fabrique qu'un seul client, même appelé par vingt composants", async () => {
    const { mod, fabrique } = await charger();
    const clients = Array.from({ length: 20 }, () => mod.createClient());
    expect(fabrique).toHaveBeenCalledTimes(1);
    expect(new Set(clients).size).toBe(1);
  });

  it("une rafale d'appels simultanés ne fait qu'une requête", async () => {
    const { mod, getUser } = await charger();
    const c = mod.createClient();
    const toutes = await Promise.all(Array.from({ length: 19 }, () => c.auth.getUser()));
    expect(getUser).toHaveBeenCalledTimes(1);
    for (const r of toutes) expect(r.data.user?.id).toBe("u1");
  });

  it("un appel qui désigne son propre jeton n'est jamais mutualisé", async () => {
    const { mod, getUser } = await charger();
    const c = mod.createClient();
    await c.auth.getUser();
    await c.auth.getUser("jeton-a-verifier");
    await c.auth.getUser("jeton-a-verifier");
    // Un partagé + deux explicites : les explicites passent toujours.
    expect(getUser).toHaveBeenCalledTimes(3);
    expect(getUser).toHaveBeenCalledWith("jeton-a-verifier");
  });

  it("une sortie de session vide la mémoire sans attendre la fenêtre", async () => {
    const { mod, getUser, declencher } = await charger();
    const c = mod.createClient();
    await c.auth.getUser();
    expect(getUser).toHaveBeenCalledTimes(1);
    await c.auth.getUser();
    expect(getUser, "la fenêtre doit encore tenir").toHaveBeenCalledTimes(1);
    declencher();
    await c.auth.getUser();
    expect(getUser, "la sortie de session n'a pas vidé la mémoire").toHaveBeenCalledTimes(2);
  });
});
