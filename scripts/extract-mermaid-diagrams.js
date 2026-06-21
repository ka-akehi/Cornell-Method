/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const docRoot = path.join(repoRoot, "doc");
const manifestPath = path.join(docRoot, "diagrams", "DIAGRAM_ASSETS.md");

const sourceGroups = [
  { name: "diagrams", root: path.join(docRoot, "diagrams") },
  { name: "workflows", root: path.join(docRoot, "workflows") },
  { name: "screens", root: path.join(docRoot, "screens") },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["assets", "mmd", "svg"].includes(entry.name)) return [];
      return walk(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function slug(value) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return ascii || "diagram";
}

function nearestHeading(contents, index) {
  const before = contents.slice(0, index).split(/\r?\n/).reverse();
  const line = before.find((candidate) => /^#{2,6}\s+/.test(candidate));
  return line ? line.replace(/^#{2,6}\s+/, "").trim() : "diagram";
}

function extractBlocks(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  const blocks = [];
  const pattern = /```mermaid\s*\r?\n([\s\S]*?)\r?\n```/g;
  let match;
  while ((match = pattern.exec(contents)) !== null) {
    blocks.push({
      heading: nearestHeading(contents, match.index),
      body: match[1].trim() + "\n",
    });
  }
  return blocks;
}

function cleanGeneratedFiles() {
  for (const group of sourceGroups) {
    const assetsDir = path.join(group.root, "assets");
    const mmdDir = path.join(assetsDir, "mmd");
    const svgDir = path.join(assetsDir, "svg");
    fs.mkdirSync(mmdDir, { recursive: true });
    fs.mkdirSync(svgDir, { recursive: true });
    for (const entry of fs.readdirSync(mmdDir)) {
      if (entry.endsWith(".mmd")) fs.rmSync(path.join(mmdDir, entry));
    }
    for (const entry of fs.readdirSync(svgDir)) {
      if (entry.endsWith(".svg")) fs.rmSync(path.join(svgDir, entry));
    }
  }
}

function main() {
  cleanGeneratedFiles();
  const records = [];

  for (const group of sourceGroups) {
    const files = walk(group.root).sort();
    const mmdDir = path.join(group.root, "assets", "mmd");
    const svgDir = path.join(group.root, "assets", "svg");

    for (const filePath of files) {
      const blocks = extractBlocks(filePath);
      if (blocks.length === 0) continue;

      const sourceSlug = slug(path.basename(filePath, ".md"));
      blocks.forEach((block, index) => {
        const sequence = String(index + 1).padStart(2, "0");
        const name = `${sourceSlug}-${sequence}-${slug(block.heading)}.mmd`;
        const outPath = path.join(mmdDir, name);
        fs.writeFileSync(outPath, block.body, "utf8");
        records.push({
          category: group.name,
          source: path.relative(repoRoot, filePath),
          heading: block.heading,
          mmd: path.relative(repoRoot, outPath),
          svg: path.relative(repoRoot, path.join(svgDir, name.replace(/\.mmd$/, ".svg"))),
        });
      });
    }
  }

  const lines = [
    "# Diagram Assets",
    "",
    "このファイルは `npm run diagrams:extract` で生成される Mermaid source / SVG 対応表です。",
    "",
    "| Category | Source | Section | Mermaid source | SVG display |",
    "| --- | --- | --- | --- | --- |",
    ...records.map((record) => `| ${record.category} | \`${record.source}\` | ${record.heading} | \`${record.mmd}\` | \`${record.svg}\` |`),
    "",
  ];
  fs.writeFileSync(manifestPath, lines.join("\n"), "utf8");
  console.log(`Extracted ${records.length} Mermaid diagrams.`);
}

main();
