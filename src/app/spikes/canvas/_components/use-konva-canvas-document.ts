"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cloneCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  createCanvasHistory,
  redoCanvasHistory,
  pushCanvasHistory,
  undoCanvasHistory,
  type CanvasHistoryState,
} from "../_lib/canvas-history";

type CurrentRef<T> = { current: T };

type KonvaCanvasDocumentOptions = {
  initialDocument: CanvasDocumentV1;
  onDocumentChange?: (document: CanvasDocumentV1) => void;
};

export type KonvaCanvasDocumentController = {
  initialDocumentRef: CurrentRef<CanvasDocumentV1>;
  historyRef: CurrentRef<CanvasHistoryState>;
  applyDocumentRef: CurrentRef<(document: CanvasDocumentV1) => void>;
  commitRef: CurrentRef<(document: CanvasDocumentV1) => void>;
  history: CanvasHistoryState;
  documentJson: string;
  applyDocument: (document: CanvasDocumentV1) => void;
  restoreDocument: (document: CanvasDocumentV1, recordHistory: boolean) => void;
  undo: () => void;
  redo: () => void;
};

export function useKonvaCanvasDocument({
  initialDocument,
  onDocumentChange,
}: KonvaCanvasDocumentOptions): KonvaCanvasDocumentController {
  const [initialDocumentState] = useState(() => cloneCanvasDocument(initialDocument));
  const initialDocumentRef = useRef(initialDocumentState);
  const [history, setHistory] = useState<CanvasHistoryState>(() =>
    createCanvasHistory(initialDocumentState),
  );
  const historyRef = useRef<CanvasHistoryState>(history);
  const applyDocumentRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);
  const commitRef = useRef<(document: CanvasDocumentV1) => void>(() => undefined);

  const notifyDocument = useCallback(
    (document: CanvasDocumentV1) => onDocumentChange?.(cloneCanvasDocument(document)),
    [onDocumentChange],
  );

  const commitDocument = useCallback((document: CanvasDocumentV1) => {
    const next = pushCanvasHistory(historyRef.current, document);
    historyRef.current = next;
    setHistory(next);
    notifyDocument(next.present);
  }, [notifyDocument]);

  useEffect(() => {
    commitRef.current = commitDocument;
  }, [commitDocument]);

  const applyDocument = useCallback((document: CanvasDocumentV1) => {
    applyDocumentRef.current(document);
  }, []);

  const restoreDocument = useCallback(
    (document: CanvasDocumentV1, recordHistory: boolean) => {
      applyDocumentRef.current(document);
      const next = recordHistory
        ? pushCanvasHistory(historyRef.current, document)
        : createCanvasHistory(document);
      historyRef.current = next;
      setHistory(next);
      notifyDocument(next.present);
    },
    [notifyDocument],
  );

  const undo = useCallback(() => {
    const next = undoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
  }, [notifyDocument]);

  const redo = useCallback(() => {
    const next = redoCanvasHistory(historyRef.current);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
    applyDocumentRef.current(next.present);
    notifyDocument(next.present);
  }, [notifyDocument]);

  return {
    initialDocumentRef,
    historyRef,
    applyDocumentRef,
    commitRef,
    history,
    documentJson: serializeCanvasDocument(history.present),
    applyDocument,
    restoreDocument,
    undo,
    redo,
  };
}
