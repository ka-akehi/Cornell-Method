"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createDemoCanvasDocument,
  extractCanvasSearchText,
  type CanvasDocumentV1,
} from "@/shared/canvas";
import { FabricCanvasPanel } from "./fabric-canvas-panel";
import { KonvaCanvasPanel } from "./konva-canvas-panel";

export function CanvasSpikePage() {
  const initialDocument = useMemo(() => createDemoCanvasDocument(), []);
  const [fabricDocument, setFabricDocument] = useState<CanvasDocumentV1>(initialDocument);
  const [konvaDocument, setKonvaDocument] = useState<CanvasDocumentV1>(initialDocument);

  return (
    <div className="canvas-spike-page">
      <header className="canvas-spike-page-header">
        <div>
          <p className="canvas-spike-eyebrow">隔離技術 spike · /spikes/canvas</p>
          <h1>Fixed-page canvas library comparison</h1>
          <p>
            Fabric.js と Konva を同じ CanvasDocumentV1 fixture で操作する比較用画面です。
            既存の NoteEditor、API、Prisma、DB には接続していません。
          </p>
        </div>
        <Link href="/notes" className="canvas-spike-back-link">
          ノート一覧へ戻る
        </Link>
      </header>

      <section className="canvas-spike-contract" aria-labelledby="canvas-contract-title">
        <div>
          <p className="canvas-spike-eyebrow">App-owned persistence contract</p>
          <h2 id="canvas-contract-title">CanvasDocumentV1</h2>
          <p>
            ライブラリ内部 JSON は保存せず、固定ページ、要素、style、z、stroke points、plain text
            だけを JSON に投影します。selection、camera、history、pointer state は保存しません。
          </p>
        </div>
        <dl className="canvas-spike-contract-list">
          <div>
            <dt>schema</dt>
            <dd>1</dd>
          </div>
          <div>
            <dt>page</dt>
            <dd>1200 × 800</dd>
          </div>
          <div>
            <dt>fixture searchText</dt>
            <dd>{extractCanvasSearchText(initialDocument)}</dd>
          </div>
        </dl>
      </section>

      <div className="canvas-spike-panels">
        <FabricCanvasPanel initialDocument={initialDocument} onDocumentChange={setFabricDocument} />
        <KonvaCanvasPanel initialDocument={initialDocument} onDocumentChange={setKonvaDocument} />
      </div>

      <section className="canvas-spike-observations" aria-labelledby="comparison-title">
        <div className="canvas-spike-section-heading">
          <div>
            <p className="canvas-spike-eyebrow">POC checklist</p>
            <h2 id="comparison-title">比較観点</h2>
          </div>
          <p>
            2 枚の Canvas は同じ fixture から開始します。各 panel の状態は独立し、画面内の
            Save → restore test で app-owned JSON の round trip を確認できます。
          </p>
        </div>
        <div className="canvas-spike-comparison-grid">
          <div>
            <h3>共通操作</h3>
            <ul>
              <li>freehand stroke / line / arrow / rectangle / ellipse / plain text</li>
              <li>single select / move / resize / Delete / object erase</li>
              <li>Undo / Redo、Cmd/Ctrl+Z、Fit / 50% / 100% / 200%</li>
              <li>Pointer Events と touch-action none を client-only 境界で確認</li>
            </ul>
          </div>
          <div>
            <h3>読み取り用 projection</h3>
            <dl className="canvas-spike-live-projection">
              <div>
                <dt>Fabric elements</dt>
                <dd>{fabricDocument.elements.length}</dd>
              </div>
              <div>
                <dt>Konva elements</dt>
                <dd>{konvaDocument.elements.length}</dd>
              </div>
              <div>
                <dt>Fabric searchText</dt>
                <dd>{extractCanvasSearchText(fabricDocument) || "(empty)"}</dd>
              </div>
              <div>
                <dt>Konva searchText</dt>
                <dd>{extractCanvasSearchText(konvaDocument) || "(empty)"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="canvas-spike-notes" aria-labelledby="spike-notes-title">
        <h2 id="spike-notes-title">Scope notes</h2>
        <p>
          これは次の hybrid Canvas 実装に接続する前の比較用です。Markdown 本文の変換、保存 API、
          Prisma migration、autosave、PDF export、画像 asset、pixel eraser は含みません。
        </p>
        <p>
          100% / 200% は bounded viewport 内でページをスクロール表示します。Fit はページ全体を
          表示し、画面全体の横 overflow を作らないことを確認するためのモードです。
        </p>
      </section>
    </div>
  );
}
