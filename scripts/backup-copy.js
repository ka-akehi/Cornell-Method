async function main() {
  const fs = await import("fs");
  const path = await import("path");
  const projectRoot = path.resolve(__dirname, "..");
  const envPath = path.join(projectRoot, ".env");

  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const backupModule = await import("../src/server/backup/application/index.js");
  const { createBackupEntry } = backupModule.default ?? backupModule;
  const backup = createBackupEntry({ projectRoot });
  console.log(backup.path);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
