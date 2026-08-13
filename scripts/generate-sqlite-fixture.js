/* eslint-disable @typescript-eslint/no-require-imports -- This is a local operator CLI. */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const typescript = require("typescript");
const Database = require("better-sqlite3");
const dotenv = require("dotenv");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma", "migrations");
const DEFAULT_COUNT = 10_000;
const DEFAULT_SEED = "cornell-method-fixture-v1";
const SQLITE_EXTENSIONS = new Set([".db", ".sqlite", ".sqlite3"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const FIXTURE_END_DATE_MS = Date.UTC(2025, 11, 31);
const CANVAS_PAGE_WIDTH = 1200;
const CANVAS_PAGE_HEIGHT = 800;

const SOURCE_TYPES = ["book", "lecture", "video", "article", "other"];
const SOURCE_CATALOG = {
  book: ["学習ノートの教科書", "実践で学ぶ設計", "知識をつなぐ入門書"],
  lecture: ["社内講義", "公開セミナー", "読書会の講義"],
  video: ["技術解説動画", "カンファレンス動画", "短編チュートリアル"],
  article: ["技術記事", "調査レポート", "公式ドキュメント"],
  other: ["個人メモ", "実験ログ", "会話から得た気づき"],
};
const TOPICS = [
  { name: "データ設計", keyword: "schema", verbs: ["分解する", "比較する", "検証する"] },
  { name: "検索性能", keyword: "index", verbs: ["測定する", "改善する", "観察する"] },
  { name: "認知負荷", keyword: "learning", verbs: ["整理する", "要約する", "適用する"] },
  { name: "文章構成", keyword: "outline", verbs: ["構造化する", "言い換える", "評価する"] },
  { name: "ソフトウェア設計", keyword: "boundary", verbs: ["切り分ける", "設計する", "反証する"] },
  { name: "テスト戦略", keyword: "coverage", verbs: ["再現する", "確認する", "自動化する"] },
  { name: "時間管理", keyword: "focus", verbs: ["記録する", "振り返る", "調整する"] },
  { name: "統計の基礎", keyword: "variance", verbs: ["推定する", "比較する", "解釈する"] },
  { name: "チーム協働", keyword: "feedback", verbs: ["共有する", "合意する", "改善する"] },
  { name: "問題解決", keyword: "hypothesis", verbs: ["仮説化する", "試す", "修正する"] },
  { name: "読解", keyword: "context", verbs: ["照合する", "要約する", "問い直す"] },
  { name: "プロダクト判断", keyword: "tradeoff", verbs: ["比較する", "選択する", "記録する"] },
];
const TITLE_ADJECTIVES = [
  "基礎から見直す",
  "実例で考える",
  "問いを深める",
  "小さく試す",
  "関連づけて学ぶ",
  "判断を記録する",
];
const CANVAS_LABELS = ["要点", "問い", "比較", "例", "確認", "次の一歩", "反証", "まとめ"];
const CANVAS_COLORS = ["#2f5544", "#98492c", "#496b8a", "#7b5a8e", "#6b6b3c"];
const TAG_CATALOG = [
  ["fixture-設計", "#2f5544"],
  ["fixture-検索", "#496b8a"],
  ["fixture-学習", "#7b5a8e"],
  ["fixture-文章", "#98492c"],
  ["fixture-テスト", "#6b6b3c"],
  ["fixture-読書", "#2f5544"],
  ["fixture-講義", "#496b8a"],
  ["fixture-動画", "#7b5a8e"],
  ["fixture-記事", "#98492c"],
  ["fixture-復習", "#6b6b3c"],
  ["fixture-重要", "#98492c"],
  ["fixture-実験", "#2f5544"],
  ["fixture-仕事", "#496b8a"],
  ["fixture-個人", "#7b5a8e"],
  ["fixture-要約", "#98492c"],
  ["fixture-問い", "#6b6b3c"],
  ["fixture-実践", "#2f5544"],
  ["fixture-記録", "#496b8a"],
  ["fixture-比較", "#7b5a8e"],
  ["fixture-概念", "#98492c"],
  ["fixture-技術", "#6b6b3c"],
  ["fixture-振り返り", "#2f5544"],
  ["fixture-計画", "#496b8a"],
  ["fixture-成果", "#7b5a8e"],
].map(([name, color], index) => ({
  id: `fixture-tag-${String(index + 1).padStart(2, "0")}`,
  name,
  color,
}));

function installTypeScriptRequireHook() {
  require.extensions[".ts"] = function loadTypeScript(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const output = typescript.transpileModule(source, {
      compilerOptions: {
        isolatedModules: true,
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.Node10,
        target: typescript.ScriptTarget.ES2020,
      },
      fileName: filename,
    }).outputText;

    module._compile(output, filename);
  };
}

installTypeScriptRequireHook();

const {
  restoreCanvasDocument,
  serializeCanvasDocument,
} = require(path.join(
  PROJECT_ROOT,
  "src",
  "shared",
  "canvas",
  "canvas-document-serialization.ts",
));
const { extractCanvasSearchText: extractSearchText } = require(path.join(
  PROJECT_ROOT,
  "src",
  "shared",
  "canvas",
  "canvas-document-search.ts",
));

function printHelp() {
  console.log(`Usage: npm run fixture:generate -- [options]

Options:
  --count N       number of notebooks to create (default: ${DEFAULT_COUNT})
  --output PATH   SQLite output path; a new file is required and existing files are never overwritten
  --seed VALUE    deterministic content seed (default: ${DEFAULT_SEED})
  --help          show this help

Safety:
  Without --output, a new SQLite file is created under the operating system temporary directory.
  The command does not load or connect to DATABASE_URL, refuses the live prisma/dev.db path,
  and does not provide an overwrite option. Use an isolated path such as /tmp/cornell-fixture.sqlite.

The command applies the existing prisma/migrations SQLite schema, writes CanvasDocumentV1 data,
and validates every generated canvas and relation by reading the output database back.`);
}

function parseArguments(argv) {
  const result = {
    count: DEFAULT_COUNT,
    seed: DEFAULT_SEED,
    output: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf("=");
    const option = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);

    if (option === "--help" || option === "-h") {
      result.help = true;
      continue;
    }

    if (!["--count", "--output", "--seed"].includes(option)) {
      throw new Error(`未対応のオプションです: ${option}`);
    }

    const value = inlineValue === undefined ? argv[++index] : inlineValue;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${option} の値が必要です`);
    }

    if (option === "--count") {
      if (!/^\d+$/.test(value) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
        throw new Error("--count は1以上の整数で指定してください");
      }
      result.count = Number(value);
    } else if (option === "--output") {
      result.output = value;
    } else {
      result.seed = value;
    }
  }

  return result;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashString(seed) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function pick(random, values) {
  return values[integer(random, 0, values.length - 1)];
}

function isoDate(dateMs) {
  return new Date(dateMs).toISOString().slice(0, 10);
}

function isoDateTime(dateMs) {
  return new Date(dateMs).toISOString();
}

function dateForNotebook(count, index) {
  return FIXTURE_END_DATE_MS - (count - index - 1) * DAY_MS;
}

function sqlitePathFromDatabaseUrl(databaseUrl) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    return [];
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (!rawPath || rawPath === ":memory:" || rawPath.includes("?") || rawPath.includes("#")) {
    return [];
  }

  if (path.isAbsolute(rawPath)) {
    return [path.resolve(rawPath)];
  }

  return [
    path.resolve(PROJECT_ROOT, rawPath),
    path.resolve(PROJECT_ROOT, "prisma", rawPath),
  ];
}

function configuredLiveSqlitePaths() {
  const databaseUrls = [process.env.DATABASE_URL];
  const envPath = path.join(PROJECT_ROOT, ".env");

  if (fs.existsSync(envPath)) {
    const parsedEnv = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    databaseUrls.push(parsedEnv.DATABASE_URL);
  }

  return new Set([
    path.resolve(PROJECT_ROOT, "prisma", "dev.db"),
    ...databaseUrls.flatMap(sqlitePathFromDatabaseUrl),
  ]);
}

function assertOutputPathIsSafe(outputPath) {
  const resolvedOutput = path.resolve(outputPath);
  const extension = path.extname(resolvedOutput).toLowerCase();
  if (!SQLITE_EXTENSIONS.has(extension)) {
    throw new Error("--output は .db、.sqlite、または .sqlite3 で終わるSQLiteファイルを指定してください");
  }

  const parentPath = path.dirname(resolvedOutput);
  if (!fs.existsSync(parentPath) || !fs.statSync(parentPath).isDirectory()) {
    throw new Error(`--output の親ディレクトリが存在しません: ${parentPath}`);
  }

  const canonicalParent = fs.realpathSync(parentPath);
  const canonicalOutput = path.join(canonicalParent, path.basename(resolvedOutput));
  const livePaths = configuredLiveSqlitePaths();
  const canonicalLivePaths = new Set(
    [...livePaths].map((livePath) => {
      try {
        return fs.realpathSync(livePath);
      } catch {
        return path.resolve(livePath);
      }
    }),
  );

  if (livePaths.has(resolvedOutput) || canonicalLivePaths.has(canonicalOutput)) {
    throw new Error("--output に live SQLite（prisma/dev.db または DATABASE_URL の SQLite path）は指定できません");
  }

  if (fs.existsSync(resolvedOutput)) {
    throw new Error(`--output は既存ファイルを上書きできません: ${resolvedOutput}`);
  }

  return resolvedOutput;
}

function resolveOutputPath(outputArgument) {
  if (outputArgument !== undefined) {
    if (outputArgument.startsWith("file:")) {
      throw new Error("--output は file: URL ではなく filesystem path を指定してください");
    }
    return assertOutputPathIsSafe(outputArgument);
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "cornell-method-fixture-"));
  const defaultOutput = path.join(temporaryDirectory, "fixture.sqlite");
  return assertOutputPathIsSafe(defaultOutput);
}

function claimNewOutputFile(outputPath) {
  let descriptor;
  try {
    descriptor = fs.openSync(outputPath, "wx");
    fs.closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error(`--output は既存ファイルを上書きできません: ${outputPath}`);
    }
    throw error;
  }
}

function removeClaimedOutput(outputPath) {
  for (const candidate of [outputPath, `${outputPath}-journal`, `${outputPath}-wal`, `${outputPath}-shm`]) {
    try {
      fs.unlinkSync(candidate);
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
}

function applyCurrentMigrations(db) {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = DELETE");
  db.pragma("synchronous = NORMAL");

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((entry) => {
      const migrationDirectory = path.join(MIGRATIONS_DIR, entry);
      return fs.statSync(migrationDirectory).isDirectory();
    })
    .map((entry) => path.join(MIGRATIONS_DIR, entry, "migration.sql"))
    .filter((migrationPath) => fs.existsSync(migrationPath))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error(`SQLite migration が見つかりません: ${MIGRATIONS_DIR}`);
  }

  for (const migrationPath of migrationFiles) {
    db.exec(fs.readFileSync(migrationPath, "utf8"));
  }

  db.pragma("foreign_keys = ON");
}

function randomBounds(random, pageWidth, pageHeight, minimumWidth, maximumWidth, minimumHeight, maximumHeight) {
  const width = integer(random, minimumWidth, Math.min(maximumWidth, pageWidth - 80));
  const height = integer(random, minimumHeight, Math.min(maximumHeight, pageHeight - 80));
  return {
    x: integer(random, 40, pageWidth - width - 40),
    y: integer(random, 40, pageHeight - height - 40),
    width,
    height,
  };
}

function buildCanvasText(random, topic, noteDate, title, index, label) {
  const sentences = [
    `${label}: ${topic.name}を${pick(random, topic.verbs)}。`,
    `関連語は${topic.keyword}、記録番号は${String(index + 1).padStart(5, "0")}。`,
    `確認日 ${noteDate}。${title}の要点をあとで説明できる形にする。`,
    `次に試すことを一つ選び、結果を短く比較する。`,
  ];
  return sentences.slice(0, integer(random, 1, sentences.length)).join(" ");
}

function createCanvasElement(random, elementIndex, pageWidth, pageHeight, topic, noteDate, title, index) {
  const bounds = randomBounds(random, pageWidth, pageHeight, 120, 420, 42, 132);
  const rotation = integer(random, -5, 5);
  const z = elementIndex;
  const id = `fixture-canvas-${String(index + 1).padStart(5, "0")}-element-${String(elementIndex + 1).padStart(2, "0")}`;
  const color = pick(random, CANVAS_COLORS);
  const base = {
    id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation,
    style: { stroke: color, strokeWidth: integer(random, 2, 5) },
    z,
  };

  if (elementIndex === 0) {
    return {
      ...base,
      type: "text",
      text: `${title} / ${noteDate}`,
      style: {
        ...base.style,
        fill: pick(random, CANVAS_COLORS),
        fontSize: integer(random, 18, 32),
        fontFamily: "Arial, sans-serif",
        textAlign: pick(random, ["left", "center", "right"]),
      },
    };
  }

  if (elementIndex === 1 || elementIndex % 4 === 0) {
    const type = elementIndex % 8 === 0 ? "ellipse" : "rect";
    return {
      ...base,
      type,
      text: buildCanvasText(random, topic, noteDate, title, index, pick(random, CANVAS_LABELS)),
      style: {
        ...base.style,
        fill: type === "ellipse" ? "#fff2df" : "#e8f0e7",
      },
      textStyle: {
        fill: "#25302e",
        fontSize: integer(random, 14, 24),
        fontFamily: "Arial, sans-serif",
        textAlign: pick(random, ["left", "center", "right"]),
      },
    };
  }

  const drawingType = ["line", "arrow", "stroke"][elementIndex % 3];
  if (drawingType === "line") {
    const lineY = bounds.y + Math.max(1, Math.floor(bounds.height / 2));
    return {
      ...base,
      type: "line",
      height: Math.max(1, Math.min(bounds.height, 6)),
      points: [
        [bounds.x, lineY],
        [bounds.x + bounds.width, lineY],
      ],
    };
  }

  if (drawingType === "arrow") {
    return {
      ...base,
      type: "arrow",
      points: [
        [bounds.x, bounds.y + bounds.height],
        [bounds.x + Math.floor(bounds.width / 2), bounds.y + Math.floor(bounds.height / 2)],
        [bounds.x + bounds.width, bounds.y],
      ],
    };
  }

  const pointCount = integer(random, 3, 8);
  const points = Array.from({ length: pointCount }, (_, pointIndex) => [
    bounds.x + Math.floor((bounds.width * pointIndex) / (pointCount - 1)),
    bounds.y + integer(random, 0, bounds.height),
  ]);
  return {
    ...base,
    type: "stroke",
    points,
  };
}

function createCanvasDocument(random, topic, noteDate, title, index) {
  const pageWidth = CANVAS_PAGE_WIDTH + integer(random, 0, 3) * 160;
  const pageHeight = CANVAS_PAGE_HEIGHT + integer(random, 0, 3) * 120;
  const elementCount = integer(random, 5, 13);
  const elements = Array.from({ length: elementCount }, (_, elementIndex) =>
    createCanvasElement(random, elementIndex, pageWidth, pageHeight, topic, noteDate, title, index),
  );

  return {
    schemaVersion: 1,
    page: { width: pageWidth, height: pageHeight, background: "paper" },
    elements,
  };
}

function createTagLinks(random, notebookId) {
  const available = [...TAG_CATALOG];
  const linkCount = integer(random, 2, 6);
  const links = [];

  for (let order = 0; order < linkCount; order += 1) {
    const tagIndex = integer(random, 0, available.length - 1);
    const [tag] = available.splice(tagIndex, 1);
    links.push({ notebookId, tagId: tag.id, order });
  }

  return links;
}

function createNotebookData(count, index, seed) {
  const random = createRandom(`${seed}:notebook:${index}`);
  const notebookId = `fixture-notebook-${String(index + 1).padStart(5, "0")}`;
  const dateMs = dateForNotebook(count, index);
  const noteDate = isoDate(dateMs);
  const topic = TOPICS[index % TOPICS.length];
  const title = `${pick(random, TITLE_ADJECTIVES)} ${topic.name} #${String(index + 1).padStart(5, "0")}`;
  const sourceType = index % 13 === 0 ? null : pick(random, SOURCE_TYPES);
  const sourceTitle = sourceType
    ? `${pick(random, SOURCE_CATALOG[sourceType])} ${integer(random, 1, 18)}章`
    : "";
  const summaryParts = [
    `${topic.name}について${pick(random, topic.verbs)}ための記録。`,
    `検索語 ${topic.keyword} を含むサンプルとして利用する。`,
    `Canvas上の要素を一覧・検索性能の確認に使う。`,
    `記録番号 ${String(index + 1).padStart(5, "0")} は固定seedから再生成できる。`,
  ];
  const summary = index % 17 === 0
    ? ""
    : summaryParts.slice(0, integer(random, 1, summaryParts.length)).join(" ");
  const nextReviewDate = index % 11 === 0
    ? null
    : isoDate(dateMs + integer(random, 3, 45) * DAY_MS);
  const reviewedAt = index % 7 === 0 ? isoDateTime(dateMs + 20 * 60 * 60 * 1000) : null;
  const createdAt = isoDateTime(dateMs + 18 * 60 * 60 * 1000);
  const updatedAt = isoDateTime(dateMs + (19 + integer(random, 0, 4)) * 60 * 60 * 1000);
  const canvas = restoreCanvasDocument(
    serializeCanvasDocument(createCanvasDocument(random, topic, noteDate, title, index)),
  );
  const documentJson = serializeCanvasDocument(canvas);
  const cues = Array.from({ length: integer(random, 2, 6) }, (_, order) => ({
    id: `fixture-cue-${String(index + 1).padStart(5, "0")}-${String(order + 1).padStart(2, "0")}`,
    notebookId,
    text: `${pick(random, CANVAS_LABELS)}: ${topic.name}を${pick(random, topic.verbs)}ときの問い ${order + 1}。`,
    order,
    createdAt,
    updatedAt,
  }));

  return {
    notebook: {
      id: notebookId,
      title,
      noteDate,
      sourceType,
      sourceTitle,
      body: "",
      bodyMode: "canvas",
      summary,
      nextReviewDate,
      reviewedAt,
      createdAt,
      updatedAt,
      deletedAt: null,
    },
    canvas: {
      notebookId,
      schemaVersion: canvas.schemaVersion,
      documentJson,
      searchText: extractSearchText(canvas),
      createdAt,
      updatedAt,
    },
    cues,
    tagLinks: createTagLinks(random, notebookId),
  };
}

function insertFixture(db, count, seed) {
  const insertTag = db.prepare(
    `INSERT INTO tags (id, name, color, created_at) VALUES (@id, @name, @color, @createdAt)`,
  );
  const insertNotebook = db.prepare(
    `INSERT INTO notebooks (
      id, title, note_date, source_type, source_title, body, body_mode, summary,
      next_review_date, reviewed_at, created_at, updated_at, deleted_at
    ) VALUES (
      @id, @title, @noteDate, @sourceType, @sourceTitle, @body, @bodyMode, @summary,
      @nextReviewDate, @reviewedAt, @createdAt, @updatedAt, @deletedAt
    )`,
  );
  const insertCanvas = db.prepare(
    `INSERT INTO notebook_canvases (
      notebook_id, schema_version, document_json, search_text, created_at, updated_at
    ) VALUES (@notebookId, @schemaVersion, @documentJson, @searchText, @createdAt, @updatedAt)`,
  );
  const insertCue = db.prepare(
    `INSERT INTO cues (id, notebook_id, text, "order", created_at, updated_at)
     VALUES (@id, @notebookId, @text, @order, @createdAt, @updatedAt)`,
  );
  const insertNotebookTag = db.prepare(
    `INSERT INTO notebook_tags (notebook_id, tag_id, "order")
     VALUES (@notebookId, @tagId, @order)`,
  );

  const writeAll = db.transaction(() => {
    const tagCreatedAt = isoDateTime(FIXTURE_END_DATE_MS + 23 * 60 * 60 * 1000);
    for (const tag of TAG_CATALOG) {
      insertTag.run({ ...tag, createdAt: tagCreatedAt });
    }

    let cueCount = 0;
    let notebookTagCount = 0;
    let canvasElementCount = 0;
    for (let index = 0; index < count; index += 1) {
      const data = createNotebookData(count, index, seed);
      insertNotebook.run(data.notebook);
      insertCanvas.run(data.canvas);
      for (const cue of data.cues) {
        insertCue.run(cue);
        cueCount += 1;
      }
      for (const tagLink of data.tagLinks) {
        insertNotebookTag.run(tagLink);
        notebookTagCount += 1;
      }
      canvasElementCount += JSON.parse(data.canvas.documentJson).elements.length;
    }

    return { cueCount, notebookTagCount, canvasElementCount };
  });

  return writeAll();
}

function countRows(db, table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}

function assertCount(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`read-back ${label} が不一致です: expected=${expected}, actual=${actual}`);
  }
}

