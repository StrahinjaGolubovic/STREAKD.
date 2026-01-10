'use client';

import React from 'react';

interface PremiumBadgeProps {
    size?: 'small' | 'medium' | 'large';
    showText?: boolean;
}

export default function PremiumBadge({ size = 'medium', showText = true }: PremiumBadgeProps) {
    const sizeClasses = {
        small: 'w-4 h-4 text-[8px]',
        medium: 'w-6 h-6 text-[10px]',
        large: 'w-8 h-8 text-xs'
    };

    const textSizeClasses = {
        small: 'text-[7px]',
        medium: 'text-[9px]',
        large: 'text-[11px]'
    };

    return (
        <div className="inline-flex items-center gap-1">
            <div className={`${sizeClasses[size]} relative flex items-center justify-center`}>
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full animate-pulse" />

                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent rounded-full animate-shimmer" />

                {/* Crown icon */}
                <svg
                    className="relative z-10 w-full h-full p-0.5 text-white drop-shadow-lg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                </svg>
            </div>

            {showText && (
                <span className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent drop-shadow-sm`}>
                    PREMIUM
                </span>
            )}

            <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) rotate(45deg);
          }
          100% {
            transform: translateX(100%) rotate(45deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
        </div>
    );
}
