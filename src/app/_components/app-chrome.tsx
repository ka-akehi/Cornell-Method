"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AppChromeBrand,
  AppChromeCreateLink,
  AppChromeDesktopIdentity,
  AppChromeIcon,
  AppChromeNavigation,
} from "./app-chrome-parts";

type AppChromeProps = {
  children: ReactNode;
};

const desktopRailToggleId = "app-chrome-rail-toggle";
const tooltipViewportInset = 8;
const tooltipBoxHeight = 30;

function findDesktopTooltipAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>("[data-app-chrome-tooltip]");
}

function AppChromeDesktopTooltip({ anchor }: { anchor: HTMLElement | null }) {
  const [, refreshPosition] = useState(0);

  useEffect(() => {
    if (!anchor) {
      return;
    }

    const updatePosition = () => refreshPosition((value) => value + 1);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor]);

  if (!anchor || typeof document === "undefined") {
    return null;
  }

  const label = anchor.dataset.appChromeTooltip;
  if (!label) {
    return null;
  }

  const anchorRect = anchor.getBoundingClientRect();
  const tooltipHalfHeight = tooltipBoxHeight / 2;
  const minimumTop = tooltipViewportInset + tooltipHalfHeight;
  const maximumTop = Math.max(
    minimumTop,
    window.innerHeight - tooltipViewportInset - tooltipHalfHeight,
  );
  const top = Math.min(
    Math.max(anchorRect.top + anchorRect.height / 2, minimumTop),
    maximumTop,
  );
  const left =
    anchor.dataset.appChromeTooltipPlacement === "rail"
      ? 64
      : anchorRect.right + tooltipViewportInset;

  return createPortal(
    <span
      className="app-chrome-tooltip-overlay"
      aria-hidden="true"
      style={{ left, top }}
    >
      {label}
    </span>,
    document.body,
  );
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [desktopTooltipAnchor, setDesktopTooltipAnchor] =
    useState<HTMLElement | null>(null);
  const railToggleLabel = isRailOpen
    ? "サイドバーを折りたたむ"
    : "サイドバーを展開する";
  const mobileMenuLabel = isMobileNavOpen
    ? "サイドメニューを閉じる"
    : "サイドメニューを開く";
  const desktopRailHandleRef = useRef<HTMLButtonElement>(null);
  const desktopSidebarRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLElement>(null);

  const toggleRail = () => {
    setIsRailOpen((isOpen) => !isOpen);
  };

  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  const showDesktopTooltip = useCallback((anchor: HTMLElement) => {
    setDesktopTooltipAnchor(anchor);
  }, []);

  const hideDesktopTooltip = useCallback((anchor?: HTMLElement) => {
    setDesktopTooltipAnchor((currentAnchor) =>
      !anchor || currentAnchor === anchor ? null : currentAnchor,
    );
  }, []);

  const handleDesktopPointerOver = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const anchor = findDesktopTooltipAnchor(event.target);
    if (!anchor || !event.currentTarget.contains(anchor)) {
      return;
    }

    const previousTarget = event.relatedTarget;
    if (previousTarget instanceof Node && anchor.contains(previousTarget)) {
      return;
    }

    showDesktopTooltip(anchor);
  };

  const handleDesktopPointerOut = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const anchor = findDesktopTooltipAnchor(event.target);
    if (!anchor) {
      return;
    }

    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && anchor.contains(nextTarget)) {
      return;
    }

    hideDesktopTooltip(anchor);
  };

  const handleDesktopFocus = (event: ReactFocusEvent<HTMLElement>) => {
    const anchor = findDesktopTooltipAnchor(event.target);
    if (anchor?.matches(":focus-visible")) {
      showDesktopTooltip(anchor);
    }
  };

  const handleDesktopBlur = (event: ReactFocusEvent<HTMLElement>) => {
    const anchor = findDesktopTooltipAnchor(event.target);
    if (anchor) {
      hideDesktopTooltip(anchor);
    }
  };

  const handleDesktopKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      hideDesktopTooltip();
    }
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsMobileNavOpen(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    mobilePanelRef.current
      ?.querySelector<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
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
              "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
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
      } else if (
        event.shiftKey &&
        document.activeElement === firstFocusableElement
      ) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastFocusableElement
      ) {
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
      const activeElement = document.activeElement;
      const shouldRestoreFocus = mediaQuery.matches
        ? desktopSidebarRef.current?.contains(activeElement) === true
        : document.activeElement === mobileMenuButtonRef.current ||
          mobilePanelRef.current?.contains(activeElement) === true;

      setDesktopTooltipAnchor(null);
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
      <aside
        id="app-chrome-sidebar"
        ref={desktopSidebarRef}
        className="app-chrome-sidebar"
        aria-label="アプリナビゲーション"
        onPointerOver={handleDesktopPointerOver}
        onPointerOut={handleDesktopPointerOut}
        onFocus={handleDesktopFocus}
        onBlur={handleDesktopBlur}
        onKeyDown={handleDesktopKeyDown}
      >
        <header className="app-chrome-sidebar-identity">
          <AppChromeDesktopIdentity />
          <button
            id={desktopRailToggleId}
            ref={desktopRailHandleRef}
            type="button"
            className="app-chrome-sidebar-toggle"
            aria-label={railToggleLabel}
            aria-expanded={isRailOpen}
            aria-controls="app-chrome-sidebar"
            data-app-chrome-tooltip={railToggleLabel}
            data-app-chrome-tooltip-placement={isRailOpen ? "anchor" : "rail"}
            onClick={toggleRail}
          >
            <AppChromeIcon
              name={isRailOpen ? "panel-left-close" : "panel-left-open"}
              className="app-chrome-sidebar-toggle-icon"
            />
          </button>
        </header>
        <AppChromeCreateLink
          pathname={pathname}
          isCollapsed={!isRailOpen}
          variant="desktop"
        />
        <div className="app-chrome-navigation-scroll">
          <AppChromeNavigation
            pathname={pathname}
            isCollapsed={!isRailOpen}
            variant="desktop"
          />
        </div>
      </aside>

      <div className="app-chrome-content">
        <header className="app-chrome-mobile-header">
          <div className="app-chrome-mobile-header-inner">
            <div
              className="app-chrome-mobile-brand"
              inert={isMobileNavOpen}
            >
              <AppChromeBrand />
            </div>
            <button
              id="app-chrome-mobile-menu-button"
              ref={mobileMenuButtonRef}
              type="button"
              className="app-chrome-menu-button app-chrome-mobile-menu-button"
              aria-label={mobileMenuLabel}
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
              <AppChromeIcon name={isMobileNavOpen ? "close" : "menu"} />
            </button>
          </div>
        </header>

        <main
          id="app-main-content"
          className="app-main"
          inert={isMobileNavOpen}
        >
          {children}
        </main>
      </div>

      <div
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
          aria-label="サイドメニューを閉じる"
          tabIndex={-1}
          onClick={closeMobileNav}
        />
        <aside
          ref={mobilePanelRef}
          id="app-chrome-mobile-panel"
          className="app-chrome-mobile-panel"
          aria-labelledby="app-chrome-mobile-overlay-title"
        >
          <span
            id="app-chrome-mobile-overlay-title"
            className="app-chrome-mobile-panel-title"
          >
            サイドメニュー
          </span>
          <AppChromeCreateLink
            pathname={pathname}
            onNavigate={closeMobileNav}
            variant="mobile"
          />
          <div className="app-chrome-sidebar-body">
            <AppChromeNavigation
              pathname={pathname}
              onNavigate={closeMobileNav}
              variant="mobile"
            />
          </div>
        </aside>
      </div>

      <AppChromeDesktopTooltip anchor={desktopTooltipAnchor} />
    </div>
  );
}
