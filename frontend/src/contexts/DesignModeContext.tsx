import React, { createContext, useContext, useState, useEffect } from 'react';
import { DesignMode } from '../theme';

export type ColorMode = 'light' | 'dark';

interface DesignModeContextType {
    mode: DesignMode;
    colorMode: ColorMode;
    toggleMode: () => void;
    toggleColorMode: () => void;
}

const DesignModeContext = createContext<DesignModeContextType | undefined>(undefined);

export function DesignModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<DesignMode>(() => {
        const saved = localStorage.getItem('design_mode');
        return (saved === 'legacy' || saved === 'modern') ? saved : 'modern';
    });

    const [colorMode, setColorMode] = useState<ColorMode>(() => {
        const saved = localStorage.getItem('color_mode');
        return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    });

    useEffect(() => {
        localStorage.setItem('design_mode', mode);
    }, [mode]);

    useEffect(() => {
        localStorage.setItem('color_mode', colorMode);
    }, [colorMode]);

    const toggleMode = () => {
        setMode((prev) => (prev === 'modern' ? 'legacy' : 'modern'));
    };

    const toggleColorMode = () => {
        setColorMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <DesignModeContext.Provider value={{ mode, colorMode, toggleMode, toggleColorMode }}>
            {children}
        </DesignModeContext.Provider>
    );
}

export function useDesignMode() {
    const context = useContext(DesignModeContext);
    if (context === undefined) {
        throw new Error('useDesignMode must be used within a DesignModeProvider');
    }
    return context;
}
