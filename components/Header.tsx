"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-muted hover:text-foreground"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-foreground lg:hidden">TradeMinds</span>
      </div>

      <button
        onClick={handleSignOut}
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        Déconnexion
      </button>
    </header>
  );
}
