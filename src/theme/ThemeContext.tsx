import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getSetting, setSetting } from '../db';
import { setActiveColors } from './themedStyles';
import { DEFAULT_THEME, isThemeName, THEMES, type Colors, type ThemeName } from './themes';

interface ThemeValue {
  themeName: ThemeName;
  colors: Colors;
  /** Applies and persists a theme (stored in SQLite `settings`). */
  setTheme: (name: ThemeName) => Promise<void>;
  /** Loads the saved theme; call once after the database is open. */
  hydrate: () => Promise<void>;
}

const ThemeContext = createContext<ThemeValue>({
  themeName: DEFAULT_THEME,
  colors: THEMES[DEFAULT_THEME].colors,
  setTheme: async () => {},
  hydrate: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);
  const colors = THEMES[themeName].colors;
  // Must happen before children render so lazily-built styles see the new palette.
  setActiveColors(colors);

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeName(name);
    try {
      await setSetting('theme', name);
    } catch {
      // still applied for this session
    }
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const saved = await getSetting('theme');
      if (isThemeName(saved)) setThemeName(saved);
    } catch {
      // keep default
    }
  }, []);

  const value = useMemo(
    () => ({ themeName, colors, setTheme, hydrate }),
    [themeName, colors, setTheme, hydrate],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
