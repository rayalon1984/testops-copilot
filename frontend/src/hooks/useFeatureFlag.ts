/**
 * useFeatureFlag — Simple localStorage-backed feature flags.
 *
 * Toggle via browser console:
 *   localStorage.setItem('ff:some-feature', 'true')   // enable
 *   localStorage.setItem('ff:some-feature', 'false')  // disable
 *   localStorage.removeItem('ff:some-feature')        // disable (default off)
 *
 * Cross-tab sync via StorageEvent listener.
 */

import { useState, useEffect, useCallback } from 'react';

const FF_PREFIX = 'ff:';

export function useFeatureFlag(flagName: string, defaultValue = false): boolean {
    const key = FF_PREFIX + flagName;

    const readFlag = useCallback((): boolean => {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return defaultValue;
            return stored === 'true';
        } catch {
            return defaultValue;
        }
    }, [key, defaultValue]);

    const [enabled, setEnabled] = useState(readFlag);

    // Cross-tab sync
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === key) setEnabled(readFlag());
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [key, readFlag]);

    return enabled;
}

/** Imperatively read a flag (for non-React contexts). */
export function getFeatureFlag(flagName: string, defaultValue = false): boolean {
    try {
        const stored = localStorage.getItem(FF_PREFIX + flagName);
        if (stored === null) return defaultValue;
        return stored === 'true';
    } catch {
        return defaultValue;
    }
}
