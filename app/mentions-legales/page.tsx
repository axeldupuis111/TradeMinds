import Link from "next/link";

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] px-6 py-16 force-dark">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#71717a] hover:text-[#fafafa] mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          TradeMinds
        </Link>

        <h1 className="text-3xl font-bold text-[#fafafa] mb-2" style={{ fontStyle: "normal" }}>
          Mentions légales
        </h1>
        <p className="text-[#71717a] text-sm mb-10">Dernière mise à jour : avril 2026</p>

        <div className="space-y-8 text-sm text-[#fafafa]/80 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Éditeur du site</h2>
            <p>TradeMinds est édité par une entreprise individuelle.</p>
            <p className="mt-2">Contact : <a href="mailto:contact@trademinds.app" className="text-[#3b82f6] hover:underline">contact@trademinds.app</a></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Hébergement</h2>
            <p>Le site est hébergé sur des serveurs sécurisés via Vercel et Supabase.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (code, design, textes, marque) est la propriété exclusive de
              TradeMinds et est protégé par les lois relatives à la propriété intellectuelle. Toute reproduction
              ou distribution sans autorisation écrite est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Données personnelles</h2>
            <p>
              Le traitement de vos données personnelles est régi par notre{" "}
              <Link href="/legal/privacy" className="text-[#3b82f6] hover:underline">
                Politique de confidentialité
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Limitation de responsabilité</h2>
            <p>
              TradeMinds est un outil d&apos;analyse et de journal de trading. Il ne constitue pas un conseil financier
              ou en investissement. Toute décision de trading reste sous votre entière responsabilité.
              Le trading implique un risque significatif de perte en capital.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3" style={{ fontStyle: "normal" }}>Contact</h2>
            <p>
              Pour toute question relative aux présentes mentions légales :{" "}
              <a href="mailto:contact@trademinds.app" className="text-[#3b82f6] hover:underline">
                contact@trademinds.app
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1c1c1e] flex gap-4">
          <Link href="/legal/terms" className="text-sm text-[#3b82f6] hover:underline">CGU</Link>
          <Link href="/legal/privacy" className="text-sm text-[#3b82f6] hover:underline">Confidentialité</Link>
          <Link href="/" className="text-sm text-[#71717a] hover:text-[#fafafa]">&larr; TradeMinds</Link>
        </div>
      </div>
    </div>
  );
}
