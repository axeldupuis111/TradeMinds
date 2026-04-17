"use client";

import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/LanguageContext";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ── Scroll animation hook ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`reveal-on-scroll ${className}`}>
      {children}
    </div>
  );
}

/* ── Nav ── */
function Nav() {
  const { t } = useLanguage();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <span className="text-lg font-bold text-foreground tracking-tight">TradeMinds</span>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link href="/login" className="text-sm text-muted hover:text-foreground">{t("nav_login")}</Link>
          <Link href="/login" className="text-sm px-4 py-1.5 bg-accent text-white rounded-lg font-medium hover:bg-blue-600 glow-blue btn-scale">
            {t("nav_start")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ── Dashboard Preview ── */
function DashboardPreview() {
  const { t } = useLanguage();
  return (
    <div className="mt-16 max-w-4xl mx-auto px-4">
      <div
        className="relative rounded-2xl border border-white/[0.08] bg-[#111111] p-6 sm:p-8 shadow-2xl shadow-black/60"
        style={{ transform: "perspective(1200px) rotateX(4deg)", transformOrigin: "center bottom" }}
      >
        <div className="absolute -inset-1 bg-gradient-to-b from-accent/10 to-transparent rounded-2xl blur-xl -z-10" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center bg-white/[0.03] rounded-xl p-4 border border-white/5">
            <svg width="80" height="80" viewBox="0 0 80 80" className="mb-2">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#1e1e1e" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${0.72 * 2 * Math.PI * 34} ${2 * Math.PI * 34}`} transform="rotate(-90 40 40)" />
              <text x="40" y="38" textAnchor="middle" fill="#fafafa" fontSize="18" fontWeight="bold">72</text>
              <text x="40" y="52" textAnchor="middle" fill="#71717a" fontSize="9">{t("preview_discipline")}</text>
            </svg>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-white/[0.03] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-muted uppercase tracking-wider mb-2">{t("preview_equity")}</p>
            <svg viewBox="0 0 120 50" className="w-full h-12" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,40 L15,35 L30,38 L45,28 L55,30 L65,22 L80,18 L95,20 L105,12 L120,8" fill="none" stroke="#22c55e" strokeWidth="2" />
              <path d="M0,40 L15,35 L30,38 L45,28 L55,30 L65,22 L80,18 L95,20 L105,12 L120,8 L120,50 L0,50Z" fill="url(#eqGrad)" />
            </svg>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_winrate")}</p>
            <p className="text-xl font-bold text-foreground mt-1">58%</p>
            <p className="text-[10px] text-muted uppercase tracking-wider mt-3">{t("preview_trades")}</p>
            <p className="text-xl font-bold text-foreground mt-1">23</p>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
            <p className="text-[10px] text-muted uppercase tracking-wider">{t("preview_pnl_total")}</p>
            <p className="text-xl font-bold text-profit mt-1">+1 240 €</p>
            <p className="text-[10px] text-muted uppercase tracking-wider mt-3">{t("preview_challenge")}</p>
            <div className="mt-1.5 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full w-[68%] bg-accent rounded-full" />
            </div>
            <p className="text-[10px] text-muted mt-1">68%</p>
          </div>
        </div>
        <div className="mt-5 border-t border-white/5 pt-4 space-y-2">
          {[
            { pair: "EUR/USD", dir: "BUY", pnl: "+82.50", win: true },
            { pair: "GBP/JPY", dir: "SELL", pnl: "-34.20", win: false },
            { pair: "XAU/USD", dir: "BUY", pnl: "+156.00", win: true },
          ].map((tr) => (
            <div key={tr.pair} className="flex items-center gap-3 text-xs py-1.5">
              <span className="text-foreground font-medium w-16">{tr.pair}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tr.dir === "BUY" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>{tr.dir}</span>
              <span className="flex-1" />
              <span className={`font-medium ${tr.win ? "text-profit" : "text-loss"}`}>{tr.pnl} €</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hero ── */
function Hero() {
  const { t } = useLanguage();
  return (
    <section className="hero-gradient pt-32 pb-24 px-6">
      <RevealSection>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
            {t("hero_title_1")}{" "}
            <span className="text-accent">{t("hero_title_2")}</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            {t("hero_subtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3 bg-accent text-white rounded-xl font-semibold text-lg hover:bg-blue-600 glow-blue btn-scale">
              {t("hero_cta")}
            </Link>
            <a href="#features" className="px-8 py-3 bg-white/5 border border-white/10 text-foreground rounded-xl font-semibold text-lg hover:bg-white/10 btn-scale">
              {t("hero_features")}
            </a>
          </div>
        </div>
        <DashboardPreview />
      </RevealSection>
    </section>
  );
}

/* ── Problem ── */
function Problem() {
  const { t } = useLanguage();
  const problems = [
    {
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      title: t("problem_1_title"), desc: t("problem_1_desc"),
    },
    {
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      title: t("problem_2_title"), desc: t("problem_2_desc"),
    },
    {
      icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" /></svg>,
      title: t("problem_3_title"), desc: t("problem_3_desc"),
    },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center leading-tight">
          {t("problem_title")}<br />
          <span className="text-muted">{t("problem_subtitle")}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {problems.map((p) => (
            <div key={p.title} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all">
              <div className="text-loss mb-4">{p.icon}</div>
              <h3 className="text-lg font-semibold text-foreground">{p.title}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ── Social Proof / Testimonials ── */
function SocialProof() {
  const { t } = useLanguage();
  const testimonials = [
    { text: t("testimonial_1_text"), author: t("testimonial_1_author") },
    { text: t("testimonial_2_text"), author: t("testimonial_2_author") },
    { text: t("testimonial_3_text"), author: t("testimonial_3_author") },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-5xl mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t("social_title")}</h2>
          <p className="text-muted mt-3 text-sm">{t("social_stats")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {testimonials.map((tm, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col hover:border-white/10 transition-all">
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-foreground text-sm leading-relaxed flex-1">&ldquo;{tm.text}&rdquo;</p>
              <p className="text-muted text-xs mt-4 font-medium">{tm.author}</p>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ── Features ── */
function Features() {
  const { t } = useLanguage();
  const features = [
    {
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
      title: t("feature_1_title"), desc: t("feature_1_desc"),
    },
    {
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      title: t("feature_2_title"), desc: t("feature_2_desc"),
    },
    {
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      title: t("feature_3_title"), desc: t("feature_3_desc"),
    },
    {
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      title: t("feature_4_title"), desc: t("feature_4_desc"),
    },
  ];
  return (
    <section id="features" className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("features_title")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-16">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-accent/20 hover:bg-white/[0.04] transition-all">
              <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-accent/10 text-accent">{f.icon}</div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                <p className="text-muted mt-1 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ── AI Detection ── */
function AIDetection() {
  const { t } = useLanguage();
  const detections = [t("ai_detect_1"), t("ai_detect_2"), t("ai_detect_3"), t("ai_detect_4")];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t("ai_detect_title")}</h2>
            <p className="text-muted mt-4 leading-relaxed">{t("hero_subtitle")}</p>
            <Link href="/login" className="mt-8 inline-block px-6 py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-blue-600 glow-blue btn-scale">
              {t("hero_cta")}
            </Link>
          </div>
          <div className="space-y-3">
            {detections.map((d, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-accent/20 transition-all">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p className="text-foreground text-sm leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>
    </section>
  );
}

/* ── How It Works ── */
function HowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { num: "1", title: t("how_1_title"), desc: t("how_1_desc") },
    { num: "2", title: t("how_2_title"), desc: t("how_2_desc") },
    { num: "3", title: t("how_3_title"), desc: t("how_3_desc") },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("how_title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {steps.map((s, i) => (
            <div key={s.num} className="text-center relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-7 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
              <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-2xl bg-accent/10 text-accent text-2xl font-bold relative z-10">{s.num}</div>
              <h3 className="text-lg font-semibold text-foreground mt-4">{s.title}</h3>
              <p className="text-muted mt-2 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ── Pricing ── */
function Pricing() {
  const { t } = useLanguage();
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: t("plan_free"),
      sub: t("plan_sub_free"),
      monthlyPrice: "0€",
      annualPrice: "0€",
      annualMonthly: "",
      feats: [t("plan_benefit_free_1"), t("plan_benefit_free_2"), t("plan_benefit_free_3"), t("plan_benefit_free_4")],
      btnKey: "pricing_start_free",
      border: "border-white/[0.06]",
      btnClass: "bg-[#1a1a1a] border border-white/[0.06] text-foreground hover:bg-white/[0.06]",
    },
    {
      name: t("plan_plus"),
      sub: t("plan_sub_plus"),
      monthlyPrice: "9.99€",
      annualPrice: "89.99€",
      annualMonthly: "7.50€",
      feats: [t("plan_benefit_plus_1"), t("plan_benefit_plus_2"), t("plan_benefit_plus_3"), t("plan_benefit_plus_4"), t("plan_benefit_plus_5"), t("plan_benefit_plus_6")],
      btnKey: "pricing_choose_plus",
      border: "border-accent/30",
      btnClass: "bg-accent text-white hover:bg-blue-600 glow-blue",
      highlight: true,
    },
    {
      name: t("plan_premium"),
      sub: t("plan_sub_premium"),
      monthlyPrice: "19.99€",
      annualPrice: "179.99€",
      annualMonthly: "15€",
      feats: [t("plan_benefit_premium_1"), t("plan_benefit_premium_2"), t("plan_benefit_premium_3"), t("plan_benefit_premium_4")],
      btnKey: "pricing_choose_premium",
      border: "border-yellow-500/30",
      btnClass: "bg-yellow-500 text-black hover:bg-yellow-400",
    },
  ];

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center">{t("pricing_title")}</h2>

        {/* Toggle monthly/annual */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted"}`}>{t("plan_monthly")}</span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-14 h-7 rounded-full bg-white/[0.06] border border-white/[0.1] transition-colors"
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-300 ${annual ? "left-[30px] bg-accent" : "left-0.5 bg-[#555]"}`} />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted"}`}>{t("plan_annual")}</span>
          {annual && (
            <span className="px-2 py-0.5 bg-profit/10 text-profit text-xs font-bold rounded-full">-25%</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10">
          {plans.map((p) => {
            const price = annual ? p.annualPrice : p.monthlyPrice;
            const period = annual ? `/${t("plan_year")}` : `/${t("plan_month")}`;
            const showSavings = annual && p.annualMonthly;
            return (
              <div key={p.name} className={`relative bg-white/[0.02] border ${p.border} rounded-2xl p-8 flex flex-col ${p.highlight ? "shadow-lg shadow-accent/10" : ""}`}>
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    {t("plan_popular")}
                  </span>
                )}
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">{p.name}</div>
                <p className="text-muted text-xs mt-1">{p.sub}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground transition-all duration-300">{price}</span>
                  <span className="text-muted text-sm">{period}</span>
                </div>
                {showSavings ? (
                  <p className="text-profit text-xs mt-1">{t("plan_equiv")} {p.annualMonthly}/{t("plan_month")}</p>
                ) : (
                  <p className="text-xs mt-1 text-transparent select-none">.</p>
                )}
                <ul className="mt-8 space-y-3 flex-1">
                  {p.feats.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <svg className="w-4 h-4 text-profit shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/login" className={`mt-8 block w-full py-3 rounded-xl font-semibold text-center transition-colors btn-scale ${p.btnClass}`}>
                  {t(p.btnKey)}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-muted text-sm mt-6">{t("pricing_no_commitment")}</p>
      </RevealSection>
    </section>
  );
}

/* ── FAQ ── */
function FAQ() {
  const { t } = useLanguage();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqs = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
    { q: t("faq_q4"), a: t("faq_a4") },
    { q: t("faq_q5"), a: t("faq_a5") },
    { q: t("faq_q6"), a: t("faq_a6") },
  ];
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">{t("faq_title")}</h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-white/[0.06] rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-foreground font-medium text-sm pr-4">{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-muted shrink-0 transition-transform duration-200 ${openIdx === i ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIdx === i && (
                <div className="px-6 pb-5">
                  <p className="text-muted text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}

/* ── Final CTA ── */
function FinalCTA() {
  const { t } = useLanguage();
  return (
    <section className="py-24 px-6 border-t border-white/5">
      <RevealSection className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t("cta_title")}</h2>
        <p className="text-muted mt-4 text-lg">{t("cta_subtitle")}</p>
        <Link href="/login" className="mt-8 inline-block px-8 py-3 bg-accent text-white rounded-xl font-semibold text-lg hover:bg-blue-600 glow-blue btn-scale">
          {t("cta_button")}
        </Link>
        <p className="text-muted text-sm mt-4">{t("pricing_no_commitment")}</p>
      </RevealSection>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/5 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm text-muted">TradeMinds © 2026</span>
        <div className="flex gap-6">
          <a href="#" className="text-sm text-muted hover:text-foreground">{t("footer_legal")}</a>
          <a href="#" className="text-sm text-muted hover:text-foreground">{t("footer_contact")}</a>
        </div>
      </div>
    </footer>
  );
}

/* ── Page ── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Problem />
      <SocialProof />
      <Features />
      <AIDetection />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
