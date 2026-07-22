async function main() {
  const path = await import("path");
  const envModule = await import("../config/project-env.js");
  const { loadProjectEnv } = envModule.default ?? envModule;
  const projectRoot = path.resolve(__dirname, "..");

  loadProjectEnv(projectRoot);

  const backupModule = await import("../src/server/backup/application/index.js");
  const { createBackupEntry } = backupModule.default ?? backupModule;
  const backup = createBackupEntry({ projectRoot });
  console.log(backup.path);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
