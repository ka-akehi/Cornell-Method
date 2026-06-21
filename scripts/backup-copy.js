async function main() {
  const path = await import("path");
  const backupModule = await import("../src/lib/backup/index.js");
  const { createBackup } = backupModule.default ?? backupModule;
  const projectRoot = path.resolve(__dirname, "..");
  const backup = createBackup({ projectRoot });
  console.log(backup.path);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
