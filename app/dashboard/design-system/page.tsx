"use client";

/**
 * PAGE DE DÉMONSTRATION — Design System Phase 2
 * Affiche tous les composants UI dans tous leurs variants/sizes.
 * Temporaire — sera supprimée en fin de Phase 3.
 * Accessible à : /dashboard/_design-system
 */

import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Download,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

// ─── Mini score ring (autonome, MiniScoreCircle n'est pas exporté) ────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle
        cx="18" cy="18" r={radius}
        fill="none"
        stroke="rgb(var(--border))"
        strokeWidth="3"
      />
      <circle
        cx="18" cy="18" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="text-[11px] font-bold text-foreground-muted uppercase tracking-[0.12em] mb-6 pb-2 border-b border-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-[10px] font-semibold text-foreground-subtle uppercase tracking-widest mb-3">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  // Internal dev-only showcase — never reachable in production.
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen bg-background px-8 py-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-accent" strokeWidth={1.75} />
          <span className="text-xs font-semibold text-accent uppercase tracking-widest">
            Design System
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Composants canoniques
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          TradeDiscipline · Phase 2 · Page temporaire — supprimée en fin de Phase 3.
          Tester en dark et en light via le toggle dans les settings.
        </p>
      </div>

      {/* ── BUTTON ──────────────────────────────────────────────────────────── */}
      <Section title="Button">
        <Row label="Variants (size md)">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>

        <Row label="Sizes — variant primary">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>

        <Row label="Icon gauche">
          <Button size="sm" icon={Plus}>Nouveau trade</Button>
          <Button size="md" icon={Download} variant="secondary">Exporter</Button>
          <Button size="lg" icon={Activity}>Ouvrir session</Button>
        </Row>

        <Row label="Icon droite">
          <Button variant="secondary" iconRight={ArrowRight}>Voir plus</Button>
          <Button variant="ghost" size="sm" iconRight={BarChart3}>Analytics</Button>
        </Row>

        <Row label="Loading (disabled automatiquement)">
          <Button loading>Primary loading</Button>
          <Button variant="secondary" loading>Secondary loading</Button>
          <Button variant="danger" loading>Danger loading</Button>
        </Row>

        <Row label="Disabled">
          <Button disabled>Primary disabled</Button>
          <Button variant="secondary" disabled>Secondary disabled</Button>
          <Button variant="ghost" disabled>Ghost disabled</Button>
        </Row>
      </Section>

      {/* ── BADGE ───────────────────────────────────────────────────────────── */}
      <Section title="Badge">
        <Row label="Variants — size sm (défaut)">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="success">Profit</Badge>
          <Badge variant="danger">Perte</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="accent">Accent</Badge>
        </Row>

        <Row label="Variants — size md">
          <Badge variant="neutral" size="md">Neutral</Badge>
          <Badge variant="success" size="md">Win</Badge>
          <Badge variant="danger" size="md">Loss</Badge>
          <Badge variant="warning" size="md">Review</Badge>
          <Badge variant="accent" size="md">Live</Badge>
        </Row>

        <Row label="Usage contextuel">
          <Badge variant="success" size="md">+2.4%</Badge>
          <Badge variant="danger" size="md">-1.1%</Badge>
          <Badge variant="accent" size="sm">DEMO</Badge>
          <Badge variant="warning" size="sm">A revoir</Badge>
          <Badge variant="neutral" size="sm">GRATUIT</Badge>
          <Badge variant="accent" size="md">PLUS</Badge>
          <Badge variant="success" size="sm">WIN</Badge>
          <Badge variant="danger" size="sm">LOSS</Badge>
        </Row>
      </Section>

      {/* ── CARD ────────────────────────────────────────────────────────────── */}
      <Section title="Card">
        <Row label="Variants (survoler interactive)">
          <Card variant="default" padding="md" className="w-52">
            <CardHeader>
              <CardTitle>Default</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground-muted">
                Card de base — bg-card + border + rounded-xl.
              </p>
            </CardContent>
          </Card>

          <Card variant="interactive" padding="md" className="w-52">
            <CardHeader>
              <CardTitle>Interactive</CardTitle>
              <Badge variant="accent" size="sm">Hover</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground-muted">
                Border et fond changent au survol.
              </p>
            </CardContent>
          </Card>

          <Card variant="accent" padding="md" className="w-52">
            <CardHeader>
              <CardTitle>Accent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground-muted">
                Border accent/30 + bg accent/3 — pour mise en avant.
              </p>
            </CardContent>
          </Card>
        </Row>

        <Row label="Paddings">
          <Card padding="none" className="border-dashed w-36">
            <p className="text-[10px] text-foreground-subtle text-center py-4">none</p>
          </Card>
          <Card padding="sm" className="border-dashed w-36">
            <p className="text-[10px] text-foreground-subtle text-center">sm — p-4</p>
          </Card>
          <Card padding="md" className="border-dashed w-36">
            <p className="text-[10px] text-foreground-subtle text-center">md — p-5</p>
          </Card>
          <Card padding="lg" className="border-dashed w-36">
            <p className="text-[10px] text-foreground-subtle text-center">lg — p-6</p>
          </Card>
        </Row>
      </Section>

      {/* ── STAT ────────────────────────────────────────────────────────────── */}
      <Section title="Stat">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Card padding="md">
            <Stat
              label="Score discipline"
              value="87/100"
              sublabel="Bonne session"
              trend="up"
              icon={Target}
              visual={<ScoreRing score={87} color="rgb(var(--profit))" />}
            />
          </Card>

          <Card padding="md">
            <Stat
              label="P&L du jour"
              value="+342 €"
              sublabel="3 trades fermés"
              trend="up"
              icon={TrendingUp}
            />
          </Card>

          <Card padding="md">
            <Stat
              label="Drawdown"
              value="-1.8%"
              sublabel="Max tolere : 5%"
              trend="down"
              icon={TrendingDown}
            />
          </Card>

          <Card padding="md">
            <Stat
              label="Solde"
              value="10 342 €"
              sublabel="Compte principal"
              icon={Wallet}
            />
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card padding="md">
            <Stat
              label="Win Rate"
              value="68%"
              sublabel="Sur 47 trades ce mois"
              trend="neutral"
              visual={<ScoreRing score={68} color="rgb(var(--accent))" />}
            />
          </Card>

          <Card padding="md">
            <Stat
              label="Objectif mensuel"
              value="4 / 10"
              sublabel="Sessions completees"
              icon={BarChart3}
            />
          </Card>
        </div>
      </Section>

      {/* ── COMPOSITION ─────────────────────────────────────────────────────── */}
      <Section title="Composition (Card + CardHeader + Badge + Stat + Button)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">

          {/* Session summary card */}
          <Card variant="default" padding="lg">
            <CardHeader>
              <CardTitle>Resume de session</CardTitle>
              <Badge variant="success" size="md">+2.4%</Badge>
            </CardHeader>
            <CardContent>
              <Stat label="P&L net" value="+241 €" trend="up" sublabel="Commission incluse" />
              <div className="h-px bg-border" />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" icon={Trash2}>Supprimer</Button>
                <Button variant="primary" size="sm" iconRight={ArrowRight}>Detail</Button>
              </div>
            </CardContent>
          </Card>

          {/* Accent card with score */}
          <Card variant="accent" padding="lg">
            <CardHeader>
              <CardTitle>Discipline Score</CardTitle>
              <Badge variant="accent" size="sm">LIVE</Badge>
            </CardHeader>
            <CardContent>
              <Stat
                label="Score ICT"
                value="91/100"
                trend="up"
                sublabel="Excellent — continuez ainsi"
                icon={Activity}
                visual={<ScoreRing score={91} color="rgb(var(--profit))" />}
              />
              <div className="h-px bg-border" />
              <Button variant="secondary" size="sm" className="w-full justify-center">
                Voir analyse
              </Button>
            </CardContent>
          </Card>

        </div>
      </Section>

    </div>
  );
}
