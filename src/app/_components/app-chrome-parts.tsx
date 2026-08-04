"use client";

import Link from "next/link";
import { type ReactNode } from "react";

type AppChromeIconName =
  | "close"
  | "menu"
  | "notes"
  | "panel-left-close"
  | "panel-left-open"
  | "plus";

type AppChromeNavItem = {
  href: "/notes";
  label: string;
  icon: "notes";
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

  return pathname === href || pathname.startsWith(href + "/");
}

export function AppChromeIcon({
  name,
  className = "app-chrome-nav-icon",
}: {
  name: AppChromeIconName;
  className?: string;
}) {
  let iconContent: ReactNode;

  switch (name) {
    case "close":
      iconContent = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case "menu":
      iconContent = <path d="M4 7h16M4 12h16M4 17h16" />;
      break;
    case "panel-left-close":
      iconContent = (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M16 9l-3 3 3 3" />
        </>
      );
      break;
    case "panel-left-open":
      iconContent = (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M14 9l3 3-3 3" />
        </>
      );
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
      strokeWidth="1.75"
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
  isCollapsed,
  variant,
}: {
  item: AppChromeNavItem;
  pathname: string | null;
  onNavigate?: () => void;
  isCollapsed: boolean;
  variant: "desktop" | "mobile";
}) {
  const isActive = isActiveRoute(pathname, item.href);
  const hasIconOnlyTooltip = variant === "desktop" && isCollapsed;

  return (
    <Link
      href={item.href}
      className={
        "app-chrome-nav-link" +
        ` app-chrome-nav-link--${variant}` +
        (isCollapsed ? " is-icon-only" : "") +
        (isActive ? " is-selected" : "")
      }
      aria-label={hasIconOnlyTooltip ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      data-app-chrome-tooltip={
        hasIconOnlyTooltip ? item.label : undefined
      }
      data-app-chrome-tooltip-placement={
        hasIconOnlyTooltip ? "rail" : undefined
      }
      onClick={onNavigate}
    >
      <AppChromeIcon name={item.icon} />
      <span
        className={
          variant === "desktop" ? "app-chrome-control-label" : undefined
        }
        aria-hidden={hasIconOnlyTooltip ? true : undefined}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function AppChromeNavigation({
  pathname,
  onNavigate,
  isCollapsed = false,
  variant = "desktop",
}: {
  pathname: string | null;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  variant?: "desktop" | "mobile";
}) {
  return (
    <nav
      className={`app-chrome-nav app-chrome-nav--${variant}`}
      aria-label="グローバルナビゲーション"
    >
      {appChromeNavItems.map((item) => (
        <AppChromeNavLink
          key={item.href}
          item={item}
          pathname={pathname}
          onNavigate={onNavigate}
          isCollapsed={variant === "desktop" && isCollapsed}
          variant={variant}
        />
      ))}
    </nav>
  );
}

export function AppChromeCreateLink({
  pathname,
  onNavigate,
  isCollapsed = false,
  variant = "mobile",
}: {
  pathname: string | null;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  variant?: "desktop" | "mobile";
}) {
  const isActive = pathname === "/notes/new";
  const hasIconOnlyTooltip = variant === "desktop" && isCollapsed;

  return (
    <Link
      href="/notes/new"
      className={
        "app-chrome-create-link" +
        ` app-chrome-create-link--${variant}` +
        (isCollapsed ? " is-icon-only" : "") +
        (isActive ? " is-selected" : "")
      }
      aria-label={hasIconOnlyTooltip ? "新規ノート" : undefined}
      aria-current={isActive ? "page" : undefined}
      data-app-chrome-tooltip={
        hasIconOnlyTooltip ? "新規ノート" : undefined
      }
      data-app-chrome-tooltip-placement={
        hasIconOnlyTooltip ? "rail" : undefined
      }
      onClick={onNavigate}
    >
      <AppChromeIcon name="plus" />
      <span
        className={
          variant === "desktop" ? "app-chrome-control-label" : undefined
        }
        aria-hidden={hasIconOnlyTooltip ? true : undefined}
      >
        新規ノート
      </span>
    </Link>
  );
}

function AppChromeBrandContent() {
  return (
    <>
      <span className="app-chrome-brand-mark" aria-hidden="true">
        C
      </span>
      <span className="app-chrome-brand-copy">
        <span className="app-chrome-brand-title">Cornell Method Notebook</span>
        <span className="app-chrome-brand-subtitle">ローカル学習ノート</span>
      </span>
    </>
  );
}

export function AppChromeDesktopIdentity() {
  return (
    <div className="app-chrome-desktop-identity">
      <AppChromeBrandContent />
    </div>
  );
}

export function AppChromeBrand() {
  return (
    <Link
      href="/notes"
      className="app-chrome-brand"
      aria-label="Cornell Method Notebook ノート一覧へ"
    >
      <AppChromeBrandContent />
    </Link>
  );
}
