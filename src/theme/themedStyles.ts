import { DEFAULT_THEME, THEMES, type Colors } from './themes';

let active: Colors = THEMES[DEFAULT_THEME].colors;

/** Called by ThemeProvider on every render with the current palette. */
export function setActiveColors(colors: Colors) {
  active = colors;
}

export function getActiveColors(): Colors {
  return active;
}

/**
 * Themed replacement for `StyleSheet.create`: `styles.x` is resolved lazily against the active palette
 * (and re-built when the theme changes). Components re-render on theme change because the root
 * and every screen consume ThemeContext.
 */
export function themedStyles<T extends object>(factory: (c: Colors) => T): T {
  let cache: { colors: Colors; styles: T } | null = null;
  return new Proxy({} as T, {
    get(_target, key) {
      if (!cache || cache.colors !== active) cache = { colors: active, styles: factory(active) };
      return (cache.styles as Record<string | symbol, unknown>)[key];
    },
  });
}
