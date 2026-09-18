"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DESKTOP_SETTINGS_REQUEST_EVENT,
  sendDesktopSettingsRequest,
} from "@/shared/desktop/desktop-settings-bridge";
import { AppChromeIcon } from "../app-chrome-parts";
import { SettingsModal } from "./settings-modal";
import styles from "./settings-modal.module.css";

type SettingsEntrypointProps = {
  isCollapsed?: boolean;
};

export function SettingsEntrypoint({
  isCollapsed = false,
}: SettingsEntrypointProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSettingsRequest = useCallback(() => {
    if (isOpenRef.current) {
      return;
    }

    const activeElement = document.activeElement;
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : triggerRef.current;
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(
      DESKTOP_SETTINGS_REQUEST_EVENT,
      handleSettingsRequest,
    );

    return () => {
      window.removeEventListener(
        DESKTOP_SETTINGS_REQUEST_EVENT,
        handleSettingsRequest,
      );
    };
  }, [handleSettingsRequest]);

  const closeSettings = useCallback(() => {
    if (!isOpenRef.current) {
      return;
    }

    isOpenRef.current = false;
    setIsOpen(false);

    const elementToFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    const restoreFocus = () => {
      if (elementToFocus?.isConnected) {
        elementToFocus.focus();
        return;
      }

      triggerRef.current?.focus();
    };

    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(restoreFocus);
    } else {
      window.setTimeout(restoreFocus, 0);
    }
  }, []);

  const triggerClassName = [
    styles.trigger,
    isCollapsed ? styles.triggerCollapsed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[
        styles.entrypoint,
        isCollapsed ? styles.entrypointCollapsed : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={isCollapsed ? "設定を開く" : undefined}
        data-app-chrome-tooltip={isCollapsed ? "設定" : undefined}
        data-app-chrome-tooltip-placement={isCollapsed ? "rail" : undefined}
        onClick={() => sendDesktopSettingsRequest()}
      >
        <AppChromeIcon name="settings" className={styles.triggerIcon} />
        <span
          className={isCollapsed ? styles.triggerLabelCollapsed : undefined}
          aria-hidden={isCollapsed ? true : undefined}
        >
          設定
        </span>
      </button>

      {isOpen && <SettingsModal onClose={closeSettings} />}
    </div>
  );
}
