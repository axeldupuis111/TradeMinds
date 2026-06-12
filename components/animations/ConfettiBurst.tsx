"use client";

/**
 * ConfettiBurst — explosion de confettis en canvas, zéro dépendance.
 *
 * Monté = tiré une fois (~2s) puis appelle onDone. Overlay plein écran
 * pointer-events-none. Respecte prefers-reduced-motion (rien ne se joue,
 * onDone immédiat).
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";

const COLORS = ["#00e5d0", "#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f87171"];
const PARTICLES = 110;
const DURATION_MS = 2100;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  shape: "rect" | "circle";
}

export default function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) {
      onDone?.();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Deux canons : bas-gauche et bas-droite, tir vers le centre-haut
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLES; i++) {
      const fromLeft = i % 2 === 0;
      const angle = fromLeft
        ? -Math.PI / 2 + (Math.random() - 0.2) * 0.9
        : -Math.PI / 2 - (Math.random() - 0.2) * 0.9;
      const speed = 9 + Math.random() * 9;
      particles.push({
        x: fromLeft ? w * 0.12 : w * 0.88,
        y: h * 0.95,
        vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1) * (fromLeft ? 1 : -1) + (fromLeft ? speed * 0.45 : -speed * 0.45),
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.4 ? "rect" : "circle",
      });
    }

    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - elapsed / DURATION_MS);
      ctx!.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.32;          // gravité
        p.vx *= 0.985;         // friction
        p.rotation += p.vr;

        ctx!.save();
        ctx!.globalAlpha = fade;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      }

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx!.clearRect(0, 0, w, h);
        onDone?.();
      }
    }
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [prefersReduced, onDone]);

  if (prefersReduced) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[110] pointer-events-none"
      style={{ width: "100vw", height: "100vh" }}
      aria-hidden
    />,
    document.body
  );
}
