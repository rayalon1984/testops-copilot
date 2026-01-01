import React, { createContext, useContext, useState, useEffect } from 'react';
import { DesignMode } from '../theme';

interface DesignModeContextType {
    mode: DesignMode;
    toggleMode: () => void;
}

const DesignModeContext = createContext<DesignModeContextType | undefined>(undefined);

export function DesignModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<DesignMode>(() => {
        const saved = localStorage.getItem('design_mode');
        return (saved === 'legacy' || saved === 'modern') ? saved : 'modern';
    });

    useEffect(() => {
        localStorage.setItem('design_mode', mode);
    }, [mode]);

    const toggleMode = () => {
        setMode((prev) => (prev === 'modern' ? 'legacy' : 'modern'));
    };

    return (
        <DesignModeContext.Provider value={{ mode, toggleMode }}>
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
