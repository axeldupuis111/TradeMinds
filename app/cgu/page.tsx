import Link from "next/link";

export default function CGUPage() {
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
          Conditions générales d&apos;utilisation
        </h1>
        <p className="text-[#71717a] text-sm mb-10">Dernière mise à jour : avril 2026</p>

        <div className="text-sm text-[#fafafa]/70 leading-relaxed">
          <p>Conditions générales d&apos;utilisation — document en cours de rédaction.</p>
        </div>

        <div className="mt-12 pt-8 border-t border-[#1c1c1e] flex gap-4">
          <Link href="/confidentialite" className="text-sm text-[#3b82f6] hover:underline">Confidentialité</Link>
          <Link href="/mentions-legales" className="text-sm text-[#3b82f6] hover:underline">Mentions légales</Link>
          <Link href="/" className="text-sm text-[#71717a] hover:text-[#fafafa]">&larr; TradeMinds</Link>
        </div>
      </div>
    </div>
  );
}
