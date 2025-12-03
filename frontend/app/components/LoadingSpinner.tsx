'use client';

import { Icon } from '@iconify/react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
    fullScreen?: boolean;
}

export default function LoadingSpinner({
    size = 'md',
    text,
    fullScreen = false,
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    const content = (
        <div className="flex flex-col items-center justify-center gap-2">
            <Icon
                icon="svg-spinners:3-dots-fade"
                className={`${sizeClasses[size]} text-blue-600`}
            />
            {text && <p className="text-sm text-gray-600">{text}</p>}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
                {content}
            </div>
        );
    }

    return content;
}

