"use client";

import PublicHeader from "@/components/PublicHeader";
import { useLanguage } from "@/lib/LanguageContext";
import { localizedHref } from "@/lib/locale-href";
import Link from "next/link";

export default function MentionsLegalesPage() {
  const { lang } = useLanguage();

  return (
    <>
      <PublicHeader />
      <div className="min-h-screen bg-[#09090b] px-6 py-16 pt-24 force-dark">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-[#fafafa] mb-2" style={{ fontStyle: "normal" }}>
            Mentions légales
          </h1>
          <p className="text-[#71717a] text-sm mb-10">Dernière mise à jour : avril 2026</p>

          <div className="space-y-8 text-sm text-[#fafafa]/80 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Éditeur du site</h2>
              <p>TradeDiscipline est édité par une entreprise individuelle.</p>
              <p className="mt-2">Contact : <a href="mailto:contact@TradeDiscipline.app" className="text-accent hover:underline">contact@TradeDiscipline.app</a></p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Hébergement</h2>
              <p>Le site est hébergé sur des serveurs sécurisés via Vercel et Supabase.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Propriété intellectuelle</h2>
              <p>
                L&apos;ensemble du contenu de ce site (code, design, textes, marque) est la propriété exclusive de
                TradeDiscipline et est protégé par les lois relatives à la propriété intellectuelle. Toute reproduction
                ou distribution sans autorisation écrite est interdite.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Données personnelles</h2>
              <p>
                Le traitement de vos données personnelles est régi par notre{" "}
                <Link href="/legal/privacy" className="text-accent hover:underline">
                  Politique de confidentialité
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Limitation de responsabilité</h2>
              <p>
                TradeDiscipline est un outil d&apos;analyse et de journal de trading. Il ne constitue pas un conseil financier
                ou en investissement. Toute décision de trading reste sous votre entière responsabilité.
                Le trading implique un risque significatif de perte en capital.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Contact</h2>
              <p>
                Pour toute question relative aux présentes mentions légales :{" "}
                <a href="mailto:contact@TradeDiscipline.app" className="text-accent hover:underline">
                  contact@TradeDiscipline.app
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex gap-4">
            <Link href="/legal/terms" className="text-sm text-accent hover:underline">CGU</Link>
            <Link href="/legal/privacy" className="text-sm text-accent hover:underline">Confidentialité</Link>
            <Link href={localizedHref("/", lang)} className="text-sm text-[#71717a] hover:text-[#fafafa]">&larr; TradeDiscipline</Link>
          </div>
        </div>
      </div>
    </>
  );
}
