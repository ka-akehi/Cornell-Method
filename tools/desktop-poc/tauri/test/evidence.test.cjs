const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { EXPECTED_BASELINE } = require("../scripts/common.cjs");
const { buildManifest, coldStartMeasurement, overallStatus } = require("../scripts/evidence.cjs");

const candidateRoot = path.resolve(__dirname, "..");

function createEvidenceContext(t) {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-evidence-test-"));
  const evidenceRoot = path.join(outputRoot, "evidence");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  t.after(() => fs.rmSync(outputRoot, { recursive: true, force: true }));
  return {
    outputRoot,
    evidenceRoot,
    stagingRoot: path.join(outputRoot, "staging"),
    cleanUserDataRoot: path.join(outputRoot, "user-data", "clean"),
    populatedUserDataRoot: path.join(outputRoot, "user-data", "populated"),
    populatedDatabasePath: path.join(outputRoot, "user-data", "populated", "live.sqlite"),
    runtimeHost: "127.0.0.1",
    runtimePort: 37821,
    baseline: { ...EXPECTED_BASELINE },
  };
}

function writeEvidence(context, name, value) {
  fs.writeFileSync(path.join(context.evidenceRoot, name), `${JSON.stringify(value)}\n`, "utf8");
}

function writePassPrerequisites(context) {
  writeEvidence(context, "baseline-validation.json", { status: "PASS" });
  writeEvidence(context, "preparation.json", { status: "PASS", userData: { clean: { status: "PASS" } } });
  writeEvidence(context, "build.json", { status: "PASS", nextBuild: { status: "PASS", cacheState: "test" } });
  writeEvidence(context, "package.json", { status: "PASS" });
  writeEvidence(context, "lifecycle.json", { status: "PASS", shutdown: { shellCleanup: { status: "PASS" } } });
}

function runtimeHttpPassReport() {
  return {
    status: "PASS",
    runtime: { status: "PASS", readinessMs: 42 },
    operations: {
      status: "PASS",
      list: { status: "PASS" },
      search: { status: "PASS" },
      detail: { status: "PASS" },
      edit: { status: "PASS" },
      explicitSave: { status: "PASS" },
      reopen: { status: "PASS" },
    },
    persistence: { status: "PASS" },
    cleanup: { status: "PASS", loopbackListenerRemaining: false },
  };
}

test("candidate package pins Tauri Rust dependencies and does not declare a plugin", () => {
  const cargo = fs.readFileSync(path.join(candidateRoot, "src-tauri", "Cargo.toml"), "utf8");
  const cargoLockPath = path.join(candidateRoot, "src-tauri", "Cargo.lock");
  const cargoLock = fs.readFileSync(cargoLockPath, "utf8");
  assert.match(cargo, /tauri\s*=\s*"=2\.5\.1"/);
  assert.match(cargo, /tauri-build\s*=\s*"=2\.2\.0"/);
  assert.match(cargoLock, /name = "tauri"\nversion = "2\.5\.1"/);
  assert.match(cargoLock, /name = "tauri-build"\nversion = "2\.2\.0"/);
  assert.match(cargoLock, /name = "tauri-utils"\nversion = "2\.4\.0"/);
  assert.equal(fs.existsSync(path.join(candidateRoot, "src-tauri", "icons", "icon.png")), true);
  assert.doesNotMatch(cargo, /tauri-plugin-/);
});

