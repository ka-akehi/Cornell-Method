"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type AppChromeProps = {
  children: ReactNode;
};

type AppChromeIconName =
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "menu"
  | "notes"
  | "plus";

type AppChromeNavItem = {
  href: "/notes";
  label: string;
  icon: Exclude<AppChromeIconName, "menu" | "plus">;
};

const appChromeNavItems: AppChromeNavItem[] = [
  { href: "/notes", label: "ノート一覧", icon: "notes" },
];

function isActiveRoute(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  if (href === "/notes") {
    return (
      pathname === "/notes" ||
      (pathname.startsWith("/notes/") && pathname !== "/notes/new")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function AppChromeIcon({
  name,
  className = "app-chrome-nav-icon",
}: {
  name: AppChromeIconName;
  className?: string;
}) {
  let iconContent: ReactNode;

  switch (name) {
    case "chevron-left":
      iconContent = <path d="m15 5-7 7 7 7" />;
      break;
    case "chevron-right":
      iconContent = <path d="m9 5 7 7-7 7" />;
      break;
    case "close":
      iconContent = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case "menu":
      iconContent = <path d="M4 7h16M4 12h16M4 17h16" />;
      break;
    case "plus":
      iconContent = <path d="M12 5v14M5 12h14" />;
      break;
    case "notes":
      iconContent = (
        <>
          <path d="M6 3.75h9.5L19 7.25v13H6z" />
          <path d="M15.5 3.75v3.5H19M9 11h7M9 14.5h7M9 18h4" />
        </>
      );
      break;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconContent}
    </svg>
  );
}

function AppChromeNavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: AppChromeNavItem;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const isActive = isActiveRoute(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`app-chrome-nav-link${isActive ? " is-selected" : ""}`}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      <AppChromeIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

function AppChromeNavigation({
  pathname,
  onNavigate,
  variant,
}: {
  pathname: string | null;
  onNavigate?: () => void;
  variant?: "mobile";
}) {
  return (
    <nav
      className={`app-chrome-nav${variant === "mobile" ? " app-chrome-nav--mobile" : ""}`}
      aria-label="グローバルナビゲーション"
    >
      {appChromeNavItems.map((item) => (
        <AppChromeNavLink
          key={item.href}
          item={item}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function AppChromeCreateLink({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const isActive = pathname === "/notes/new";

  return (
    <Link
      href="/notes/new"
      className={`app-chrome-create-link${isActive ? " is-selected" : ""}`}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      <AppChromeIcon name="plus" />
      <span>新規ノート</span>
    </Link>
  );
}

function AppChromeBrand() {
  return (
    <Link
      href="/notes"
      className="app-chrome-brand"
      aria-label="Cornell Method Notebook ノート一覧へ"
    >
      <span className="app-chrome-brand-mark" aria-hidden="true">
        C
      </span>
      <span className="app-chrome-brand-copy">
        <span className="app-chrome-brand-title">
          Cornell Method Notebook
        </span>
        <span className="app-chrome-brand-subtitle">ローカル学習ノート</span>
      </span>
    </Link>
  );
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const desktopRailHandleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);
  const isMobileNavOpenRef = useRef(false);
  const shouldRestoreDesktopFocusRef = useRef(false);

  useEffect(() => {
    isMobileNavOpenRef.current = isMobileNavOpen;
  }, [isMobileNavOpen]);

  const toggleRail = () => {
    shouldRestoreDesktopFocusRef.current = true;
    setIsRailOpen((isOpen) => !isOpen);
  };

  useEffect(() => {
    if (!shouldRestoreDesktopFocusRef.current) {
      return;
    }

    shouldRestoreDesktopFocusRef.current = false;
    window.requestAnimationFrame(() => desktopRailHandleRef.current?.focus());
  }, [isRailOpen]);

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    mobilePanelRef.current
      ?.querySelector<HTMLElement>(
        ".app-chrome-mobile-panel-close, a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )
      ?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNav();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = mobilePanelRef.current
        ? Array.from(
            mobilePanelRef.current.querySelectorAll<HTMLElement>(
              ".app-chrome-mobile-panel-close, a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
            ),
          )
        : [];
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement =
        focusableElements[focusableElements.length - 1];

      if (!firstFocusableElement || !lastFocusableElement) {
        return;
      }

      if (!mobilePanelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        firstFocusableElement.focus();
      } else if (event.shiftKey && document.activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNav, isMobileNavOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");

    const handleViewportChange = () => {
      const shouldRestoreFocus =
        isMobileNavOpenRef.current ||
        document.activeElement === mobileMenuButtonRef.current ||
        document.activeElement === desktopRailHandleRef.current;

      setIsMobileNavOpen(false);
      setIsRailOpen(true);

      if (shouldRestoreFocus) {
        window.requestAnimationFrame(() => {
          const nextMenuButton = mediaQuery.matches
            ? mobileMenuButtonRef.current
            : desktopRailHandleRef.current;
          nextMenuButton?.focus();
        });
      }
    };

    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  return (
    <div
      className={`app-chrome-shell${isRailOpen ? "" : " is-rail-collapsed"}`}
    >
      <div
        className={`app-chrome-rail-region${isRailOpen ? "" : " is-collapsed"}`}
      >
        <button
          id="app-chrome-rail-toggle"
          ref={desktopRailHandleRef}
          type="button"
          className="app-chrome-rail-handle"
          aria-label={
            isRailOpen
              ? "サイドバーを折りたたむ"
              : "サイドバーを展開する"
          }
          aria-expanded={isRailOpen}
          aria-controls="app-chrome-rail"
          onClick={toggleRail}
        >
          <AppChromeIcon
            name={isRailOpen ? "chevron-left" : "chevron-right"}
            className="app-chrome-rail-handle-icon"
          />
        </button>

        <aside
          id="app-chrome-rail"
          className="app-chrome-rail"
          aria-label="アプリナビゲーション"
          aria-hidden={!isRailOpen}
          hidden={!isRailOpen}
        >
          <div className="app-chrome-rail-inner">
            <header className="app-chrome-rail-header">
              <AppChromeBrand />
            </header>
            <AppChromeNavigation pathname={pathname} />
            <div className="app-chrome-rail-footer">
              <AppChromeCreateLink pathname={pathname} />
            </div>
          </div>
        </aside>
      </div>

      <div
        className="app-chrome-content"
        inert={isMobileNavOpen}
      >
        <header className="app-chrome-mobile-header">
          <div className="app-chrome-mobile-header-inner">
            <AppChromeBrand />
            <button
              id="app-chrome-mobile-menu-button"
              ref={mobileMenuButtonRef}
              type="button"
              className="app-chrome-menu-button app-chrome-mobile-menu-button"
              aria-label={
                isMobileNavOpen
                  ? "ナビゲーションを閉じる"
                  : "ナビゲーションを開く"
              }
              aria-expanded={isMobileNavOpen}
              aria-controls="app-chrome-mobile-overlay"
              onClick={() => {
                if (isMobileNavOpen) {
                  closeMobileNav();
                } else {
                  setIsMobileNavOpen(true);
                }
              }}
            >
              <AppChromeIcon name="menu" />
            </button>
          </div>
        </header>

        <main id="app-main-content" className="app-main">
          {children}
        </main>
      </div>

      <div
        ref={mobileOverlayRef}
        id="app-chrome-mobile-overlay"
        className="app-chrome-mobile-overlay"
        role={isMobileNavOpen ? "dialog" : undefined}
        aria-modal={isMobileNavOpen ? true : undefined}
        aria-labelledby="app-chrome-mobile-overlay-title"
        hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          className="app-chrome-mobile-backdrop"
          aria-label="ナビゲーションを閉じる"
          tabIndex={-1}
          onClick={closeMobileNav}
        />
        <aside
          ref={mobilePanelRef}
          id="app-chrome-mobile-panel"
          className="app-chrome-mobile-panel"
          aria-labelledby="app-chrome-mobile-overlay-title"
        >
          <header className="app-chrome-mobile-panel-header">
            <h2 id="app-chrome-mobile-overlay-title">ナビゲーション</h2>
            <button
              type="button"
              className="app-chrome-mobile-panel-close"
              aria-label="ナビゲーションを閉じる"
              onClick={closeMobileNav}
            >
              <AppChromeIcon
                name="close"
                className="app-chrome-mobile-panel-close-icon"
              />
            </button>
          </header>
          <div className="app-chrome-sidebar-body">
            <AppChromeNavigation
              pathname={pathname}
              onNavigate={closeMobileNav}
              variant="mobile"
            />
          </div>
          <footer className="app-chrome-sidebar-footer">
            <AppChromeCreateLink
              pathname={pathname}
              onNavigate={closeMobileNav}
            />
          </footer>
        </aside>
      </div>
    </div>
  );
}
