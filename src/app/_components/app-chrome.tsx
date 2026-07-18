"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type AppChromeMode = "create" | "edit" | "view" | "review";

export const APP_CHROME_MODE_LABELS: Record<AppChromeMode, string> = {
  create: "作成中",
  edit: "編集中",
  view: "閲覧中",
  review: "復習中",
};

type AppChromeStateContextValue = {
  state: AppChromeMode | null;
  setState: (state: AppChromeMode | null) => void;
};

const AppChromeStateContext = createContext<AppChromeStateContextValue | null>(
  null,
);

function getPathState(pathname: string | null): AppChromeMode | null {
  if (pathname === "/notes/new") return "create";
  if (pathname?.startsWith("/notes/") && pathname !== "/notes/new") {
    return "view";
  }
  return null;
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

/**
 * The chrome badge is the canonical live announcement for a page mode.
 * Consumers that render the same mode in a paper kicker should keep that
 * kicker visual-only with aria-hidden or omit the repeated label.
 */
export function AppChromeState({ state }: { state: AppChromeMode }) {
  const { setState } = useAppChromeState();

  useEffect(() => {
    setState(state);

    return () => setState(null);
  }, [setState, state]);

  return null;
}

type AppChromeProps = {
  children: ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const pathState = getPathState(pathname);
  const [override, setOverride] = useState<{
    pathname: string | null;
    state: AppChromeMode;
  } | null>(null);

  const setState = useCallback(
    (nextState: AppChromeMode | null) => {
      setOverride((current) => {
        if (nextState === null) {
          if (current?.pathname !== pathname) return current;
          return null;
        }

        return { pathname, state: nextState };
      });
    },
    [pathname],
  );

  const state = override?.pathname === pathname ? override.state : pathState;
  const contextValue = useMemo(
    () => ({ state, setState }),
    [setState, state],
  );
  const stateLabel = state ? APP_CHROME_MODE_LABELS[state] : null;

  return (
    <AppChromeStateContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col">
        <header className="app-chrome-header sticky top-0 z-10">
          <div className="app-chrome-inner">
            <Link
              href="/notes"
              className="app-chrome-brand"
              aria-label="Cornell Method Notebook ノート一覧へ"
            >
              <span
                className="app-chrome-brand-mark"
                aria-hidden="true"
              >
                C
              </span>
              <div className="app-chrome-brand-copy">
                <p className="app-chrome-brand-title">
                  Cornell Method Notebook
                </p>
                <p className="app-chrome-brand-subtitle">
                  ローカル学習ノート
                </p>
              </div>
            </Link>
            <div className="flex min-w-0 items-center justify-end gap-4">
              <nav
                className="app-chrome-nav flex-1"
                aria-label="グローバルナビゲーション"
              >
                <Link
                  href="/notes"
                  className="app-chrome-nav-link"
                >
                  ノート一覧
                </Link>
                <Link
                  href="/notes/new"
                  className="app-chrome-nav-link"
                >
                  新規作成
                </Link>
                <Link
                  href="/backup"
                  className="app-chrome-nav-link"
                >
                  バックアップ
                </Link>
              </nav>
              <div
                className="app-chrome-state-slot shrink-0"
                data-state={state ?? "idle"}
                role={state ? "status" : undefined}
                aria-live="polite"
                aria-atomic="true"
              >
                {stateLabel ? (
                  <span className="app-chrome-state-badge">
                    <span className="sr-only">画面状態: </span>
                    {stateLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </AppChromeStateContext.Provider>
  );
}