function verifyOrderedRelations(db, table, notebookIdColumn) {
  const rows = db
    .prepare(`SELECT ${notebookIdColumn} AS notebookId, "order" FROM ${table} ORDER BY ${notebookIdColumn}, "order"`)
    .all();
  let currentNotebookId = null;
  let expectedOrder = 0;

  for (const row of rows) {
    if (row.notebookId !== currentNotebookId) {
      currentNotebookId = row.notebookId;
      expectedOrder = 0;
    }
    if (row.order !== expectedOrder) {
      throw new Error(
        `read-back ${table}.order が不連続です: notebook=${row.notebookId}, expected=${expectedOrder}, actual=${row.order}`,
      );
    }
    expectedOrder += 1;
  }
}

function updateDigestFromQuery(digest, db, label, sql) {
  for (const row of db.prepare(sql).iterate()) {
    digest.update(label);
    digest.update("\t");
    digest.update(JSON.stringify(row));
    digest.update("\n");
  }
}

function calculateContentHash(db) {
  const digest = crypto.createHash("sha256");
  updateDigestFromQuery(
    digest,
    db,
    "notebooks",
    `SELECT id, title, note_date, source_type, source_title, body, body_mode, summary,
      next_review_date, reviewed_at, created_at, updated_at, deleted_at
     FROM notebooks ORDER BY id`,
  );
  updateDigestFromQuery(
    digest,
    db,
    "notebook_canvases",
    `SELECT notebook_id, schema_version, document_json, search_text, created_at, updated_at
     FROM notebook_canvases ORDER BY notebook_id`,
  );
  updateDigestFromQuery(
    digest,
    db,
    "cues",
    `SELECT id, notebook_id, text, "order", created_at, updated_at FROM cues ORDER BY id`,
  );
  updateDigestFromQuery(
    digest,
    db,
    "tags",
    `SELECT id, name, color, created_at FROM tags ORDER BY id`,
  );
  updateDigestFromQuery(
    digest,
    db,
    "notebook_tags",
    `SELECT notebook_id, tag_id, "order" FROM notebook_tags ORDER BY notebook_id, "order", tag_id`,
  );
  return digest.digest("hex");
}