test("candidate scripts preserve fixed host/port and isolation contracts", () => {
  const common = fs.readFileSync(path.join(candidateRoot, "scripts", "common.cjs"), "utf8");
  const build = fs.readFileSync(path.join(candidateRoot, "scripts", "build.cjs"), "utf8");
  const prepare = fs.readFileSync(path.join(candidateRoot, "scripts", "prepare.cjs"), "utf8");
  const runtimeHttp = fs.readFileSync(path.join(candidateRoot, "scripts", "runtime-http.cjs"), "utf8");
  const rust = fs.readFileSync(path.join(candidateRoot, "src-tauri", "src", "main.rs"), "utf8");
  assert.match(common, /FIXED_RUNTIME_HOST = "127\.0\.0\.1"/);
  assert.match(common, /FIXED_RUNTIME_PORT = 37821/);
  assert.match(build, /spawnSync\("cargo", \["build", "--locked", "--release", "--manifest-path", cargoManifest\]/);
  assert.doesNotMatch(build, /spawnSync\("cargo", \["check", "--locked", "--release"/);
  assert.match(prepare, /rootNodeModulesUsedByRuntime: false/);
  assert.match(prepare, /npm ci --include=dev --no-audit --no-fund/);
  assert.match(prepare, /\["ci", "--include=dev", "--no-audit", "--no-fund"\]/);
  assert.match(prepare, /PUPPETEER_SKIP_DOWNLOAD: "true"/);
  assert.match(prepare, /generateStagingPrismaClients/);
  assert.match(prepare, /\["sqlite", "postgresql"\]/);
  assert.match(prepare, /PRISMA_PROVIDER: provider/);
  assert.match(runtimeHttp, /canonicalRuntimeOrigin/);
  assert.match(runtimeHttp, /withCanonicalSameOriginHeaders/);
  assert.match(runtimeHttp, /headers\.set\("Origin", canonicalOrigin\)/);
  assert.match(runtimeHttp, /headers\.set\("Referer", `\$\{canonicalOrigin\}\/`\)/);
  assert.match(runtimeHttp, /const \{ portIsListening, stopOwnedProcess \} = require\("\.\/tauri-runner\.cjs"\)/);
  assert.doesNotMatch(rust, /pkill|killall/);
  assert.match(rust, /explicit-pid-from-validated-descendant-closure/);
  assert.match(rust, /process_group/);
});

test("primary window usability is gated by the Tauri finished page-load event", () => {
  const rust = fs.readFileSync(path.join(candidateRoot, "src-tauri", "src", "main.rs"), "utf8");
  const smoke = fs.readFileSync(path.join(candidateRoot, "scripts", "smoke.cjs"), "utf8");
  assert.match(rust, /\.on_page_load\(move/);
  assert.match(rust, /PageLoadEvent::Finished/);
  assert.match(rust, /is_runtime_notes_url\(payload\.url\(\)\)/);
  assert.match(rust, /usable_observation_complete = true/);
  assert.match(rust, /Some\(page_load_start\.elapsed\(\)\.as_millis\(\)\)/);
  assert.doesNotMatch(rust, /window\.location\.replace\([\s\S]{0,240}process_launch_to_primary_window_usable_ms/);
  assert.match(smoke, /usableObservationComplete === true/);
  assert.doesNotMatch(smoke, /processLaunchToPrimaryWindowUsableMs:\s*[^,\n]+\?\?\s*readyMs/);
});

test("update template keeps distribution and updater outside the PoC", () => {
  const template = JSON.parse(fs.readFileSync(path.join(candidateRoot, "resources", "update-manifest.template.json"), "utf8"));
  assert.equal(template.apply.mode, "explicit-restart");
  assert.equal(template.distribution.developerId, false);
  assert.equal(template.distribution.notarized, false);
  assert.equal(template.check.backgroundDownload, "future-boundary-only");
});

test("evidence status aggregation never upgrades blocked or unverified axes", () => {
  assert.equal(overallStatus(["PASS", "PASS"]), "PASS");
  assert.equal(overallStatus(["PASS", "UNVERIFIED"]), "UNVERIFIED");
  assert.equal(overallStatus(["PASS", "BLOCKED"]), "BLOCKED");
  assert.equal(overallStatus(["BLOCKED", "FAIL"]), "FAIL");
});

test("evidence consumer never upgrades a cold-start timestamp without finished /notes evidence", () => {
  const context = { evidenceRoot: "/tmp/tauri-evidence", outputRoot: "/tmp" };
  const unverified = coldStartMeasurement(context, {
    coldStart: { processLaunchToPrimaryWindowUsableMs: 42 },
    primaryWindow: {
      usableStatus: "UNVERIFIED",
      usableObservationComplete: true,
      usablePageLoadEvent: null,
    },
  }, null);
  assert.equal(unverified.primaryWindowUsable.status, "UNVERIFIED");
  assert.equal(unverified.primaryWindowUsable.durationMs, null);

  const verified = coldStartMeasurement(context, {
    coldStart: { processLaunchToPrimaryWindowUsableMs: 42 },
    primaryWindow: {
      usableStatus: "PASS",
      usableObservationComplete: true,
      usablePageLoadEvent: "Finished",
    },
  }, null);
  assert.equal(verified.primaryWindowUsable.status, "PASS");
  assert.equal(verified.primaryWindowUsable.durationMs, 42);
});

test("GUI-independent runtime HTTP operations fill an unmeasured smoke operation axis", (t) => {
  const context = createEvidenceContext(t);
  writePassPrerequisites(context);
  writeEvidence(context, "smoke.json", {
    status: "BLOCKED",
    operations: { status: "BLOCKED", reason: "GUI smoke unavailable" },
    uiSmoke: { status: "BLOCKED", reason: "GUI smoke unavailable" },
  });
  writeEvidence(context, "runtime-http-smoke.json", runtimeHttpPassReport());

  const manifest = buildManifest(context);

  assert.equal(manifest.revisionProvenance.baselineGitHead, EXPECTED_BASELINE.git_head);
  assert.equal("candidateGitHead" in manifest.revisionProvenance, true);
  assert.equal("candidateDirtyWorktree" in manifest.revisionProvenance, true);
  assert.equal(manifest.measurements.operationResponse.status, "PASS");
  assert.equal(manifest.measurements.operationResponse.source, "runtime-http");
  assert.equal(manifest.measurements.operationResponse.provenance.source, "runtime-http");
  assert.equal(manifest.measurements.operationResponse.provenance.fallbackUsed, true);
  assert.equal(manifest.measurements.operationResponse.provenance.rendererWebViewUi, false);
  assert.equal(manifest.measurements.uiSmoke.status, "BLOCKED");
  assert.equal(manifest.measurements.coldStart.primaryWindowUsable.status, "UNVERIFIED");
  assert.equal(manifest.measurements.coldStart.runtimeReadiness.source, "runtime-http");
  assert.equal(manifest.measurements.coldStart.runtimeReadiness.provenance.primaryWindowUsable, false);
  assert.equal(manifest.status, "BLOCKED");
});

test("runtime HTTP sidecar cleanup never becomes native shell cleanup without shell evidence", (t) => {
  const context = createEvidenceContext(t);
  writePassPrerequisites(context);
  fs.rmSync(path.join(context.evidenceRoot, "lifecycle.json"));
  writeEvidence(context, "runtime-http-smoke.json", runtimeHttpPassReport());

  const manifest = buildManifest(context);

  assert.equal(manifest.measurements.cleanup.status, "UNVERIFIED");
  assert.equal(manifest.measurements.cleanup.provenance.source, "none");
  assert.equal(manifest.measurements.productionRuntimeHttp.cleanup.status, "PASS");
  assert.equal(manifest.measurements.productionRuntimeHttp.cleanup.provenance.measurementType, "runtime-http-sidecar-cleanup");
  assert.equal(manifest.measurements.uiSmoke.status, "UNVERIFIED");
  assert.equal(manifest.status, "UNVERIFIED");
});

test("stale-lock recovery evidence is retained without upgrading blocked measurements", (t) => {
  const context = createEvidenceContext(t);
  writePassPrerequisites(context);
  writeEvidence(context, "smoke.json", {
    status: "BLOCKED",
    instanceRecovery: { status: "PASS", state: "stale-recovered", reason: "verified owner exited" },
    operations: { status: "UNVERIFIED" },
    uiSmoke: { status: "BLOCKED", reason: "GUI smoke unavailable" },
  });

  const manifest = buildManifest(context);

  assert.deepEqual(manifest.measurements.instanceRecovery, {
    status: "PASS",
    state: "stale-recovered",
    reason: "verified owner exited",
  });
  assert.equal(manifest.measurements.uiSmoke.status, "BLOCKED");
  assert.equal(manifest.status, "BLOCKED");
});

test("evidence schema names the comparison contract fields", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(candidateRoot, "evidence-schema.json"), "utf8"));
  assert.deepEqual(schema.required, ["schemaVersion", "candidate", "status", "baseline", "conditions", "measurements"]);
  assert.deepEqual(schema.properties.status.enum, ["PASS", "FAIL", "BLOCKED", "UNVERIFIED"]);
  assert.deepEqual(
    schema.properties.measurements.properties.primaryWindow.properties.usableStatus.enum,
    ["PASS", "FAIL", "BLOCKED", "UNVERIFIED"],
  );
  assert.equal(
    schema.properties.measurements.properties.primaryWindow.properties.usableObservationComplete.type,
    "boolean",
  );
  assert.deepEqual(
    schema.properties.measurements.properties.instanceRecovery.properties.status.enum,
    ["PASS", "BLOCKED", "UNVERIFIED"],
  );
  assert.deepEqual(
    schema.properties.measurements.properties.instanceRecovery.properties.state.enum,
    ["stale-recovered", "active-owner-focused", "startup-refused"],
  );
});
