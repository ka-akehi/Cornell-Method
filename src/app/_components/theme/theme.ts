export const THEME_STORAGE_KEY = "cornell-method-notebook:theme-mode";

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function isThemeMode(value: unknown): value is ThemeMode {
  return (
    value === "light" || value === "dark" || value === "system"
  );
}

export function normalizeThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : "system";
}

function getBrowserStorage(): ThemeStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredThemeMode(
  storage: ThemeStorage | null | undefined = getBrowserStorage(),
): ThemeMode {
  try {
    return normalizeThemeMode(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function persistThemeMode(
  mode: ThemeMode,
  storage: ThemeStorage | null | undefined = getBrowserStorage(),
) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, normalizeThemeMode(mode));
  } catch {
    // Theme preference is best effort and must never block the application.
  }
}

export function applyThemeMode(
  mode: ThemeMode,
  root: HTMLElement | null =
    typeof document === "undefined" ? null : document.documentElement,
) {
  if (!root) {
    return;
  }

  root.dataset.theme = normalizeThemeMode(mode);
}

const themeStorageKey = JSON.stringify(THEME_STORAGE_KEY);

/** Runs before hydration to use a saved preference without changing server markup. */
export const THEME_INITIALIZER_SCRIPT = `(() => {
  try {
    const value = window.localStorage.getItem(${themeStorageKey});
    const mode = value === "light" || value === "dark" || value === "system" ? value : "system";
    document.documentElement.dataset.theme = mode;
  } catch {
    document.documentElement.dataset.theme = "system";
  }
})();`;
