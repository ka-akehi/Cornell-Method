import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
export {};

const projectRoot = path.resolve(__dirname, "../..");
const sourcePath = path.join(projectRoot, "src-tauri", "src", "update_download.rs");
const manifestPath = path.join(projectRoot, "src-tauri", "src", "update_manifest.rs");
const mainPath = path.join(projectRoot, "src-tauri", "src", "main.rs");
const fixturePath = path.join(
  projectRoot,
  "test",
  "desktop",
  "fixtures",
  "update-download",
  "invalid-archive.bin",
);

test("desktop update download keeps raw package verification before archive handling", () => {
  const source = fs.readFileSync(sourcePath, "utf8");
  const main = fs.readFileSync(mainPath, "utf8");

  assert.match(source, /trait ArtifactHttpTransport/);
  assert.match(source, /PublicAddressResolver/);
  assert.match(source, /validate_public_address/);
  assert.match(source, /validate_public_ip_literal/);
  assert.match(source, /dns_resolver/);
  assert.match(source, /PinnedDnsResolver/);
  assert.match(source, /struct ReqwestArtifactHttpTransport/);
  assert.match(source, /PACKAGE_CONNECTION_TIMEOUT: Duration = Duration::from_secs\(15\)/);
  assert.match(source, /PACKAGE_READ_IDLE_TIMEOUT: Duration = Duration::from_secs\(30\)/);
  assert.match(source, /PACKAGE_BODY_MIN_TIMEOUT: Duration = Duration::from_secs\(5 \* 60\)/);
  assert.match(source, /body_timeout: package_body_timeout\(/);
  assert.match(source, /\.read_timeout\(PACKAGE_READ_IDLE_TIMEOUT\)/);
  assert.match(source, /\.connect_timeout\(PACKAGE_CONNECTION_TIMEOUT\)/);
  assert.doesNotMatch(source, /\.timeout\(PACKAGE_READ_IDLE_TIMEOUT\)/);
  assert.doesNotMatch(source, /PACKAGE_DOWNLOAD_TIMEOUT/);
  assert.doesNotMatch(source, /\.timeout\(remaining\)/);
  assert.match(source, /MAX_ARTIFACT_REDIRECT_HOPS: usize = 5/);
  assert.match(source, /MAX_PACKAGE_BYTES: u64 = 2 \* 1024 \* 1024 \* 1024/);
  assert.match(source, /application\/gzip/);
  assert.match(source, /application\/octet-stream/);
  assert.match(source, /Policy::none\(\)/);
  assert.match(source, /create_new\(true\)/);
  assert.match(source, /incoming/);
  assert.match(source, /packages/);
  assert.match(source, /sync_all\(\)/);
  assert.match(source, /verify_selected_package/);
  assert.match(source, /fs::rename\(&part_path, &final_path\)/);
  assert.match(source, /package-network/);
  assert.match(source, /package-timeout/);
  assert.match(source, /package-http-status/);
  assert.match(source, /package-redirect/);
  assert.match(source, /package-content-type/);
  assert.match(source, /package-size/);
  assert.match(source, /package-digest/);
  assert.match(source, /package-signature/);
  assert.match(source, /struct VerifiedArchiveHandle/);
  assert.match(source, /package_file: File/);
  assert.match(source, /verify_contents\(&self\)/);
  assert.match(source, /staging-path/);
  assert.match(source, /staging-read/);
  assert.match(source, /staging-write/);
  assert.match(source, /staging-rename/);
  assert.doesNotMatch(source, /flate2|tar::|tar_rs|Info\.plist|Mach-O|MachO|extract_archive/i);
  assert.match(main, /^mod update_download;$/m);
});

test("desktop update download validates the initial URL and every redirect hop", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /artifact_transport\s*\.validate_url\(&initial_url\)/);
  assert.match(source, /self\.validate_url\(&current_url\)/);
  assert.match(source, /self\.validate_url\(&next_url\)/);
  assert.match(source, /validate_redirect_trace\(transport, request, response\)/);
  assert.match(source, /validate_url\(&final_url\)/);
});

test("desktop update download shares the manifest's fail-closed artifact URL boundary", () => {
  const source = fs.readFileSync(sourcePath, "utf8");
  const manifest = fs.readFileSync(manifestPath, "utf8");

  assert.match(source, /is_safe_public_update_url\(url\)/);
  assert.match(source, /validate_public_ip_literal\(url\)/);
  assert.match(manifest, /pub\(crate\) fn is_safe_public_update_url/);
  assert.match(manifest, /url\.query\(\)\.is_none\(\)/);
  assert.match(source, /resolve_artifact_redirect/);
  assert.match(source, /final_url/);
  assert.doesNotMatch(source, /is_credential_or_token_query_key/);
  assert.doesNotMatch(manifest, /is_credential_or_token_query_key/);
});

test("download returns only relative SHA-256 package paths and does not use locator metadata", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /relative_package_path: PathBuf/);
  assert.match(source, /format!\("\{digest_hex\}\.part"\)/);
  assert.match(source, /format!\("\{digest_hex\}\.app\.tar\.gz"\)/);
  assert.doesNotMatch(source, /Content-Disposition|content_disposition|artifact_id\).*join|url\).*join/i);
  assert.doesNotMatch(source, /Authorization|Cookie|bearer_auth|\.body\(/);
  assert.match(source, /Box<dyn Read>/);
});

test("download fixture is small disposable non-archive data without locator or secret material", () => {
  const fixture = fs.readFileSync(fixturePath);
  assert.ok(fixture.length < 256);
  assert.notDeepEqual(fixture.subarray(0, 2), Buffer.from([0x1f, 0x8b]));
  assert.equal(fixture.includes(Buffer.from("https://")), false);
  assert.equal(/privateKey|secret|token|credential|Authorization/i.test(fixture.toString()), false);
});