function verifyReadBack(db, count, generatedCounts) {
  const counts = {
    notebooks: countRows(db, "notebooks"),
    canvases: countRows(db, "notebook_canvases"),
    cues: countRows(db, "cues"),
    tags: countRows(db, "tags"),
    notebookTags: countRows(db, "notebook_tags"),
  };
  assertCount("Notebook件数", counts.notebooks, count);
  assertCount("Canvas件数", counts.canvases, count);
  assertCount("Cue件数", counts.cues, generatedCounts.cueCount);
  assertCount("Tag件数", counts.tags, TAG_CATALOG.length);
  assertCount("NotebookTag件数", counts.notebookTags, generatedCounts.notebookTagCount);

  const cueNotebookCount = Number(
    db.prepare(`SELECT COUNT(DISTINCT notebook_id) AS count FROM cues`).get().count,
  );
  const tagNotebookCount = Number(
    db.prepare(`SELECT COUNT(DISTINCT notebook_id) AS count FROM notebook_tags`).get().count,
  );
  assertCount("Cue関連Notebook数", cueNotebookCount, count);
  assertCount("NotebookTag関連Notebook数", tagNotebookCount, count);

  const canvasModeCount = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM notebooks WHERE body_mode = 'canvas' AND body = ''`).get().count,
  );
  assertCount("Canvas bodyMode/body契約件数", canvasModeCount, count);

  const foreignKeyErrors = db.pragma("foreign_key_check");
  if (foreignKeyErrors.length > 0) {
    throw new Error(`read-back foreign key check が失敗しました: ${foreignKeyErrors.length}件`);
  }

  verifyOrderedRelations(db, "cues", "notebook_id");
  verifyOrderedRelations(db, "notebook_tags", "notebook_id");

  let canvasValidationCount = 0;
  let schemaVersionCount = 0;
  let searchTextCount = 0;
  let roundTripCount = 0;
  let canvasElementCount = 0;
  const canvasRows = db
    .prepare(
      `SELECT notebook_id, schema_version, document_json, search_text
       FROM notebook_canvases ORDER BY notebook_id`,
    )
    .iterate();

  for (const row of canvasRows) {
    let document;
    try {
      document = restoreCanvasDocument(row.document_json);
    } catch (error) {
      throw new Error(
        `Canvas JSON validation が失敗しました: notebook=${row.notebook_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    canvasValidationCount += 1;
    if (document.schemaVersion !== 1 || row.schema_version !== 1) {
      throw new Error(`Canvas schemaVersion が1ではありません: notebook=${row.notebook_id}`);
    }
    schemaVersionCount += 1;

    const canonicalJson = serializeCanvasDocument(document);
    if (canonicalJson !== row.document_json) {
      throw new Error(`Canvas documentJson がcanonical serializationと一致しません: notebook=${row.notebook_id}`);
    }
    roundTripCount += 1;

    const expectedSearchText = extractSearchText(document);
    if (row.search_text !== expectedSearchText || row.search_text.trim() === "") {
      throw new Error(`Canvas searchText が不整合または空です: notebook=${row.notebook_id}`);
    }
    searchTextCount += 1;
    canvasElementCount += document.elements.length;
  }

  assertCount("Canvas validation件数", canvasValidationCount, count);
  assertCount("Canvas schemaVersion=1件数", schemaVersionCount, count);
  assertCount("Canvas searchText存在件数", searchTextCount, count);
  assertCount("Canvas JSON round-trip件数", roundTripCount, count);
  assertCount("Canvas要素件数", canvasElementCount, generatedCounts.canvasElementCount);

  return {
    counts,
    canvas: {
      validationCount: canvasValidationCount,
      schemaVersionOneCount: schemaVersionCount,
      searchTextCount,
      roundTripCount,
      elementCount: canvasElementCount,
    },
    contentHash: calculateContentHash(db),
  };
}

