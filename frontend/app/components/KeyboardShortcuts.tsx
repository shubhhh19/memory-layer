'use client';

import { useEffect } from 'react';

interface Shortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            for (const shortcut of shortcuts) {
                const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
                const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
                const altMatch = shortcut.alt ? event.altKey : !event.altKey;

                if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                    event.preventDefault();
                    shortcut.action();
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}

// Common shortcuts helper
export const commonShortcuts = {
    search: (action: () => void) => ({
        key: 'k',
        ctrl: true,
        action,
        description: 'Open search',
    }),
    new: (action: () => void) => ({
        key: 'n',
        ctrl: true,
        action,
        description: 'Create new',
    }),
    save: (action: () => void) => ({
        key: 's',
        ctrl: true,
        action,
        description: 'Save',
    }),
    escape: (action: () => void) => ({
        key: 'Escape',
        action,
        description: 'Close/Cancel',
    }),
};

