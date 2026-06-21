/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const docRoot = path.join(repoRoot, "doc");
const mermaidBundlePath = path.join(repoRoot, "node_modules", "mermaid", "dist", "mermaid.min.js");
const sourceGroups = ["diagrams", "workflows", "screens"];

function withWhiteBackground(svg) {
  const backgroundRect = '<rect x="0" y="0" width="100%" height="100%" fill="#ffffff"/>';
  return svg.replace(/(<svg\b[^>]*>)/, `$1${backgroundRect}`);
}

async function main() {
  if (!fs.existsSync(mermaidBundlePath)) {
    throw new Error("Mermaid is not installed. Run `npm install` first.");
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--single-process"],
  });
  const page = await browser.newPage();
  await page.addScriptTag({ path: mermaidBundlePath });
  await page.evaluate(() => {
    mermaid.initialize({ startOnLoad: false, theme: "default" });
  });

  let rendered = 0;

  try {
    for (const group of sourceGroups) {
      const mmdDir = path.join(docRoot, group, "assets", "mmd");
      const svgDir = path.join(docRoot, group, "assets", "svg");
      if (!fs.existsSync(mmdDir)) continue;

      fs.mkdirSync(svgDir, { recursive: true });
      for (const entry of fs.readdirSync(svgDir)) {
        if (entry.endsWith(".svg")) fs.rmSync(path.join(svgDir, entry));
      }

      const files = fs
        .readdirSync(mmdDir)
        .filter((entry) => entry.endsWith(".mmd"))
        .sort();

      for (const file of files) {
        const input = path.join(mmdDir, file);
        const output = path.join(svgDir, file.replace(/\.mmd$/, ".svg"));
        const source = fs.readFileSync(input, "utf8");
        const diagramId = `diagram-${rendered + 1}`;

        try {
          const svg = await page.evaluate(
            async ({ id, definition }) => {
              const result = await mermaid.render(id, definition);
              return result.svg;
            },
            { id: diagramId, definition: source },
          );
          fs.writeFileSync(output, withWhiteBackground(svg), "utf8");
        } catch (error) {
          throw new Error(`Failed to render ${path.relative(repoRoot, input)}: ${error.message}`);
        }
        rendered += 1;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Rendered ${rendered} SVG diagrams.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
