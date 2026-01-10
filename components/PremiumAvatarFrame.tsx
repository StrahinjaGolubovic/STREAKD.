'use client';

import React from 'react';
import Image from 'next/image';

interface PremiumAvatarFrameProps {
    children: React.ReactNode;
    size?: number;
}

export default function PremiumAvatarFrame({ children, size = 128 }: PremiumAvatarFrameProps) {
    return (
        <div className="relative inline-block" style={{ width: size, height: size }}>
            {/* Animated gradient border */}
            <div
                className="absolute inset-0 rounded-full p-1 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 animate-spin-slow"
                style={{
                    WebkitMask: 'radial-gradient(circle, transparent calc(50% - 4px), black calc(50% - 3px))',
                    mask: 'radial-gradient(circle, transparent calc(50% - 4px), black calc(50% - 3px))',
                }}
            />

            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full blur-md bg-gradient-to-br from-purple-500/50 via-pink-500/50 to-orange-500/50 animate-pulse" style={{ zIndex: -1 }} />

            {/* Avatar content */}
            <div className="relative z-10 w-full h-full rounded-full overflow-hidden border-4 border-gray-900">
                {children}
            </div>

            <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
        </div>
    );
}
