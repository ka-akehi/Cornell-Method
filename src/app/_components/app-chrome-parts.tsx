"use client";

import Link from "next/link";
import { type ReactNode } from "react";

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
      className={"app-chrome-nav-link" + (isActive ? " is-selected" : "")}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      <AppChromeIcon name={item.icon} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppChromeNavigation({
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
      className={
        "app-chrome-nav" +
        (variant === "mobile" ? " app-chrome-nav--mobile" : "")
      }
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

export function AppChromeCreateLink({
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
      className={"app-chrome-create-link" + (isActive ? " is-selected" : "")}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      <AppChromeIcon name="plus" />
      <span>新規ノート</span>
    </Link>
  );
}

export function AppChromeBrand() {
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
