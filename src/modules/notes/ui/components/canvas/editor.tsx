"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  cloneCanvasDocument,
  createCanvasHistory,
  pushCanvasHistory,
  redoCanvasHistory,
  type CanvasDocumentV1,
  type CanvasPageDimensions,
  undoCanvasHistory,
  type CanvasHistoryState,
} from "@/shared/canvas";
import {
  CANVAS_MAX_FONT_SIZE,
  CANVAS_MAX_STROKE_WIDTH,
  CANVAS_MIN_FONT_SIZE,
  CANVAS_MIN_STROKE_WIDTH,
  type CanvasStyleChange,
  type CanvasStyleControlValues,
  type CanvasStyleTarget,
  type NoteCanvasEditorProps,
  type SelectedCanvasStyle,
} from "@/modules/notes/ui/canvas";
import type {
  CanvasNoteTool,
  CanvasStyleDefaults,
} from "@/modules/notes/lib/canvas-editor-types";
import {
  EMPTY_CANVAS_DOCUMENT,
  extractCanvasEditorText,
  withoutEmptyTextElements,
} from "@/modules/notes/lib/canvas-editor-document";
import {
  INITIAL_STYLE_DEFAULTS,
  getDrawingStyleTarget,
  isCanvasTextAlign,
  isColorInputValue,
} from "@/modules/notes/ui/canvas";
import { useNoteCanvasRuntime } from "@/modules/notes/ui/hooks";
import { NoteCanvasSurface } from "./surface";
import { NoteCanvasToolbar } from "./toolbar";

