'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  blur: number;
};

export function SnowParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const canvas = canvasEl;
    const context = ctx;

    const isEnabled = process.env.NEXT_PUBLIC_SNOW !== '0';
    if (!isEnabled) return;

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;

    const baseCount = Math.max(18, Math.min(60, Math.floor(window.innerWidth / 28)));
    const particles: Particle[] = [];

    function resize() {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = baseCount;
      while (particles.length < target) {
        particles.push(spawn(true));
      }
      while (particles.length > target) {
        particles.pop();
      }
    }

    function rand(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    function spawn(initial = false): Particle {
      const r = rand(0.8, 2.2);
      const blur = rand(0, 3);
      const alpha = rand(0.12, 0.38);

      return {
        x: rand(0, width),
        y: initial ? rand(0, height) : -rand(10, height * 0.2),
        r,
        vx: rand(-0.18, 0.18),
        vy: rand(0.25, 0.75),
        alpha,
        blur,
      };
    }

    let last = performance.now();

    function draw(now: number) {
      const dt = Math.min(32, now - last);
      last = now;

      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // subtle horizontal drift
        p.x += Math.sin((p.y / 120) + i) * 0.03 * dt;

        if (p.y > height + 10 || p.x < -20 || p.x > width + 20) {
          particles[i] = spawn(false);
          continue;
        }

        context.save();
        context.globalAlpha = p.alpha;
        context.fillStyle = 'rgba(255,255,255,1)';
        // blur per particle (expensive but fine at low counts)
        (context as unknown as { filter: string }).filter = p.blur > 0 ? `blur(${p.blur}px)` : 'none';
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    rafRef.current = requestAnimationFrame((t) => {
      last = t;
      draw(t);
    });

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
