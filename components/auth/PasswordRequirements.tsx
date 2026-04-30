"use client";

import { useLanguage } from "@/lib/LanguageContext";

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

  const requirements: Requirement[] = [
    { key: "length", label: t("password_req_length"), test: (p) => p.length >= 8 },
    { key: "lowercase", label: t("password_req_lowercase"), test: (p) => /[a-z]/.test(p) },
    { key: "uppercase", label: t("password_req_uppercase"), test: (p) => /[A-Z]/.test(p) },
    { key: "digit", label: t("password_req_digit"), test: (p) => /[0-9]/.test(p) },
  ];

  return (
    <div className="mt-2 space-y-1.5">
      {requirements.map((req) => {
        const passed = req.test(password);
        return (
          <div key={req.key} className="flex items-center gap-2 text-xs">
            <span className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${passed ? "bg-profit/20" : "bg-[#1e1e1e]"}`}>
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

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