export function NoteCanvasEditor({
  initialDocument,
  initialTool = "select",
  apiError,
  externalError,
  onDocumentChange,
  onError,
}: NoteCanvasEditorProps) {
  const [initialDocumentSnapshot] = useState<CanvasDocumentV1 | null>(() => {
    if (!initialDocument) {
      return null;
    }
    try {
      return cloneCanvasDocument(initialDocument);
    } catch {
      return null;
    }
  });

  const initialDocumentError = !initialDocument
    ? "Canvas documentを読み込めないため編集できません。"
    : initialDocumentSnapshot === null
      ? "Canvas documentが壊れているため編集できません。保存済みデータは変更されていません。"
      : null;
  const validInitialDocument = initialDocumentSnapshot ?? EMPTY_CANVAS_DOCUMENT;

  const viewportRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<CanvasNoteTool>(initialTool);
  const styleDefaultsRef = useRef<CanvasStyleDefaults>(INITIAL_STYLE_DEFAULTS);
  const selectedStyleRef = useRef<SelectedCanvasStyle | null>(null);
  const historyRef = useRef<CanvasHistoryState>(createCanvasHistory(validInitialDocument));
  const commitRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);

  const [history, setHistory] = useState<CanvasHistoryState>(() =>
    createCanvasHistory(validInitialDocument),
  );
  const [tool, setTool] = useState<CanvasNoteTool>(initialTool);
  const [styleDefaults, setStyleDefaults] = useState<CanvasStyleDefaults>(
    INITIAL_STYLE_DEFAULTS,
  );
  const [selectedStyle, setSelectedStyle] = useState<SelectedCanvasStyle | null>(null);
  const [shapeTextEditingStyle, setShapeTextEditingStyle] =
    useState<CanvasStyleControlValues | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(initialDocumentError);

  const pageWidth = history.present.page.width;
  const pageHeight = history.present.page.height;

  const reportError = useCallback(
    (message: string | null) => {
      setCanvasError(message);
      onError?.(message);
    },
    [onError],
  );

  const notifyDocument = useCallback(
    (document: CanvasDocumentV1) => onDocumentChange(cloneCanvasDocument(document)),
    [onDocumentChange],
  );

  const runtime = useNoteCanvasRuntime({
    initialDocument: initialDocumentSnapshot,
    pageDimensions: history.present.page,
    tool,
    setTool,
    styleDefaults,
    toolRef,
    styleDefaultsRef,
    selectedStyleRef,
    getCurrentDocument: () => historyRef.current.present,
    notifyDocument,
    commitDocument: (document) => commitRef.current(document),
    reportError,
    setSelectedStyle,
    setStyleDefaults,
    setShapeTextEditingStyle,
  });
  const {
    surfaceRef,
    canvasElementRef,
    applyDocumentRef,
    flushShapeTextEditRef,
    ready,
    applyStyleChange: applyRuntimeStyleChange,
    deleteActiveObject: deleteActiveCanvasObject,
    discardActiveObject,
    isTextEditing,
  } = runtime;

  useLayoutEffect(() => {
    toolRef.current = tool;
    styleDefaultsRef.current = styleDefaults;
    selectedStyleRef.current = selectedStyle;
    historyRef.current = history;
    commitRef.current = (document) => {
      try {
        const next = pushCanvasHistory(
          historyRef.current,
          withoutEmptyTextElements(document),
        );
        historyRef.current = next;
        setHistory(next);
        notifyDocument(next.present);
        reportError(null);
      } catch (error) {
        reportError(
          error instanceof Error && error.message
            ? error.message
            : "Canvas documentを保存できる状態にできません。",
        );
        applyDocumentRef.current(historyRef.current.present);
      }
    };
  }, [
    applyDocumentRef,
    history,
    notifyDocument,
    reportError,
    selectedStyle,
    styleDefaults,
    tool,
  ]);

  const undo = useCallback(() => {
    flushShapeTextEditRef.current();
    const next = undoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    setSelectedStyle(null);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [applyDocumentRef, flushShapeTextEditRef, notifyDocument, reportError]);

  const redo = useCallback(() => {
    flushShapeTextEditRef.current();
    const next = redoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    setSelectedStyle(null);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
    reportError(null);
  }, [applyDocumentRef, flushShapeTextEditRef, notifyDocument, reportError]);

  const handleStyleChange = useCallback(
    (change: CanvasStyleChange) => {
      if (
        (change.strokeWidth !== undefined &&
          (!Number.isInteger(change.strokeWidth) ||
            change.strokeWidth < CANVAS_MIN_STROKE_WIDTH ||
            change.strokeWidth > CANVAS_MAX_STROKE_WIDTH)) ||
        (change.fontSize !== undefined &&
          (!Number.isInteger(change.fontSize) ||
            change.fontSize < CANVAS_MIN_FONT_SIZE ||
            change.fontSize > CANVAS_MAX_FONT_SIZE)) ||
        (change.color !== undefined && !isColorInputValue(change.color)) ||
        (change.textAlign !== undefined && !isCanvasTextAlign(change.textAlign))
      ) {
        return;
      }
      applyRuntimeStyleChange(change);
    },
    [applyRuntimeStyleChange],
  );

  const deleteActiveObject = useCallback(
    () => deleteActiveCanvasObject(),
    [deleteActiveCanvasObject],
  );

  const applyPageDimensions = useCallback(
    (dimensions: CanvasPageDimensions) => {
      flushShapeTextEditRef.current();
      const previousPresent = historyRef.current.present;
      setSelectedStyle(null);
      commitRef.current({
        ...previousPresent,
        page: { ...previousPresent.page, ...dimensions },
      });

      if (historyRef.current.present !== previousPresent) {
        applyDocumentRef.current(historyRef.current.present);
      }
    },
    [applyDocumentRef, flushShapeTextEditRef],
  );

  const focusViewportWithoutScroll = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isTextEditing()) return;

      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (!modifier && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        deleteActiveObject();
      }
    },
    [deleteActiveObject, isTextEditing, redo, undo],
  );

  const documentText = extractCanvasEditorText(history.present);
  const selectedForControls = tool === "select" ? selectedStyle : null;
  const styleTarget: CanvasStyleTarget = shapeTextEditingStyle
    ? "text"
    : selectedForControls
      ? selectedForControls.elementType === "text"
        ? "text"
        : "stroke"
      : getDrawingStyleTarget(tool);
  const styleValues: CanvasStyleControlValues = shapeTextEditingStyle
    ? shapeTextEditingStyle
    : selectedForControls
      ? {
          strokeWidth: selectedForControls.strokeWidth,
          color: selectedForControls.color,
          fontSize: selectedForControls.fontSize,
          textAlign: selectedForControls.textAlign,
        }
      : {
          strokeWidth: styleDefaults.strokeWidth,
          color:
            styleTarget === "text" ? styleDefaults.textColor : styleDefaults.strokeColor,
          fontSize: styleDefaults.fontSize,
          textAlign: styleDefaults.textAlign,
        };

  const handleToolChange = useCallback(
    (nextTool: CanvasNoteTool) => {
      flushShapeTextEditRef.current();
      setTool(nextTool);
      if (nextTool !== "select") {
        setSelectedStyle(null);
        discardActiveObject();
      }
    },
    [discardActiveObject, flushShapeTextEditRef],
  );

  return (
    <div className="note-canvas-editor" aria-label="Canvas本文の編集領域">
      <NoteCanvasToolbar
        tool={tool}
        onToolChange={handleToolChange}
        pageDimensions={history.present.page}
        onPageDimensionsChange={applyPageDimensions}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={undo}
        onRedo={redo}
        styleTarget={styleTarget}
        styleValues={styleValues}
        onStyleChange={handleStyleChange}
      />

      {(canvasError || externalError || apiError) && (
        <p className="note-canvas-error" role="alert">
          {canvasError ?? externalError ?? apiError}
        </p>
      )}

      {initialDocumentSnapshot !== null && (
        <NoteCanvasSurface
          mode="editor"
          pageDimensions={history.present.page}
          viewportRef={viewportRef}
          surfaceRef={surfaceRef}
          canvasElementRef={canvasElementRef}
          dataTool={tool}
          tabIndex={0}
          onPointerDown={focusViewportWithoutScroll}
          onKeyDown={handleKeyDown}
          viewportAriaLabel="Canvas本文。CanvasにフォーカスしてCtrlまたはCmdのUndo、Redo、削除を使用できます。"
          canvasAriaLabel={`${pageWidth} x ${pageHeight} のCanvas本文`}
        />
      )}

      <p className="note-canvas-assistive-text">
        {ready ? "Canvasを編集できます。" : "Canvasを準備しています。"}
        {` 用紙サイズ: ${pageWidth} x ${pageHeight} px.`}
        {documentText ? ` テキスト要素: ${documentText}` : " テキスト要素はありません。"}
      </p>
    </div>
  );
}
