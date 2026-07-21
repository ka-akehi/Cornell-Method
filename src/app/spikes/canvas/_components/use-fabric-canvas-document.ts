"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  cloneCanvasDocument,
  createDemoCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  createCanvasHistory,
  redoCanvasHistory,
  undoCanvasHistory,
  pushCanvasHistory,
  type CanvasHistoryState,
} from "../_lib/canvas-history";

type DocumentChangeHandler = (document: CanvasDocumentV1) => void;

export type FabricCanvasDocumentController = {
  initialDocument: CanvasDocumentV1;
  history: CanvasHistoryState;
  applyDocumentRef: MutableRefObject<(document: CanvasDocumentV1) => void>;
  commitRef: MutableRefObject<DocumentChangeHandler>;
  restoreDocument: (document: CanvasDocumentV1, recordHistory: boolean) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
};

export function useFabricCanvasDocument(
  initialDocument: CanvasDocumentV1,
  onDocumentChange?: (document: CanvasDocumentV1) => void,
): FabricCanvasDocumentController {
  const [initialDocumentState] = useState(() =>
    cloneCanvasDocument(initialDocument),
  );
  const applyDocumentRef = useRef<(document: CanvasDocumentV1) => void>(
    () => undefined,
  );
  const commitRef = useRef<DocumentChangeHandler>(() => undefined);
  const [history, setHistory] = useState<CanvasHistoryState>(() =>
    createCanvasHistory(initialDocumentState),
  );
  const historyRef = useRef<CanvasHistoryState>(history);

  const notifyDocument = useCallback(
    (document: CanvasDocumentV1) =>
      onDocumentChange?.(cloneCanvasDocument(document)),
    [onDocumentChange],
  );

  const commit = useCallback(
    (document: CanvasDocumentV1) => {
      const next = pushCanvasHistory(historyRef.current, document);
      historyRef.current = next;
      setHistory(next);
      notifyDocument(next.present);
    },
    [notifyDocument],
  );
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

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

  const reset = useCallback(() => {
    restoreDocument(createDemoCanvasDocument(), false);
  }, [restoreDocument]);

  return {
    initialDocument: initialDocumentState,
    history,
    applyDocumentRef,
    commitRef,
    restoreDocument,
    undo,
    redo,
    reset,
  };
}
