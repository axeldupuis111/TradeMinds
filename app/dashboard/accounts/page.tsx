"use client";

import { useLanguage } from "@/lib/LanguageContext";

export default function AccountsPage() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-foreground">{t("challenge_title")}</h1>
      <p className="text-muted">{t("accounts_coming_soon")}</p>
    </div>
  );
}
