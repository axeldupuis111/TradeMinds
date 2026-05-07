import { ImageResponse } from "next/og";
import { type Locale } from "@/i18n/config";

export const runtime = "edge";
export const alt = "TradeDiscipline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT_COLOR = "#3b82f6";

const titleByLocale: Record<Locale, string> = {
  en: "Stop repeating the same mistakes.",
  fr: "Arrête de répéter les mêmes erreurs.",
  de: "Hör auf, dieselben Fehler zu wiederholen.",
  es: "Deja de repetir los mismos errores.",
};

const subtitleByLocale: Record<Locale, string> = {
  en: "Trade with discipline.",
  fr: "Trade avec discipline.",
  de: "Handle mit Disziplin.",
  es: "Opera con disciplina.",
};

export default async function Image({ params }: { params: { locale: Locale } }) {
  const locale = params.locale;
  const title = titleByLocale[locale] ?? titleByLocale.en;
  const subtitle = subtitleByLocale[locale] ?? subtitleByLocale.en;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #09090b 0%, #1a1a1f 100%)",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 12,
              background: `${ACCENT_COLOR}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 20,
            }}
          >
            <svg
              width="36"
              height="36"
              fill="none"
              stroke={ACCENT_COLOR}
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
              />
            </svg>
          </div>
          <div style={{ fontSize: 36, color: "white", fontWeight: 700 }}>
            TradeDiscipline
          </div>
        </div>
        <div
          style={{
            fontSize: 68,
            color: "white",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 44,
            color: ACCENT_COLOR,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {subtitle}
        </div>
      </div>
    ),
    { ...size }
  );
}
