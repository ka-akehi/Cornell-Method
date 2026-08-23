"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  readUpdateStateSnapshot,
  requestManualUpdateCheck,
  type DesktopManualUpdateCheckResult,
  type DesktopUpdateStateSnapshot,
} from "@/shared/desktop/desktop-settings-bridge";
import { AppChromeIcon } from "../app-chrome-parts";
import styles from "./settings-modal.module.css";

const settingsCategories = [
  { id: "general", label: "General" },
  { id: "updates", label: "Updates" },
  { id: "data-and-backup", label: "Data and Backup" },
] as const;

type SettingsCategoryId = (typeof settingsCategories)[number]["id"];

const focusableSelector =
  "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      !element.hasAttribute("aria-hidden") && !element.closest("[hidden]"),
  );
}

function SettingsCategoryPanel({
  category,
  onClose,
}: {
  category: SettingsCategoryId;
  onClose: () => void;
}) {
  if (category === "updates") {
    return <UpdatesPanel />;
  }

  if (category === "data-and-backup") {
    return (
      <div className={styles.panelStack}>
        <p className={styles.panelKicker}>Data and Backup</p>
        <h3>データとバックアップ</h3>
        <p>
          Settings からのバックアップ、復元、削除操作は準備中です。現在の Web
          用バックアップ画面はそのまま利用できます。
        </p>
        <a className={styles.routeLink} href="/backup" onClick={onClose}>
          既存のバックアップ画面を開く
        </a>
      </div>
    );
  }

  return (
    <div className={styles.panelStack}>
      <p className={styles.panelKicker}>General</p>
      <h3>一般</h3>
      <p>この Alpha では変更できる一般設定はありません。</p>
      <dl className={styles.readOnlyList}>
        <div>
          <dt>利用形態</dt>
          <dd>ローカル利用</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>読み取り専用</dd>
        </div>
      </dl>
    </div>
  );
}

type UpdatePanelPhase = "loading" | "idle" | "checking" | "resolved";
type UpdatePanelResultKind = DesktopManualUpdateCheckResult["kind"] | null;

type UpdatePanelState = {
  phase: UpdatePanelPhase;
  resultKind: UpdatePanelResultKind;
  snapshot: DesktopUpdateStateSnapshot | null;
};

const initialUpdatePanelState: UpdatePanelState = {
  phase: "loading",
  resultKind: null,
  snapshot: null,
};

function resultKindForSnapshot(
  snapshot: DesktopUpdateStateSnapshot,
): UpdatePanelResultKind {
  if (snapshot.status === "available" && snapshot.failure !== null) {
    return "failed";
  }

  switch (snapshot.status) {
    case "no-update":
      return "no-update";
    case "available":
      return "available";
    case "failed":
      return "failed";
    case "checking":
      return "already-checking";
    case "not-checked":
      return null;
  }
}

function verificationStatusMessage(
  verificationState: NonNullable<
    DesktopUpdateStateSnapshot["pendingUpdate"]
  >["verificationState"],
) {
  switch (verificationState) {
    case "verified":
      return "検証済みの更新候補です。";
    case "failed":
      return "更新候補の検証に失敗しました。";
    case "not-verified":
      return "署名検証前 / 未検証です。";
  }
}

