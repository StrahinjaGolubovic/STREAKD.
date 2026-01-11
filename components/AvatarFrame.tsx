import React from 'react';

interface AvatarFrameProps {
    frameData?: {
        borderColor?: string;
        borderWidth?: number;
        borderStyle?: string;
        gradient?: string;
    } | null;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export function AvatarFrame({ frameData, children, size = 'md', className = '' }: AvatarFrameProps) {
    const sizes = {
        sm: 'p-[2px]',
        md: 'p-[3px]',
        lg: 'p-[4px]',
        xl: 'p-[5px]'
    };

    if (!frameData) {
        return <div className={className}>{children}</div>;
    }

    if (frameData.gradient) {
        return (
            <div
                className={`rounded-full ${sizes[size]} ${className}`}
                style={{
                    background: frameData.gradient,
                    padding: `${frameData.borderWidth || 3}px`
                }}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            className={`rounded-full ${className}`}
            style={{
                border: `${frameData.borderWidth || 3}px ${frameData.borderStyle || 'solid'} ${frameData.borderColor || '#FFD700'}`,
            }}
        >
            {children}
        </div>
    );
}
