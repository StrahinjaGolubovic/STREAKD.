'use client';

import React from 'react';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function PremiumBadge({ size = 'medium', showText = true }: PremiumBadgeProps) {
  const sizeClasses = {
    small: 'px-2 py-0.5 text-[10px]',
    medium: 'px-2.5 py-1 text-xs',
    large: 'px-3 py-1.5 text-sm'
  };

  return (
    <div className="inline-flex items-center">
      {/* Premium Badge - Using theme colors */}
      <div className={`${sizeClasses[size]} relative overflow-hidden rounded bg-gradient-to-r from-primary-600 to-primary-500 shadow-md border border-primary-400/30`}>
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-slow" />

        {/* Text with Orbitron font */}
        <span className="relative z-10 font-bold tracking-widest text-white drop-shadow-sm uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          PREMIUM
        </span>
      </div>

      <style jsx>{`
        @keyframes shimmer-slow {
          0% { 
            transform: translateX(-100%) skewX(-15deg); 
          }
          100% { 
            transform: translateX(200%) skewX(-15deg); 
          }
        }
        .animate-shimmer-slow { 
          animation: shimmer-slow 3s infinite;
          width: 200%;
        }
      `}</style>
    </div>
  );
}
