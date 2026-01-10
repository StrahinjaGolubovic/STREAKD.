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
            {/* Premium Badge */}
            <div className={`${sizeClasses[size]} relative overflow-hidden rounded-md bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-lg`}>
                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-slow" />

                {/* Text */}
                <span className="relative z-10 font-bold tracking-wider text-white drop-shadow-md uppercase">
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
