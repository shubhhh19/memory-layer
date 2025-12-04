'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="offline-indicator">
            <div className="flex items-center justify-center gap-2">
                <Icon icon="material-symbols:wifi-off" className="w-5 h-5" />
                <span>You are offline. Some features may be unavailable.</span>
            </div>
        </div>
    );
}

