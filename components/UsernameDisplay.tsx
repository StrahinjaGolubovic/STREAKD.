import React from 'react';

interface UsernameDisplayProps {
    username: string;
    colorData?: {
        color?: string;
        gradient?: string;
        glow?: boolean;
        glowColor?: string;
    } | null;
    badge?: {
        icon: string;
        color?: string;
        glow?: boolean;
    } | null;
    className?: string;
    showBadge?: boolean;
}

export function UsernameDisplay({
    username,
    colorData,
    badge,
    className = '',
    showBadge = true
}: UsernameDisplayProps) {
    const usernameStyle: React.CSSProperties = {};

    if (colorData) {
        if (colorData.gradient) {
            usernameStyle.background = colorData.gradient;
            usernameStyle.WebkitBackgroundClip = 'text';
            usernameStyle.WebkitTextFillColor = 'transparent';
            usernameStyle.backgroundClip = 'text';
        } else if (colorData.color) {
            usernameStyle.color = colorData.color;
        }

        if (colorData.glow && colorData.glowColor) {
            usernameStyle.textShadow = `0 0 10px ${colorData.glowColor}, 0 0 20px ${colorData.glowColor}`;
        }
    }

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            <span style={usernameStyle} className="font-semibold">
                {username}
            </span>
            {showBadge && badge && (
                <span
                    className="text-sm flex-shrink-0"
                    style={badge.glow && badge.color ? {
                        filter: `drop-shadow(0 0 4px ${badge.color})`
                    } : {}}
                >
                    {badge.icon}
                </span>
            )}
        </span>
    );
}
