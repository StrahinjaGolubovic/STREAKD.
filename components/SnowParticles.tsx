'use client';

export function SnowParticles() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[60]">
      {Array.from({ length: 35 }).map((_, i) => {
        const size = Math.random() * 3 + 2;
        const left = Math.random() * 100;
        const duration = Math.random() * 10 + 15;
        const delay = Math.random() * -25;
        const opacity = Math.random() * 0.4 + 0.3;
        const blur = Math.random() * 1.5;

        return (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity: opacity,
              filter: blur > 0 ? `blur(${blur}px)` : 'none',
              animation: `snowfall-${i} ${duration}s linear ${delay}s infinite`,
              willChange: 'transform',
            }}
          />
        );
      })}
      <style jsx>{`
        ${Array.from({ length: 35 }).map((_, i) => {
          const drift = (Math.random() - 0.5) * 100;
          const swayAmount = (Math.random() - 0.5) * 50;
          return `
            @keyframes snowfall-${i} {
              0% {
                transform: translateY(-10px) translateX(0);
              }
              50% {
                transform: translateY(50vh) translateX(${swayAmount}px);
              }
              100% {
                transform: translateY(100vh) translateX(${drift}px);
              }
            }
          `;
        }).join('\n')}
      `}</style>
    </div>
  );
}
