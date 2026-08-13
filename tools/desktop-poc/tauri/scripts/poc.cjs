const commands = {
  validate: require("./validate.cjs"),
  prepare: require("./prepare.cjs"),
  build: require("./build.cjs"),
  smoke: require("./smoke.cjs"),
  "runtime-http": require("./runtime-http.cjs"),
  lifecycle: require("./lifecycle.cjs"),
  package: require("./package.cjs"),
  evidence: require("./evidence.cjs"),
};

async function runCommand(name) {
  const command = commands[name];
  if (!command) throw new Error(`未対応の PoC command: ${name}`);
  return command.run();
}

async function runAll() {
  for (const name of ["validate", "prepare", "build", "runtime-http", "smoke", "lifecycle", "package", "evidence"]) {
    const result = await runCommand(name);
    if (name === "validate" && result?.status !== "PASS") throw new Error("baseline validation が PASS ではないため、後続の install/build/packaging を実行しません");
  }
}

async function main() {
  const name = process.argv[2] ?? "help";
  if (name === "help") {
    console.log("Usage: npm run poc:<validate|prepare|build|smoke|runtime-http|lifecycle|package|evidence|all>");
    return;
  }
  if (name === "all") return runAll();
  return runCommand(name);
}

if (require.main === module) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });

module.exports = { main, runAll, runCommand };
