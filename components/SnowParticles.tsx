'use client';

export function SnowParticles() {
  const particles = Array.from({ length: 50 }).map((_, i) => {
    const size = Math.random() * 4 + 1.5;
    const left = Math.random() * 100;
    const duration = Math.random() * 12 + 18;
    const delay = Math.random() * -30;
    const opacity = Math.random() * 0.5 + 0.25;
    const blur = Math.random() * 2;
    const drift = (Math.random() - 0.5) * 150;
    const swayAmount = (Math.random() - 0.5) * 80;
    const rotationSpeed = Math.random() * 10 + 10;
    const rotationDelay = Math.random() * -20;
    
    const isGlowing = Math.random() > 0.7;
    
    return {
      i,
      size,
      left,
      duration,
      delay,
      opacity,
      blur,
      drift,
      swayAmount,
      rotationSpeed,
      rotationDelay,
      isGlowing,
    };
  });

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-[60]">
      {particles.map((p) => (
        <div
          key={p.i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            background: p.isGlowing
              ? `radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%)`
              : 'white',
            filter: p.blur > 0.5 ? `blur(${p.blur}px)` : 'none',
            boxShadow: p.isGlowing ? `0 0 ${p.size * 2}px rgba(255,255,255,0.6)` : 'none',
            animation: `snowfall-${p.i} ${p.duration}s ease-in-out ${p.delay}s infinite, snowrotate-${p.i} ${p.rotationSpeed}s linear ${p.rotationDelay}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
      <style jsx>{`
        ${particles.map((p) => `
          @keyframes snowfall-${p.i} {
            0% {
              transform: translate3d(0, -10px, 0);
              opacity: 0;
            }
            10% {
              opacity: ${p.opacity};
            }
            25% {
              transform: translate3d(${p.swayAmount * 0.3}px, 25vh, 0);
            }
            50% {
              transform: translate3d(${p.swayAmount * 0.6}px, 50vh, 0);
            }
            75% {
              transform: translate3d(${p.swayAmount}px, 75vh, 0);
            }
            90% {
              opacity: ${p.opacity};
            }
            100% {
              transform: translate3d(${p.drift}px, 100vh, 0);
              opacity: 0;
            }
          }
          
          @keyframes snowrotate-${p.i} {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}