function formatDuration(milliseconds) {
  return `${milliseconds.toFixed(0)} ms`;
}

function printReport(report) {
  console.log("SQLite fixture generated and read-back verified.");
  console.log(`output: ${report.output}`);
  console.log(`count: ${report.count}`);
  console.log(`seed: ${JSON.stringify(report.seed)}`);
  console.log(`generationTime: ${formatDuration(report.generationTimeMs)}`);
  console.log(`readBackTime: ${formatDuration(report.readBackTimeMs)}`);
  console.log(`totalTime: ${formatDuration(report.totalTimeMs)}`);
  console.log(`dbSizeBytes: ${report.dbSizeBytes}`);
  console.log(
    `rows: notebooks=${report.readBack.counts.notebooks} canvases=${report.readBack.counts.canvases} cues=${report.readBack.counts.cues} tags=${report.readBack.counts.tags} notebookTags=${report.readBack.counts.notebookTags}`,
  );
  console.log(
    `canvas: schemaVersion=1/${report.readBack.canvas.schemaVersionOneCount} validation=${report.readBack.canvas.validationCount} searchText=${report.readBack.canvas.searchTextCount} elements=${report.readBack.canvas.elementCount}`,
  );
  console.log(`contentHash: ${report.readBack.contentHash}`);
}

