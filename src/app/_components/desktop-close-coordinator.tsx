"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DESKTOP_CLOSE_REQUEST_EVENT,
  getDesktopDirtyController,
  sendDesktopCloseDecision,
} from "@/shared/desktop/desktop-close-bridge";

const focusableSelector =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable=\"true\"], [tabindex]:not([tabindex='-1'])";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hasAttribute("aria-hidden") &&
      !element.closest("[hidden], [inert]"),
  );
}

export function DesktopCloseCoordinator() {
  const [desktopCloseOpen, setDesktopCloseOpen] = useState(false);
  const [desktopCloseBusy, setDesktopCloseBusy] = useState(false);
  const [desktopCloseError, setDesktopCloseError] = useState<string | null>(
    null,
  );
  const desktopCloseDialogRef = useRef<HTMLElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const desktopCloseOpenRef = useRef(false);

  useEffect(() => {
    const handleDesktopCloseRequest = () => {
      const controller = getDesktopDirtyController();
      let dirty = false;
      try {
        dirty = controller?.isDirty() ?? false;
      } catch {
        dirty = true;
      }

      if (!dirty) {
        void sendDesktopCloseDecision("clean");
        return;
      }

      if (!desktopCloseOpenRef.current) {
        const activeElement = document.activeElement;
        returnFocusRef.current =
          activeElement instanceof HTMLElement &&
          activeElement.isConnected &&
          activeElement !== document.body
            ? activeElement
            : null;
        desktopCloseOpenRef.current = true;
      }
      setDesktopCloseError(null);
      setDesktopCloseOpen(true);
    };

    window.addEventListener(
      DESKTOP_CLOSE_REQUEST_EVENT,
      handleDesktopCloseRequest,
    );
    return () => {
      window.removeEventListener(
        DESKTOP_CLOSE_REQUEST_EVENT,
        handleDesktopCloseRequest,
      );
    };
  }, []);

  const completeDesktopClose = useCallback(() => {
    desktopCloseOpenRef.current = false;
    returnFocusRef.current = null;
    setDesktopCloseOpen(false);
  }, []);

  const restoreDesktopCloseFocus = useCallback(() => {
    const elementToFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    desktopCloseOpenRef.current = false;
    setDesktopCloseOpen(false);

    const restoreFocus = () => {
      if (desktopCloseOpenRef.current) {
        return;
      }

      if (elementToFocus?.isConnected) {
        elementToFocus.focus({ preventScroll: true });
        return;
      }

      const fallback = getFocusableElements(document.body)[0];
      if (fallback?.isConnected) {
        fallback.focus({ preventScroll: true });
        return;
      }

      document.body.focus({ preventScroll: true });
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

  const cancelDesktopClose = useCallback(async () => {
    if (await sendDesktopCloseDecision("cancel")) {
      restoreDesktopCloseFocus();
    } else {
      setDesktopCloseError("終了処理へ応答できませんでした。");
    }
  }, [restoreDesktopCloseFocus]);

  useEffect(() => {
    if (!desktopCloseOpen) {
      return;
    }

    const dialog = desktopCloseDialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);
    (saveButtonRef.current && !saveButtonRef.current.disabled
      ? saveButtonRef.current
      : focusableElements[0] ?? dialog
    ).focus({ preventScroll: true });
  }, [desktopCloseOpen]);

  useEffect(() => {
    if (!desktopCloseOpen) {
      return;
    }

    const dialog = desktopCloseDialogRef.current;
    if (!dialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Tab") {
        return;
      }

      if (event.key === "Escape") {
        if (desktopCloseBusy) {
          return;
        }
        event.preventDefault();
        void cancelDesktopClose();
        return;
      }

      const currentFocusableElements = getFocusableElements(dialog);
      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const firstFocusableElement = currentFocusableElements[0];
      const lastFocusableElement =
        currentFocusableElements[currentFocusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!currentFocusableElements.includes(activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? lastFocusableElement : firstFocusableElement).focus({
          preventScroll: true,
        });
      } else if (
        event.shiftKey &&
        activeElement === firstFocusableElement
      ) {
        event.preventDefault();
        lastFocusableElement.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        activeElement === lastFocusableElement
      ) {
        event.preventDefault();
        firstFocusableElement.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cancelDesktopClose, desktopCloseBusy, desktopCloseOpen]);

  async function saveAndCloseDesktop() {
    const controller = getDesktopDirtyController();
    if (!controller) {
      await sendDesktopCloseDecision("cancel");
      setDesktopCloseError("編集中の内容を確認できませんでした。");
      return;
    }
    setDesktopCloseBusy(true);
    setDesktopCloseError(null);
    try {
      let saved = false;
      try {
        saved = await controller.save();
      } catch {
        await sendDesktopCloseDecision("cancel");
        setDesktopCloseError("保存に失敗しました。編集内容を保持しています。");
        return;
      }
      if (!saved) {
        await sendDesktopCloseDecision("cancel");
        setDesktopCloseError("保存に失敗しました。編集内容を保持しています。");
        return;
      }
      if (await sendDesktopCloseDecision("save")) {
        completeDesktopClose();
      } else {
        setDesktopCloseError("終了処理へ応答できませんでした。編集内容を保持しています。");
      }
    } finally {
      setDesktopCloseBusy(false);
    }
  }

  async function discardAndCloseDesktop() {
    const controller = getDesktopDirtyController();
    setDesktopCloseBusy(true);
    try {
      let discarded = true;
      try {
        discarded = controller?.discard?.() ?? true;
      } catch {
        discarded = false;
      }
      if (!discarded) {
        await sendDesktopCloseDecision("cancel");
        setDesktopCloseError(
          "保存中の変更を確認できませんでした。編集内容を保持しています。",
        );
        return;
      }
      if (await sendDesktopCloseDecision("discard")) {
        completeDesktopClose();
      } else {
        setDesktopCloseError("終了処理へ応答できませんでした。");
      }
    } finally {
      setDesktopCloseBusy(false);
    }
  }

  return (
    desktopCloseOpen && (
      <div
        className="desktop-close-dialog-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !desktopCloseBusy) {
            void cancelDesktopClose();
          }
        }}
      >
        <section
          ref={desktopCloseDialogRef}
          className="desktop-close-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-close-dialog-title"
          tabIndex={-1}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <h2 id="desktop-close-dialog-title">未保存の変更があります</h2>
          <p>終了する前に、編集中の内容をどうするか選択してください。</p>
          {desktopCloseError && (
            <p role="alert" className="desktop-close-dialog-error">
              {desktopCloseError}
            </p>
          )}
          <div className="desktop-close-dialog-actions">
            <button
              ref={saveButtonRef}
              type="button"
              disabled={desktopCloseBusy}
              onClick={() => void saveAndCloseDesktop()}
            >
              保存して終了
            </button>
            <button
              type="button"
              disabled={desktopCloseBusy}
              onClick={() => void discardAndCloseDesktop()}
            >
              保存せず終了
            </button>
            <button
              type="button"
              disabled={desktopCloseBusy}
              onClick={() => void cancelDesktopClose()}
            >
              戻る
            </button>
          </div>
        </section>
      </div>
    )
  );
}
