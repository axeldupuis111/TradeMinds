"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { EXIGENCES_DE_MOT_DE_PASSE, isPasswordValid } from "@/lib/exigences-de-mot-de-passe";

interface PasswordRequirementsProps {
  password: string;
}

interface Requirement {
  key: string;
  label: string;
  test: (pwd: string) => boolean;
}

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const { t } = useLanguage();

  const requirements: Requirement[] = EXIGENCES_DE_MOT_DE_PASSE.map((e) => ({ key: e.key, label: t(e.cle), test: e.test }));

  return (
    <div className="mt-2 space-y-1.5">
      {requirements.map((req) => {
        const passed = req.test(password);
        return (
          <div key={req.key} className="flex items-center gap-2 text-xs">
            <span className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${passed ? "bg-profit/20" : "bg-surface"}`}>
              {passed ? (
                <svg className="w-2.5 h-2.5 text-profit" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="w-1 h-1 rounded-full bg-muted" />
              )}
            </span>
            <span className={passed ? "text-profit" : "text-muted"}>{req.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * ⚠️ LA RÈGLE VIT DANS `lib/exigences-de-mot-de-passe.ts`, et elle est
 * réexportée ici pour les deux écrans qui l'importaient déjà. La liste affichée
 * et la liste appliquée étaient deux listes, à vingt lignes d'écart.
 */
export { isPasswordValid };