function UpdatesPanel() {
  const [updateState, setUpdateState] = useState<UpdatePanelState>(
    initialUpdatePanelState,
  );

  useEffect(() => {
    let isMounted = true;

    void readUpdateStateSnapshot().then((result) => {
      if (!isMounted) {
        return;
      }

      if (result.kind === "snapshot") {
        setUpdateState({
          phase: "idle",
          resultKind: resultKindForSnapshot(result.snapshot),
          snapshot: result.snapshot,
        });
        return;
      }

      setUpdateState({
        phase: "idle",
        resultKind: result.kind,
        snapshot: null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleManualUpdateCheck = async () => {
    if (
      updateState.phase === "loading" ||
      updateState.phase === "checking" ||
      updateState.resultKind === "unsupported-web"
    ) {
      return;
    }

    setUpdateState((current) => ({
      phase: "checking",
      resultKind: null,
      snapshot: current.snapshot,
    }));

    const result = await requestManualUpdateCheck();

    if (result.kind === "unsupported-web") {
      setUpdateState((current) => ({
        ...current,
        phase: "resolved",
        resultKind: result.kind,
      }));
      return;
    }

    if ("response" in result) {
      setUpdateState({
        phase: "resolved",
        resultKind: result.kind,
        snapshot: result.response.state,
      });
      return;
    }

    setUpdateState((current) => ({
      ...current,
      phase: "resolved",
      resultKind: result.kind,
    }));
  };

  const isReading = updateState.phase === "loading";
  const isChecking = updateState.phase === "checking";
  const isUnsupported = updateState.resultKind === "unsupported-web";
  const isCheckDisabled = isReading || isChecking || isUnsupported;
  const pendingVersion = updateState.snapshot?.pendingUpdate?.version;
  const verificationState = updateState.snapshot?.pendingUpdate?.verificationState;

  let statusMessage: ReactNode = null;
  let statusRole: "status" | "alert" = "status";
  let statusClassName = styles.updateStatus;

  if (isReading) {
    statusMessage = "更新状態を読み込み中…";
  } else if (isChecking) {
    statusMessage = "確認中…";
  } else {
    switch (updateState.resultKind) {
      case "no-update":
        statusMessage = "利用可能な更新はありません";
        break;
      case "available":
        statusMessage = (
          <>
            <p>互換 manifest を発見しました。</p>
            {pendingVersion ? (
              <p className={styles.updateVersion}>
                利用可能なバージョン: {pendingVersion}
              </p>
            ) : (
              <p>利用可能なバージョン情報を表示できません。</p>
            )}
            {verificationState ? (
              <p>{verificationStatusMessage(verificationState)}</p>
            ) : null}
          </>
        );
        break;
      case "failed":
        statusMessage = (
          <>
            <p>更新情報を確認できませんでした。もう一度お試しください。</p>
            {pendingVersion ? (
              <p className={styles.updateVersion}>
                保留中のバージョン: {pendingVersion}
              </p>
            ) : null}
            {verificationState ? (
              <p>{verificationStatusMessage(verificationState)}</p>
            ) : null}
          </>
        );
        statusRole = "alert";
        statusClassName = `${styles.updateStatus} ${styles.updateStatusError}`;
        break;
      case "suppressed":
        statusMessage = "今回は確認を実行しませんでした。";
        break;
      case "already-checking":
        statusMessage = "別の更新確認が進行中です。";
        break;
      case "unsupported-web":
        statusMessage = "Desktop アプリでのみ利用できます。";
        break;
      case "command-error":
        statusMessage = "更新確認を実行できませんでした。もう一度お試しください。";
        statusRole = "alert";
        statusClassName = `${styles.updateStatus} ${styles.updateStatusError}`;
        break;
      case "state-error":
        statusMessage = "更新状態を読み取れませんでした。もう一度お試しください。";
        statusRole = "alert";
        statusClassName = `${styles.updateStatus} ${styles.updateStatusError}`;
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.panelStack}>
      <p className={styles.panelKicker}>Updates</p>
      <h3>更新</h3>
      <p>利用可能な更新があるか、手動で確認できます。</p>
      <div className={styles.updateControls}>
        <button
          type="button"
          className={styles.updateCheckButton}
          disabled={isCheckDisabled}
          aria-busy={isChecking}
          onClick={() => void handleManualUpdateCheck()}
        >
          更新を確認
        </button>
        {statusMessage !== null &&
          (statusRole === "alert" ? (
            <div className={statusClassName} role="alert">
              {statusMessage}
            </div>
          ) : (
            <div className={statusClassName} role="status">
              {statusMessage}
            </div>
          ))}
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<
    Record<SettingsCategoryId, HTMLButtonElement | null>
  >({
    general: null,
    updates: null,
    "data-and-backup": null,
  });
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategoryId>("general");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);
    (closeButtonRef.current ?? focusableElements[0] ?? dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusableElements = getFocusableElements(dialog);
      if (currentFocusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstFocusableElement = currentFocusableElements[0];
      const lastFocusableElement =
        currentFocusableElements[currentFocusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!currentFocusableElements.includes(activeElement as HTMLElement)) {
        event.preventDefault();
        firstFocusableElement.focus();
      } else if (
        event.shiftKey &&
        activeElement === firstFocusableElement
      ) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (
        !event.shiftKey &&
        activeElement === lastFocusableElement
      ) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    categoryId: SettingsCategoryId,
  ) => {
    const currentIndex = settingsCategories.findIndex(
      (category) => category.id === categoryId,
    );
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % settingsCategories.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + settingsCategories.length) %
        settingsCategories.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = settingsCategories.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextCategory = settingsCategories[nextIndex];
    setActiveCategory(nextCategory.id);
    tabRefs.current[nextCategory.id]?.focus();
  };

  const modal = (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        aria-describedby="settings-modal-description"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Settings</p>
            <h2 id="settings-modal-title">設定</h2>
            <p id="settings-modal-description" className={styles.description}>
              アプリの設定を確認できます。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="設定を閉じる"
            onClick={onClose}
          >
            <AppChromeIcon name="close" className={styles.closeIcon} />
          </button>
        </header>

        <div className={styles.body}>
          <div
            className={styles.categoryNavigation}
            role="tablist"
            aria-label="設定カテゴリ"
          >
            {settingsCategories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  ref={(element) => {
                    tabRefs.current[category.id] = element;
                  }}
                  type="button"
                  className={styles.tab}
                  role="tab"
                  id={`settings-tab-${category.id}`}
                  aria-selected={isActive}
                  aria-controls={`settings-panel-${category.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveCategory(category.id)}
                  onKeyDown={(event) =>
                    handleTabKeyDown(event, category.id)
                  }
                >
                  {category.label}
                </button>
              );
            })}
          </div>

          <div className={styles.panelRegion}>
            {settingsCategories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <div
                  key={category.id}
                  id={`settings-panel-${category.id}`}
                  className={styles.panel}
                  role="tabpanel"
                  aria-labelledby={`settings-tab-${category.id}`}
                  tabIndex={isActive ? 0 : -1}
                  hidden={!isActive}
                >
                  <SettingsCategoryPanel
                    category={category.id}
                    onClose={onClose}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );

  if (typeof document === "undefined" || !document.body) {
    return null;
  }

  return createPortal(modal, document.body);
}
