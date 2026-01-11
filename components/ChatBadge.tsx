import React from 'react';

interface ChatBadgeProps {
    badgeData?: {
        icon: string;
        color?: string;
        glow?: boolean;
    } | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function ChatBadge({ badgeData, size = 'md', className = '' }: ChatBadgeProps) {
    if (!badgeData) {
        return null;
    }

    const sizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    const style: React.CSSProperties = {};

    if (badgeData.glow && badgeData.color) {
        style.filter = `drop-shadow(0 0 4px ${badgeData.color}) drop-shadow(0 0 8px ${badgeData.color})`;
    }

    return (
        <span
            className={`inline-block ${sizes[size]} ${className}`}
            style={style}
            title="Chat Badge"
        >
            {badgeData.icon}
        </span>
    );
}
