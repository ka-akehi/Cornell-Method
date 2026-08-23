/* eslint-disable @typescript-eslint/no-require-imports -- This focused test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("startup update check runs once after the visible window is ready", () => {
  const main = read("src-tauri/src/main.rs");
  const setup = section(main, ".setup(move |app|", "\n        .run(");

  assert.match(main, /fn start_startup_update_check\(app: tauri::AppHandle\)/);
  assert.match(main, /tauri::async_runtime::spawn_blocking\(move \|\|/);
  assert.match(main, /let state = app\.state::<UpdateStateStore>\(\)/);
  assert.match(main, /load_update_target_context\(\)/);
  assert.match(main, /ReqwestManifestHttpTransport::new\(\)/);
  assert.match(
    main,
    /run_update_check\(\s*CheckTrigger::Automatic,\s*now,[\s\S]*?state\.inner\(\),[\s\S]*?&transport,/,
  );
  assert.match(main, /current_timestamp\(\)/);

  const showIndex = setup.indexOf(".show()");
  const focusIndex = setup.indexOf(".set_focus()");
  const startupIndex = setup.indexOf("start_startup_update_check(app.handle().clone())");
  assert.ok(showIndex >= 0 && focusIndex > showIndex && startupIndex > focusIndex);
  assert.equal(
    (main.match(/start_startup_update_check\(app\.handle\(\)\.clone\(\)\)/g) || []).length,
    1,
  );

  assert.match(main, /app\.manage\(update_state\)/);
  assert.equal((main.match(/UpdateStateStore::load_or_default/g) || []).length, 1);
  assert.doesNotMatch(setup, /reqwest|run_update_check|fetch_manifest|blocking::/i);
});

test("startup worker reports only fixed codes and has no manual or package side effects", () => {
  const main = read("src-tauri/src/main.rs");
  const worker = section(main, "fn start_startup_update_check", "\n#[tauri::command]");

  assert.match(worker, /error\.code\(\)/);
  assert.doesNotMatch(worker, /\{error\}|\{:\?\}|GITHUB_RELEASES_MANIFEST_URL|response\.body/i);
  assert.doesNotMatch(
    worker,
    /CheckTrigger::Manual|download|sha-?256|signature|apply|rollback|notification|event dispatch/i,
  );
  assert.match(
    main,
    /\.invoke_handler\(tauri::generate_handler!\[\s*manual_update_check,\s*read_update_state,\s*verify_pending_update\s*\]\)/s,
  );
  assert.equal(
    (main.match(/generate_handler!\[\s*manual_update_check,\s*read_update_state,\s*verify_pending_update\s*\]/gs) || []).length,
    1,
  );
  assert.doesNotMatch(main, /fetch_manifest_from_github/);
});
