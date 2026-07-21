import {
  cloneCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocumentV1,
} from "./canvas-document";

export type CanvasHistoryState = {
  past: CanvasDocumentV1[];
  present: CanvasDocumentV1;
  future: CanvasDocumentV1[];
};

const MAX_HISTORY = 50;

export function createCanvasHistory(document: CanvasDocumentV1): CanvasHistoryState {
  return { past: [], present: cloneCanvasDocument(document), future: [] };
}

export function pushCanvasHistory(
  state: CanvasHistoryState,
  document: CanvasDocumentV1,
): CanvasHistoryState {
  const next = cloneCanvasDocument(document);
  if (serializeCanvasDocument(next) === serializeCanvasDocument(state.present)) {
    return state;
  }

  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

export function undoCanvasHistory(state: CanvasHistoryState) {
  const previous = state.past.at(-1);
  if (!previous) return state;

  return {
    past: state.past.slice(0, -1),
    present: cloneCanvasDocument(previous),
    future: [state.present, ...state.future].slice(0, MAX_HISTORY),
  };
}

export function redoCanvasHistory(state: CanvasHistoryState) {
  const next = state.future[0];
  if (!next) return state;

  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: cloneCanvasDocument(next),
    future: state.future.slice(1),
  };
}
