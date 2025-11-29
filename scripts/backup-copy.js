import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const backupDir = path.join(process.cwd(), "backup");

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error("DB file not found:", dbPath);
    process.exit(1);
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");
  const dest = path.join(backupDir, `${timestamp}.db`);
  fs.copyFileSync(dbPath, dest);

  // Keep latest 3
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();
  const toDelete = files.slice(3);
  toDelete.forEach((f) => fs.unlinkSync(path.join(backupDir, f)));

  console.log(`Backup created: ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
