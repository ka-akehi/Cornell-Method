"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import {
  restoreCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import {
  fabricCanvasToDocument,
  type FabricCanvasLike,
} from "../_lib/fabric-adapter";

type UseFabricCanvasRoundTripOptions = {
  canvasRef: MutableRefObject<FabricCanvasLike | null>;
  applyDocumentRef: MutableRefObject<(document: CanvasDocumentV1) => void>;
  restoreDocument: (document: CanvasDocumentV1, recordHistory: boolean) => void;
};

export function useFabricCanvasRoundTrip({
  canvasRef,
  applyDocumentRef,
  restoreDocument,
}: UseFabricCanvasRoundTripOptions) {
  const [roundTrip, setRoundTrip] = useState<string | null>(null);
  const [roundTripStatus, setRoundTripStatus] = useState("Round trip: not run");

  const saveRoundTrip = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const serialized = serializeCanvasDocument(fabricCanvasToDocument(canvas));
    const restored = restoreCanvasDocument(serialized);
    setRoundTrip(serialized);
    applyDocumentRef.current(restored);
    setRoundTripStatus(
      serializeCanvasDocument(restored) === serialized
        ? "Round trip: PASS (app JSON)"
        : "Round trip: FAIL",
    );
  }, [applyDocumentRef, canvasRef]);

  const restoreSavedRoundTrip = useCallback(() => {
    if (!roundTrip) return;
    const restored = restoreCanvasDocument(roundTrip);
    restoreDocument(restored, true);
    setRoundTripStatus("Round trip: restored saved JSON");
  }, [restoreDocument, roundTrip]);

  const clearRoundTrip = useCallback(() => {
    setRoundTrip(null);
    setRoundTripStatus("Round trip: not run");
  }, []);

  return {
    roundTrip,
    roundTripStatus,
    saveRoundTrip,
    restoreSavedRoundTrip,
    clearRoundTrip,
  };
}
