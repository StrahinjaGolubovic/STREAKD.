'use client';

import React from 'react';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function PremiumBadge({ size = 'medium', showText = true }: PremiumBadgeProps) {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base'
  };

  return (
    <div
      className={`${sizeClasses[size]} inline-flex items-center gap-1.5 bg-gradient-to-br from-primary-900/60 to-primary-800/60 border border-primary-500/70 rounded-md shadow-lg hover:shadow-primary-500/50 transition-all duration-300`}
      style={{
        boxShadow: '0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.3), 0 0 40px rgba(var(--primary-rgb, 59, 130, 246), 0.1)',
      }}
    >
      {/* Glow effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-400/10 to-transparent rounded-md animate-shimmer-glow" />

      {/* Premium icon - star/sparkle */}
      <svg className="w-4 h-4 text-primary-300 relative z-10" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>

      {/* Text with Orbitron */}
      <span
        className="font-bold text-primary-200 tracking-wider uppercase relative z-10"
        style={{ fontFamily: 'Orbitron, sans-serif' }}
      >
        PREMIUM
      </span>

      <style jsx>{`
        @keyframes shimmer-glow {
          0% { 
            transform: translateX(-100%); 
            opacity: 0;
          }
          50% {
            opacity: 0.3;
          }
          100% { 
            transform: translateX(100%); 
            opacity: 0;
          }
        }
        .animate-shimmer-glow { 
          animation: shimmer-glow 3s infinite;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
