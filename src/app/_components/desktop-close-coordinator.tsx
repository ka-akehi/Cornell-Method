"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DESKTOP_CLOSE_REQUEST_EVENT,
  getDesktopDirtyController,
  sendDesktopCloseDecision,
} from "@/shared/desktop/desktop-close-bridge";

export function DesktopCloseCoordinator() {
  const [desktopCloseOpen, setDesktopCloseOpen] = useState(false);
  const [desktopCloseBusy, setDesktopCloseBusy] = useState(false);
  const [desktopCloseError, setDesktopCloseError] = useState<string | null>(
    null,
  );

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

  const cancelDesktopClose = useCallback(async () => {
    if (await sendDesktopCloseDecision("cancel")) {
      setDesktopCloseOpen(false);
    } else {
      setDesktopCloseError("終了処理へ応答できませんでした。");
    }
  }, []);

  useEffect(() => {
    if (!desktopCloseOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || desktopCloseBusy) {
        return;
      }
      event.preventDefault();
      void cancelDesktopClose();
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
        setDesktopCloseOpen(false);
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
        setDesktopCloseOpen(false);
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
          className="desktop-close-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-close-dialog-title"
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
