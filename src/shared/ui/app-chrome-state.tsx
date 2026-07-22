"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";

export type AppChromeMode = "create" | "edit" | "view" | "review";

export type AppChromeStateContextValue = {
  state: AppChromeMode | null;
  setState: (state: AppChromeMode | null) => void;
};

export const AppChromeStateContext =
  createContext<AppChromeStateContextValue | null>(null);

type AppChromeStateProviderProps = {
  children: ReactNode;
  state: AppChromeMode | null;
  setState: (state: AppChromeMode | null) => void;
};

export function AppChromeStateProvider({
  children,
  state,
  setState,
}: AppChromeStateProviderProps) {
  const contextValue = useMemo(
    () => ({ state, setState }),
    [setState, state],
  );

  return (
    <AppChromeStateContext.Provider value={contextValue}>
      {children}
    </AppChromeStateContext.Provider>
  );
}

export function useAppChromeState() {
  const context = useContext(AppChromeStateContext);

  if (!context) {
    throw new Error(
      "useAppChromeState must be used within the app chrome component.",
    );
  }

  return context;
}

export function AppChromeModeReporter({
  state,
}: {
  state: AppChromeMode;
}) {
  const { setState } = useAppChromeState();

  useEffect(() => {
    setState(state);

    return () => setState(null);
  }, [setState, state]);

  return null;
}

/**
 * Compatibility name for consumers that used the original app-shell
 * reporter before the shared UI bridge was introduced.
 */
export const AppChromeState = AppChromeModeReporter;
