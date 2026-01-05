'use client';

import { useEffect, useState } from 'react';

export function SnowParticles() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      setMounted(true);
    }
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style jsx>{`
        @keyframes snowfall {
          0% {
            transform: translateY(-10vh) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) translateX(var(--drift));
            opacity: 0;
          }
        }

        @keyframes sway {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(var(--sway-amount));
          }
        }

        .snowflake {
          position: fixed;
          top: -10vh;
          color: rgba(255, 255, 255, 0.8);
          font-size: var(--size);
          animation: snowfall var(--duration) linear var(--delay) infinite,
                     sway var(--sway-duration) ease-in-out var(--delay) infinite;
          pointer-events: none;
          user-select: none;
          will-change: transform, opacity;
          z-index: 60;
        }
      `}</style>
      
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 60 }}>
        {Array.from({ length: 25 }).map((_, i) => {
          const size = Math.random() * 0.5 + 0.3;
          const left = Math.random() * 100;
          const duration = Math.random() * 8 + 12;
          const delay = Math.random() * -20;
          const drift = (Math.random() - 0.5) * 30;
          const swayAmount = (Math.random() - 0.5) * 40;
          const swayDuration = Math.random() * 3 + 2;

          return (
            <div
              key={i}
              className="snowflake"
              style={{
                left: `${left}%`,
                '--size': `${size}rem`,
                '--duration': `${duration}s`,
                '--delay': `${delay}s`,
                '--drift': `${drift}px`,
                '--sway-amount': `${swayAmount}px`,
                '--sway-duration': `${swayDuration}s`,
              } as React.CSSProperties}
            >
              ❄
            </div>
          );
        })}
      </div>
    </>
  );
}