function run(args) {
  const output = resolveOutputPath(args.output);
  claimNewOutputFile(output);
  let db;
  const totalStart = process.hrtime.bigint();

  try {
    db = new Database(output);
    applyCurrentMigrations(db);
    const generationStart = process.hrtime.bigint();
    const generatedCounts = insertFixture(db, args.count, args.seed);
    const generationTimeMs = Number(process.hrtime.bigint() - generationStart) / 1_000_000;

    const readBackStart = process.hrtime.bigint();
    const readBack = verifyReadBack(db, args.count, generatedCounts);
    const readBackTimeMs = Number(process.hrtime.bigint() - readBackStart) / 1_000_000;
    db.close();
    db = undefined;

    const dbSizeBytes = fs.statSync(output).size;
    const totalTimeMs = Number(process.hrtime.bigint() - totalStart) / 1_000_000;
    return {
      output,
      count: args.count,
      seed: args.seed,
      generationTimeMs,
      readBackTimeMs,
      totalTimeMs,
      dbSizeBytes,
      readBack,
    };
  } catch (error) {
    if (db) {
      try {
        db.close();
      } catch {
        // Preserve the original generation or validation error.
      }
    }
    removeClaimedOutput(output);
    throw error;
  }
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  printReport(run(args));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "SQLite fixture generation failed");
  process.exitCode = 1;
}
