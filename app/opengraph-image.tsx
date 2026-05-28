import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "TradeDiscipline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT_COLOR = "#00D4D8";

export default async function Image() {
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
          Stop repeating the same mistakes.
        </div>
        <div
          style={{
            fontSize: 44,
            color: ACCENT_COLOR,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Trade with discipline.
        </div>
      </div>
    ),
    { ...size }
  );
}
