#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::os::unix::net::{UnixListener, UnixStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{webview::PageLoadEvent, Manager, WindowEvent};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 37821;
const OBSERVATION_WAIT_MS: u64 = 5000;
const PRIMARY_WINDOW_USABLE_TIMEOUT_MS: u64 = 20_000;
const INSTANCE_OWNER_SCHEMA_VERSION: u32 = 1;
const INSTANCE_FOCUS_RETRY_ATTEMPTS: usize = 20;
const INSTANCE_FOCUS_RETRY_DELAY_MS: u64 = 100;
const INSTANCE_FOCUS_RESPONSE_TIMEOUT_MS: u64 = 250;
const INSTANCE_MAX_STALE_RECOVERIES: usize = 2;
const INSTANCE_QUARANTINE_ATTEMPTS: usize = 32;

static INSTANCE_QUARANTINE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
struct InstanceOwner {
    #[serde(rename = "schemaVersion")]
    schema_version: u32,
    pid: u32,
    #[serde(rename = "processGroupId")]
    process_group_id: u32,
    #[serde(rename = "commandName")]
    command_name: String,
    #[serde(rename = "commandLine")]
    command_line: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum InstanceOwnerStatus {
    Active,
    Exited(String),
    Unverifiable(String),
}

#[derive(Clone, Serialize)]
struct InstanceRecoveryEvidence {
    status: String,
    state: String,
    reason: Option<String>,
}

#[derive(Clone)]
struct StatePaths {
    result: Option<PathBuf>,
    state: Option<PathBuf>,
    command: Option<PathBuf>,
}

struct InstanceGuard {
    lock_path: PathBuf,
    socket_path: PathBuf,
    owner: InstanceOwner,
    _file: File,
}

impl Drop for InstanceGuard {
    fn drop(&mut self) {
        if instance_lock_owned_by(&self.lock_path, &self.owner) {
            let _ = fs::remove_file(&self.socket_path);
            let _ = fs::remove_file(&self.lock_path);
        }
    }
}

struct InstanceAcquisition {
    guard: Option<InstanceGuard>,
    recovery: Option<InstanceRecoveryEvidence>,
}

struct StaleLockClaim {
    quarantine_path: PathBuf,
}

#[derive(Clone, Debug)]
struct ProcessRecord {
    pid: u32,
    ppid: u32,
    pgid: u32,
    rss_kb: u64,
    state: String,
    command_name: String,
    command_line: String,
}

#[derive(Clone, Serialize, Debug)]
struct ProcessEvidence {
    pid: u32,
    #[serde(rename = "parentPid")]
    parent_pid: u32,
    #[serde(rename = "processGroupId")]
    process_group_id: u32,
    #[serde(rename = "rssKb")]
    rss_kb: u64,
    state: String,
    #[serde(rename = "commandName")]
    command_name: String,
    #[serde(rename = "commandLine")]
    command_line: String,
    depth: usize,
    relation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "newSinceShutdown")]
    new_since_shutdown: Option<bool>,
}

#[derive(Clone, Serialize, Debug)]
struct IdentityMismatch {
    pid: u32,
    before: ProcessIdentity,
    after: ProcessIdentity,
}

#[derive(Clone, Serialize, Debug)]
struct ProcessIdentity {
    #[serde(rename = "commandName")]
    command_name: String,
    #[serde(rename = "processGroupId")]
    process_group_id: u32,
}

#[derive(Clone, Serialize, Debug)]
struct ProcessObservation {
    #[serde(rename = "observationStatus")]
    observation_status: String,
    #[serde(rename = "rootPid")]
    root_pid: u32,
    #[serde(rename = "rootObserved")]
    root_observed: bool,
    #[serde(rename = "rootProcessGroupId")]
    root_process_group_id: Option<u32>,
    #[serde(rename = "expectedProcessGroupId")]
    expected_process_group_id: Option<u32>,
    #[serde(rename = "processGroupMatches")]
    process_group_matches: Option<bool>,
    #[serde(rename = "processGroupScoped")]
    process_group_scoped: Option<bool>,
    #[serde(rename = "processGroupScopeReason")]
    process_group_scope_reason: Option<String>,
    #[serde(rename = "processTree")]
    process_tree: Vec<ProcessEvidence>,
    pids: Option<Vec<u32>>,
    #[serde(rename = "remainingPids")]
    remaining_pids: Option<Vec<u32>>,
    #[serde(rename = "identityMismatches")]
    identity_mismatches: Vec<IdentityMismatch>,
    #[serde(rename = "processTableCount")]
    process_table_count: Option<usize>,
    error: Option<String>,
}

#[derive(Clone, Serialize, Debug)]
struct ProcessGroupEvidence {
    id: Option<u32>,
    detached: bool,
    validated: bool,
    status: String,
    method: String,
    reason: Option<String>,
}

#[derive(Clone, Serialize, Debug)]
struct SignalEvidence {
    status: String,
    requested: bool,
    method: String,
    signal: String,
    #[serde(rename = "targetPids")]
    target_pids: Vec<u32>,
    #[serde(rename = "sentPids")]
    sent_pids: Vec<u32>,
    #[serde(rename = "alreadyExitedPids")]
    already_exited_pids: Vec<u32>,
    #[serde(rename = "failedPids")]
    failed_pids: Vec<u32>,
    errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    group_id: Option<u32>,
}

struct SidecarHandle {
    child: Option<Child>,
    root_pid: u32,
    process_group: ProcessGroupEvidence,
    process_tree_at_ready: ProcessObservation,
}

#[derive(Clone, Serialize)]
struct PrimaryWindowEvidence {
    count: u32,
    created: bool,
    user_facing: bool,
    #[serde(rename = "shellApiExposed")]
    shell_api_exposed: bool,
    #[serde(rename = "usableStatus")]
    usable_status: String,
    #[serde(rename = "usableReason")]
    usable_reason: Option<String>,
    #[serde(rename = "usableObservationComplete")]
    usable_observation_complete: bool,
    #[serde(rename = "usableUrl")]
    usable_url: Option<String>,
    #[serde(rename = "usablePageLoadEvent")]
    usable_page_load_event: Option<String>,
    #[serde(rename = "usableAt")]
    usable_at: Option<String>,
}

#[derive(Clone, Serialize)]
struct RuntimeEvidence {
    host: String,
    port: u16,
    pid: Option<u32>,
    #[serde(rename = "rootPid")]
    root_pid: Option<u32>,
    #[serde(rename = "processGroup")]
    process_group: Option<ProcessGroupEvidence>,
    #[serde(rename = "processTreeAtReady")]
    process_tree_at_ready: Option<ProcessObservation>,
    #[serde(rename = "readyStatus")]
    ready_status: String,
}

#[derive(Clone, Serialize)]
struct ColdStartEvidence {
    #[serde(rename = "processLaunchToRuntimeReadyMs")]
    process_launch_to_runtime_ready_ms: Option<u128>,
    #[serde(rename = "processLaunchToPrimaryWindowUsableMs")]
    process_launch_to_primary_window_usable_ms: Option<u128>,
}

#[derive(Clone, Serialize)]
struct SimpleStatus {
    status: String,
    reason: Option<String>,
}

#[derive(Clone, Serialize)]
struct ShutdownEvidence {
    status: String,
    #[serde(rename = "runtimeRootPid")]
    runtime_root_pid: u32,
    #[serde(rename = "processTreeBeforeShutdown")]
    process_tree_before_shutdown: ProcessObservation,
    #[serde(rename = "processTreeAfterShutdown")]
    process_tree_after_shutdown: ProcessObservation,
    #[serde(rename = "sigterm")]
    sigterm: SignalEvidence,
    #[serde(rename = "sigkill")]
    sigkill: SignalEvidence,
    #[serde(rename = "fallbackReason")]
    fallback_reason: Option<String>,
    #[serde(rename = "observationWaitMs")]
    observation_wait_ms: u64,
}

#[derive(Clone, Serialize)]
struct MainState {
    #[serde(rename = "schemaVersion")]
    schema_version: u32,
    candidate: String,
    mode: String,
    status: String,
    #[serde(rename = "instanceRecovery", skip_serializing_if = "Option::is_none")]
    instance_recovery: Option<InstanceRecoveryEvidence>,
    #[serde(rename = "primaryWindow")]
    primary_window: PrimaryWindowEvidence,
    runtime: RuntimeEvidence,
    #[serde(rename = "coldStart")]
    cold_start: ColdStartEvidence,
    operations: SimpleStatus,
    renderer: serde_json::Value,
    #[serde(rename = "uiSmoke")]
    ui_smoke: SimpleStatus,
    #[serde(rename = "duplicateLaunches")]
    duplicate_launches: u32,
    #[serde(rename = "lifecycleEvents")]
    lifecycle_events: Vec<serde_json::Value>,
    shutdown: Option<ShutdownEvidence>,
    errors: Vec<String>,
    #[serde(rename = "measuredAt")]
    measured_at: Option<String>,
}

struct SharedState {
    state: Arc<Mutex<MainState>>,
    sidecar: Arc<Mutex<Option<SidecarHandle>>>,
    paths: StatePaths,
}

fn state_paths() -> StatePaths {
    StatePaths {
        result: env::var_os("POC_RESULT_FILE").map(PathBuf::from),
        state: env::var_os("POC_LIFECYCLE_STATE_FILE").map(PathBuf::from),
        command: env::var_os("POC_LIFECYCLE_COMMAND_FILE").map(PathBuf::from),
    }
}

fn now_iso() -> String {
    let elapsed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", elapsed.as_secs(), elapsed.subsec_millis())
}

fn write_json<T: Serialize>(path: &Path, value: &T) {
    if let Ok(content) = serde_json::to_string_pretty(value) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let temporary = path.with_extension("tmp");
        if fs::write(&temporary, format!("{}\n", content)).is_ok() {
            let _ = fs::rename(&temporary, path);
        }
    }
}

fn write_state(shared: &SharedState) {
    if let Ok(mut state) = shared.state.lock() {
        state.measured_at = Some(now_iso());
        if let Some(path) = &shared.paths.state {
            write_json(path, &*state);
        }
        if let Some(path) = &shared.paths.result {
            write_json(path, &*state);
        }
    }
}

fn process_identity(record: &ProcessEvidence) -> ProcessIdentity {
    ProcessIdentity {
        command_name: record.command_name.clone(),
        process_group_id: record.process_group_id,
    }
}

fn parse_process_table(output: &str) -> Vec<ProcessRecord> {
    output
        .lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() < 6 {
                return None;
            }
            Some(ProcessRecord {
                pid: fields[0].parse().ok()?,
                ppid: fields[1].parse().ok()?,
                pgid: fields[2].parse().ok()?,
                rss_kb: fields[3].parse().ok()?,
                state: fields[4].to_string(),
                command_name: fields[5].to_string(),
                command_line: if fields.len() > 6 {
                    fields[6..].join(" ")
                } else {
                    fields[5].to_string()
                },
            })
        })
        .collect()
}

fn read_process_table() -> Result<Vec<ProcessRecord>, String> {
    let output = Command::new("ps")
        .args(["-axo", "pid=,ppid=,pgid=,rss=,state=,comm=,command="])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("ps process table command failed".to_string());
    }
    Ok(parse_process_table(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

fn to_process_evidence(record: &ProcessRecord, depth: usize, relation: &str) -> ProcessEvidence {
    ProcessEvidence {
        pid: record.pid,
        parent_pid: record.ppid,
        process_group_id: record.pgid,
        rss_kb: record.rss_kb,
        state: record.state.clone(),
        command_name: record.command_name.clone(),
        command_line: record.command_line.clone(),
        depth,
        relation: relation.to_string(),
        new_since_shutdown: None,
    }
}

fn descendant_closure(records: &[ProcessRecord], root_pid: u32) -> Vec<ProcessEvidence> {
    let by_pid: HashMap<u32, &ProcessRecord> =
        records.iter().map(|record| (record.pid, record)).collect();
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for record in records {
        children.entry(record.ppid).or_default().push(record.pid);
    }
    let mut queue = vec![(root_pid, 0usize)];
    let mut seen = HashSet::new();
    let mut result = Vec::new();
    while let Some((pid, depth)) = queue.pop() {
        if !seen.insert(pid) {
            continue;
        }
        let Some(record) = by_pid.get(&pid) else {
            continue;
        };
        result.push(to_process_evidence(
            record,
            depth,
            if depth == 0 {
                "sidecar-root"
            } else {
                "sidecar-descendant"
            },
        ));
        if let Some(child_pids) = children.get(&pid) {
            for child_pid in child_pids.iter().rev() {
                queue.push((*child_pid, depth + 1));
            }
        }
    }
    result
}

fn observe_descendant(root_pid: u32, expected_group: Option<u32>) -> ProcessObservation {
    let observed = read_process_table();
    let Ok(records) = observed else {
        return ProcessObservation {
            observation_status: "UNVERIFIED".to_string(),
            root_pid,
            root_observed: false,
            root_process_group_id: None,
            expected_process_group_id: expected_group,
            process_group_matches: None,
            process_group_scoped: None,
            process_group_scope_reason: None,
            process_tree: Vec::new(),
            pids: None,
            remaining_pids: None,
            identity_mismatches: Vec::new(),
            process_table_count: None,
            error: observed.err(),
        };
    };
    let process_tree = descendant_closure(&records, root_pid);
    let root = process_tree.iter().find(|record| record.pid == root_pid);
    let root_group = root.map(|record| record.process_group_id);
    let mut reasons = Vec::new();
    let mut outside_group = Vec::new();
    let mut outside_closure = Vec::new();
    let closure_pids: HashSet<u32> = process_tree.iter().map(|record| record.pid).collect();
    if let Some(expected) = expected_group {
        if root.is_none() {
            reasons.push("sidecar root が観測できません".to_string());
        }
        if root_group != Some(expected) {
            reasons.push(
                "sidecar root の process group ID が expected group ID と一致しません".to_string(),
            );
        }
        for record in &process_tree {
            if record.process_group_id != expected {
                outside_group.push(record.clone());
            }
        }
        for record in records.iter().filter(|record| record.pgid == expected) {
            if !closure_pids.contains(&record.pid) {
                outside_closure.push(to_process_evidence(record, 0, "same-group-outside-closure"));
            }
        }
        if !outside_group.is_empty() {
            reasons.push(format!(
                "sidecar descendant closure に expected group 外の process があります: {:?}",
                outside_group
                    .iter()
                    .map(|record| record.pid)
                    .collect::<Vec<_>>()
            ));
        }
        if !outside_closure.is_empty() {
            reasons.push(format!(
                "expected group に sidecar closure 外の process があります: {:?}",
                outside_closure
                    .iter()
                    .map(|record| record.pid)
                    .collect::<Vec<_>>()
            ));
        }
    }
    let scoped = expected_group.map(|expected| {
        root.is_some()
            && root_group == Some(expected)
            && outside_group.is_empty()
            && outside_closure.is_empty()
    });
    ProcessObservation {
        observation_status: if root.is_some() { "PASS" } else { "UNVERIFIED" }.to_string(),
        root_pid,
        root_observed: root.is_some(),
        root_process_group_id: root_group,
        expected_process_group_id: expected_group,
        process_group_matches: expected_group.map(|expected| root_group == Some(expected)),
        process_group_scoped: scoped,
        process_group_scope_reason: if reasons.is_empty() {
            None
        } else {
            Some(reasons.join("; "))
        },
        pids: Some(process_tree.iter().map(|record| record.pid).collect()),
        process_tree,
        remaining_pids: None,
        identity_mismatches: Vec::new(),
        process_table_count: Some(records.len()),
        error: None,
    }
}

fn same_identity(before: &ProcessEvidence, after: &ProcessRecord) -> bool {
    before.pid == after.pid
        && before.process_group_id == after.pgid
        && before.command_name == after.command_name
}

fn is_zombie(record: &ProcessRecord) -> bool {
    record.state.starts_with('Z')
        || record.command_name == "<defunct>"
        || record.command_line == "<defunct>"
}

fn observe_remaining(before: &ProcessObservation) -> ProcessObservation {
    if !before.root_observed || before.process_tree.is_empty() {
        let mut result = before.clone();
        result.observation_status = "UNVERIFIED".to_string();
        result.remaining_pids = None;
        result.error =
            Some("shutdown 前の sidecar descendant closure が観測できていません".to_string());
        return result;
    }
    let Ok(records) = read_process_table() else {
        let mut result = before.clone();
        result.observation_status = "UNVERIFIED".to_string();
        result.remaining_pids = None;
        result.error = Some("shutdown 後の process table を読み取れません".to_string());
        return result;
    };
    let current: HashMap<u32, &ProcessRecord> =
        records.iter().map(|record| (record.pid, record)).collect();
    let before_pids: HashSet<u32> = before
        .process_tree
        .iter()
        .map(|record| record.pid)
        .collect();
    let mut process_tree = Vec::new();
    let mut identity_mismatches = Vec::new();
    for previous in &before.process_tree {
        if let Some(current_record) = current.get(&previous.pid) {
            if same_identity(previous, current_record) {
                process_tree.push(to_process_evidence(
                    current_record,
                    previous.depth,
                    &previous.relation,
                ));
            } else if is_zombie(current_record) && current_record.pgid == previous.process_group_id
            {
                // The verified child has exited and is waiting for its parent to reap it.
            } else {
                identity_mismatches.push(IdentityMismatch {
                    pid: previous.pid,
                    before: process_identity(previous),
                    after: ProcessIdentity {
                        command_name: current_record.command_name.clone(),
                        process_group_id: current_record.pgid,
                    },
                });
            }
        }
    }
    for current_record in descendant_closure(&records, before.root_pid) {
        if !before_pids.contains(&current_record.pid)
            && !process_tree
                .iter()
                .any(|record| record.pid == current_record.pid)
        {
            let mut late = current_record;
            late.new_since_shutdown = Some(true);
            process_tree.push(late);
        }
    }
    let remaining_pids = process_tree
        .iter()
        .map(|record| record.pid)
        .collect::<Vec<_>>();
    ProcessObservation {
        observation_status: if identity_mismatches.is_empty() {
            "PASS"
        } else {
            "UNVERIFIED"
        }
        .to_string(),
        root_pid: before.root_pid,
        root_observed: process_tree
            .iter()
            .any(|record| record.pid == before.root_pid),
        root_process_group_id: before.root_process_group_id,
        expected_process_group_id: before.expected_process_group_id,
        process_group_matches: before.process_group_matches,
        process_group_scoped: before.process_group_scoped,
        process_group_scope_reason: before.process_group_scope_reason.clone(),
        process_tree,
        pids: Some(remaining_pids.clone()),
        remaining_pids: Some(remaining_pids),
        identity_mismatches,
        process_table_count: Some(records.len()),
        error: None,
    }
}

fn process_group_signal_available(group_id: u32) -> bool {
    Command::new("/bin/kill")
        .args(["-0", &format!("-{}", group_id)])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn validate_group(root_pid: u32) -> ProcessGroupEvidence {
    let validated = process_group_signal_available(root_pid);
    ProcessGroupEvidence {
        id: Some(root_pid),
        detached: true,
        validated,
        status: if validated { "PASS" } else { "UNVERIFIED" }.to_string(),
        method: "validated-dedicated-process-group".to_string(),
        reason: if validated {
            None
        } else {
            Some("kill -0 dedicated process group を検証できません".to_string())
        },
    }
}

fn signal_group(group_id: u32, signal: &str, observed_pids: &[u32]) -> SignalEvidence {
    let status = Command::new("/bin/kill")
        .args([signal, &format!("-{}", group_id)])
        .status();
    match status {
        Ok(exit) if exit.success() => SignalEvidence {
            status: "PASS".to_string(),
            requested: true,
            method: "validated-dedicated-process-group".to_string(),
            signal: if signal.starts_with("SIG") {
                signal.to_string()
            } else {
                format!("SIG{}", signal.trim_start_matches('-'))
            },
            target_pids: observed_pids.to_vec(),
            sent_pids: observed_pids.to_vec(),
            already_exited_pids: Vec::new(),
            failed_pids: Vec::new(),
            errors: Vec::new(),
            group_id: Some(group_id),
        },
        Ok(exit) => SignalEvidence {
            status: "UNVERIFIED".to_string(),
            requested: true,
            method: "validated-dedicated-process-group".to_string(),
            signal: if signal.starts_with("SIG") {
                signal.to_string()
            } else {
                format!("SIG{}", signal.trim_start_matches('-'))
            },
            target_pids: observed_pids.to_vec(),
            sent_pids: Vec::new(),
            already_exited_pids: Vec::new(),
            failed_pids: Vec::new(),
            errors: vec![format!(
                "/bin/kill exited with {} (ESRCH or signal delivery could not be distinguished)",
                exit
            )],
            group_id: Some(group_id),
        },
        Err(error) => SignalEvidence {
            status: "FAIL".to_string(),
            requested: true,
            method: "validated-dedicated-process-group".to_string(),
            signal: signal.to_string(),
            target_pids: observed_pids.to_vec(),
            sent_pids: Vec::new(),
            already_exited_pids: Vec::new(),
            failed_pids: observed_pids.to_vec(),
            errors: vec![error.to_string()],
            group_id: Some(group_id),
        },
    }
}

fn signal_tree(observation: &ProcessObservation, signal: &str) -> SignalEvidence {
    let mut targets = observation.process_tree.clone();
    targets.sort_by(|left, right| {
        right
            .depth
            .cmp(&left.depth)
            .then_with(|| right.pid.cmp(&left.pid))
    });
    let target_pids = targets.iter().map(|record| record.pid).collect::<Vec<_>>();
    let mut sent_pids = Vec::new();
    let mut failed_pids = Vec::new();
    let mut errors = Vec::new();
    for record in targets {
        match Command::new("/bin/kill")
            .args([signal, &record.pid.to_string()])
            .status()
        {
            Ok(exit) if exit.success() => sent_pids.push(record.pid),
            Ok(exit) => {
                failed_pids.push(record.pid);
                errors.push(format!(
                    "PID {} signal exited with {} (ESRCH or PID reuse could not be distinguished)",
                    record.pid, exit
                ));
            }
            Err(error) => {
                failed_pids.push(record.pid);
                errors.push(format!("PID {}: {}", record.pid, error));
            }
        }
    }
    SignalEvidence {
        status: if failed_pids.is_empty() {
            "PASS"
        } else {
            "UNVERIFIED"
        }
        .to_string(),
        requested: !target_pids.is_empty(),
        method: "explicit-pid-from-validated-descendant-closure".to_string(),
        signal: if signal.starts_with("SIG") {
            signal.to_string()
        } else {
            format!("SIG{}", signal.trim_start_matches('-'))
        },
        target_pids,
        sent_pids,
        already_exited_pids: Vec::new(),
        failed_pids,
        errors,
        group_id: None,
    }
}

fn wait_for_tree(before: &ProcessObservation, timeout_ms: u64) -> (ProcessObservation, bool) {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        let after = observe_remaining(before);
        if after.observation_status == "PASS"
            && after.remaining_pids.as_ref().is_some_and(Vec::is_empty)
        {
            return (after, false);
        }
        if Instant::now() >= deadline {
            return (after, true);
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn reap_sidecar_child(handle: &mut SidecarHandle) {
    let _ = handle
        .child
        .as_mut()
        .and_then(|child| child.try_wait().ok());
}

fn stop_sidecar(mut handle: SidecarHandle) -> ShutdownEvidence {
    let before = observe_descendant(handle.root_pid, handle.process_group.id);
    let ready_root = handle
        .process_tree_at_ready
        .process_tree
        .iter()
        .find(|record| record.pid == handle.root_pid);
    let current_root = before
        .process_tree
        .iter()
        .find(|record| record.pid == handle.root_pid);
    let identity_matches = ready_root
        .zip(current_root)
        .is_some_and(|(ready, current)| {
            same_identity(
                ready,
                &ProcessRecord {
                    pid: current.pid,
                    ppid: current.parent_pid,
                    pgid: current.process_group_id,
                    rss_kb: current.rss_kb,
                    state: current.state.clone(),
                    command_name: current.command_name.clone(),
                    command_line: current.command_line.clone(),
                },
            )
        });
    let group_usable = handle.process_group.validated
        && before.observation_status == "PASS"
        && before.process_group_scoped == Some(true)
        && identity_matches;
    let fallback_reason = if group_usable {
        None
    } else {
        Some(if before.process_group_scope_reason.is_some() {
            before
                .process_group_scope_reason
                .clone()
                .unwrap_or_default()
        } else {
            "dedicated process group scope が検証できないため explicit PID tree fallback を使用します".to_string()
        })
    };
    let sigterm = if group_usable {
        signal_group(
            handle.root_pid,
            "-TERM",
            before.pids.as_deref().unwrap_or_default(),
        )
    } else if before.observation_status == "PASS" && !before.process_tree.is_empty() {
        signal_tree(&before, "-TERM")
    } else {
        SignalEvidence {
            status: "UNVERIFIED".to_string(),
            requested: false,
            method: "no-validated-process-tree".to_string(),
            signal: "SIGTERM".to_string(),
            target_pids: Vec::new(),
            sent_pids: Vec::new(),
            already_exited_pids: Vec::new(),
            failed_pids: Vec::new(),
            errors: vec![
                "shutdown 前の descendant closure を観測できないため signal を送信しません"
                    .to_string(),
            ],
            group_id: None,
        }
    };
    let (mut after, mut timed_out) =
        if before.observation_status == "PASS" && !before.process_tree.is_empty() {
            wait_for_tree(&before, 3000)
        } else {
            (before.clone(), true)
        };
    reap_sidecar_child(&mut handle);
    if after
        .remaining_pids
        .as_ref()
        .is_some_and(|pids| !pids.is_empty())
    {
        let reaped_after = observe_remaining(&before);
        if reaped_after.observation_status == "PASS"
            && reaped_after
                .remaining_pids
                .as_ref()
                .is_some_and(Vec::is_empty)
        {
            after = reaped_after;
            timed_out = false;
        }
    }
    let mut sigkill = SignalEvidence {
        status: "PASS".to_string(),
        requested: false,
        method: if group_usable {
            "validated-dedicated-process-group".to_string()
        } else {
            "explicit-pid-from-validated-descendant-closure".to_string()
        },
        signal: "SIGKILL".to_string(),
        target_pids: Vec::new(),
        sent_pids: Vec::new(),
        already_exited_pids: Vec::new(),
        failed_pids: Vec::new(),
        errors: Vec::new(),
        group_id: if group_usable {
            Some(handle.root_pid)
        } else {
            None
        },
    };
    if timed_out
        || after
            .remaining_pids
            .as_ref()
            .is_some_and(|pids| !pids.is_empty())
    {
        let latest = observe_descendant(handle.root_pid, handle.process_group.id);
        if latest.observation_status == "PASS" && !latest.process_tree.is_empty() {
            let latest_group_usable = group_usable && latest.process_group_scoped == Some(true);
            sigkill = if latest_group_usable {
                signal_group(
                    handle.root_pid,
                    "-KILL",
                    latest.pids.as_deref().unwrap_or_default(),
                )
            } else {
                signal_tree(&latest, "-KILL")
            };
            let (forced_after, _) = wait_for_tree(&latest, 2000);
            after = forced_after;
            reap_sidecar_child(&mut handle);
            let reaped_after = observe_remaining(&before);
            if reaped_after.observation_status == "PASS"
                && reaped_after
                    .remaining_pids
                    .as_ref()
                    .is_some_and(Vec::is_empty)
            {
                after = reaped_after;
            }
        } else {
            sigkill.status = "UNVERIFIED".to_string();
            sigkill.errors.push("SIGKILL 用の残存 descendant closure を観測できません。PID 再利用を避けて signal を送信しません".to_string());
        }
    }
    let status = if before.observation_status == "PASS"
        && after.observation_status == "PASS"
        && after.remaining_pids.as_ref().is_some_and(Vec::is_empty)
        && sigterm.status == "PASS"
        && sigkill.status == "PASS"
    {
        "PASS"
    } else {
        "UNVERIFIED"
    };
    ShutdownEvidence {
        status: status.to_string(),
        runtime_root_pid: handle.root_pid,
        process_tree_before_shutdown: before,
        process_tree_after_shutdown: after,
        sigterm,
        sigkill,
        fallback_reason,
        observation_wait_ms: OBSERVATION_WAIT_MS,
    }
}

fn start_sidecar() -> Result<SidecarHandle, String> {
    let staging =
        PathBuf::from(env::var_os("POC_STAGING_DIR").ok_or("POC_STAGING_DIR is missing")?);
    let node = env::var_os("POC_NODE_BINARY").unwrap_or_else(|| "node".into());
    let database = env::var_os("POC_DATABASE_PATH").ok_or("POC_DATABASE_PATH is missing")?;
    let host = env::var("POC_RUNTIME_HOST").unwrap_or_else(|_| HOST.to_string());
    let port = env::var("POC_RUNTIME_PORT").unwrap_or_else(|_| PORT.to_string());
    let next_binary = staging.join("node_modules").join(".bin").join("next");
    if !next_binary.exists() {
        return Err(format!(
            "staging Next binary がありません: {}",
            next_binary.display()
        ));
    }
    let mut command = Command::new(node);
    command
        .args([
            next_binary.as_os_str(),
            std::ffi::OsStr::new("start"),
            std::ffi::OsStr::new("--hostname"),
            std::ffi::OsStr::new(&host),
            std::ffi::OsStr::new("--port"),
            std::ffi::OsStr::new(&port),
        ])
        .current_dir(&staging)
        .env(
            "DATABASE_URL",
            format!("file:{}", PathBuf::from(database).display()),
        )
        .env("PRISMA_PROVIDER", "sqlite")
        .env("NODE_ENV", "production")
        .env("CORNELL_FIXTURE_DIST_DIR", "next-dist")
        .env("CORNELL_FIXTURE_TSCONFIG_PATH", "tsconfig.poc.json")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .process_group(0);
    let child = command
        .spawn()
        .map_err(|error| format!("Node sidecar spawn failed: {}", error))?;
    let root_pid = child.id();
    let process_group = validate_group(root_pid);
    Ok(SidecarHandle {
        child: Some(child),
        root_pid,
        process_group,
        process_tree_at_ready: observe_descendant(root_pid, Some(root_pid)),
    })
}

fn wait_for_runtime(host: &str, port: u16) -> Result<u128, String> {
    let started = Instant::now();
    let deadline = started + Duration::from_secs(20);
    let mut last_error = "not attempted".to_string();
    while Instant::now() < deadline {
        match TcpStream::connect((host, port)) {
            Ok(mut stream) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                if stream
                    .write_all(
                        b"GET /notes HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
                    )
                    .is_ok()
                {
                    let mut body = String::new();
                    if stream.read_to_string(&mut body).is_ok() {
                        let status_ok = body
                            .lines()
                            .next()
                            .is_some_and(|line| line.contains(" 2") || line.contains(" 3"));
                        if status_ok {
                            return Ok(started.elapsed().as_millis());
                        }
                        last_error = body
                            .lines()
                            .next()
                            .unwrap_or("unexpected HTTP status")
                            .to_string();
                    }
                }
            }
            Err(error) => last_error = error.to_string(),
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err(format!(
        "loopback runtime readiness timeout: {}",
        last_error
    ))
}

fn runtime_url() -> String {
    let host = env::var("POC_RUNTIME_HOST").unwrap_or_else(|_| HOST.to_string());
    let port = env::var("POC_RUNTIME_PORT").unwrap_or_else(|_| PORT.to_string());
    format!("http://{}:{}/notes", host, port)
}

fn is_runtime_notes_url(url: &tauri::Url) -> bool {
    url.scheme() == "http"
        && url.host_str() == Some(HOST)
        && url.port() == Some(PORT)
        && url.path() == "/notes"
}

fn record_primary_window_not_usable(shared: &SharedState, status: &str, reason: String) {
    let mut should_write = false;
    if let Ok(mut state) = shared.state.lock() {
        if state.primary_window.usable_observation_complete {
            return;
        }
        state.primary_window.usable_status = status.to_string();
        state.primary_window.usable_reason = Some(reason.clone());
        state.primary_window.usable_observation_complete = true;
        state.status = status.to_string();
        state.errors.push(reason);
        should_write = true;
    }
    if should_write {
        write_state(shared);
    }
}

fn spawn_primary_window_readiness_timeout(shared: Arc<SharedState>) {
    thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_millis(PRIMARY_WINDOW_USABLE_TIMEOUT_MS);
        loop {
            let observed = shared
                .state
                .lock()
                .map(|state| state.primary_window.usable_observation_complete)
                .unwrap_or(false);
            if observed {
                return;
            }
            if Instant::now() >= deadline {
                record_primary_window_not_usable(
                    &shared,
                    "UNVERIFIED",
                    format!(
                        "Tauri PageLoadEvent::Finished for {} was not observed within {} ms",
                        runtime_url(),
                        PRIMARY_WINDOW_USABLE_TIMEOUT_MS
                    ),
                );
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
    });
}

fn instance_owner_from_record(record: &ProcessRecord) -> InstanceOwner {
    InstanceOwner {
        schema_version: INSTANCE_OWNER_SCHEMA_VERSION,
        pid: record.pid,
        process_group_id: record.pgid,
        command_name: record.command_name.clone(),
        command_line: record.command_line.clone(),
    }
}

fn validate_instance_owner(owner: &InstanceOwner) -> Result<(), String> {
    if owner.schema_version != INSTANCE_OWNER_SCHEMA_VERSION {
        return Err(format!(
            "unsupported owner marker schema version {}",
            owner.schema_version
        ));
    }
    if owner.pid == 0 || owner.process_group_id == 0 {
        return Err("owner marker has an invalid PID or process group ID".to_string());
    }
    if owner.command_name.trim().is_empty() || owner.command_line.trim().is_empty() {
        return Err("owner marker is missing process identity fields".to_string());
    }
    Ok(())
}

fn read_instance_owner(lock_path: &Path) -> Result<InstanceOwner, String> {
    let content = fs::read_to_string(lock_path).map_err(|error| {
        format!(
            "cannot read single-instance owner marker {}: {}",
            lock_path.display(),
            error
        )
    })?;
    let owner: InstanceOwner = serde_json::from_str(&content).map_err(|error| {
        format!(
            "single-instance owner marker is missing or invalid at {}: {}",
            lock_path.display(),
            error
        )
    })?;
    validate_instance_owner(&owner).map_err(|error| {
        format!(
            "single-instance owner marker is missing or invalid at {}: {}",
            lock_path.display(),
            error
        )
    })?;
    Ok(owner)
}

fn instance_owner_matches_record(owner: &InstanceOwner, record: &ProcessRecord) -> bool {
    owner.pid == record.pid
        && owner.process_group_id == record.pgid
        && owner.command_name == record.command_name
        && owner.command_line == record.command_line
}

fn classify_instance_owner(
    owner: &InstanceOwner,
    records: &[ProcessRecord],
) -> InstanceOwnerStatus {
    let Some(record) = records.iter().find(|record| record.pid == owner.pid) else {
        return InstanceOwnerStatus::Exited(format!(
            "owner PID {} is no longer present in the process table",
            owner.pid
        ));
    };
    if !instance_owner_matches_record(owner, record) {
        return InstanceOwnerStatus::Unverifiable(format!(
            "owner PID {} process identity does not match the lock marker; lock retained",
            owner.pid
        ));
    }
    if record.state.contains('Z') {
        return InstanceOwnerStatus::Exited(format!(
            "owner PID {} matches the lock marker but is a zombie",
            owner.pid
        ));
    }
    InstanceOwnerStatus::Active
}

fn read_instance_owner_status(owner: &InstanceOwner) -> Result<InstanceOwnerStatus, String> {
    let records = read_process_table()
        .map_err(|error| format!("owner liveness is unverifiable; lock retained: {}", error))?;
    Ok(classify_instance_owner(owner, &records))
}

fn current_instance_owner() -> Result<InstanceOwner, String> {
    let pid = std::process::id();
    let records = read_process_table()
        .map_err(|error| format!("current process identity is unavailable: {}", error))?;
    let record = records
        .iter()
        .find(|record| record.pid == pid)
        .ok_or_else(|| format!("current process PID {} is not in the process table", pid))?;
    let owner = instance_owner_from_record(record);
    validate_instance_owner(&owner)?;
    Ok(owner)
}

fn write_instance_owner(file: &mut File, owner: &InstanceOwner) -> Result<(), String> {
    let content = serde_json::to_string_pretty(owner).map_err(|error| error.to_string())?;
    file.write_all(format!("{}\n", content).as_bytes())
        .map_err(|error| format!("cannot write single-instance owner marker: {}", error))?;
    file.sync_all()
        .map_err(|error| format!("cannot sync single-instance owner marker: {}", error))
}

fn instance_lock_owned_by(lock_path: &Path, owner: &InstanceOwner) -> bool {
    read_instance_owner(lock_path).is_ok_and(|current| current == *owner)
}

fn next_instance_quarantine_path(path: &Path) -> Result<PathBuf, String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("single-instance path has no parent: {}", path.display()))?;
    let file_name = path
        .file_name()
        .ok_or_else(|| format!("single-instance path has no file name: {}", path.display()))?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = INSTANCE_QUARANTINE_COUNTER.fetch_add(1, Ordering::Relaxed);
    Ok(parent.join(format!(
        ".{}.stale.{}.{}.{}",
        file_name.to_string_lossy(),
        std::process::id(),
        timestamp,
        counter
    )))
}

fn quarantine_file(path: &Path, description: &str) -> Result<Option<PathBuf>, String> {
    for _ in 0..INSTANCE_QUARANTINE_ATTEMPTS {
        let quarantine_path = next_instance_quarantine_path(path)?;
        match fs::rename(path, &quarantine_path) {
            Ok(()) => return Ok(Some(quarantine_path)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "cannot quarantine {} {}: {}",
                    description,
                    path.display(),
                    error
                ));
            }
        }
    }
    Err(format!(
        "cannot allocate a unique quarantine path for {} {}",
        description,
        path.display()
    ))
}

fn remove_quarantined_file(path: &Path, description: &str) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "cannot remove quarantined {} {}: {}",
            description,
            path.display(),
            error
        )),
    }
}

fn quarantine_and_remove_file_if_present(path: &Path, description: &str) -> Result<(), String> {
    if let Some(quarantine_path) = quarantine_file(path, description)? {
        remove_quarantined_file(&quarantine_path, description)?;
    }
    Ok(())
}

fn claim_stale_lock(
    lock_path: &Path,
    owner: &InstanceOwner,
) -> Result<Option<StaleLockClaim>, String> {
    let current = match read_instance_owner(lock_path) {
        Ok(current) => current,
        Err(_error)
            if matches!(
                fs::metadata(lock_path),
                Err(metadata_error)
                    if metadata_error.kind() == std::io::ErrorKind::NotFound
            ) =>
        {
            return Ok(None);
        }
        Err(error) => return Err(error),
    };
    if current != *owner {
        return Ok(None);
    }
    let Some(quarantine_path) = quarantine_file(lock_path, "stale instance lock")? else {
        return Ok(None);
    };
    match read_instance_owner(&quarantine_path) {
        Ok(current) if current == *owner => Ok(Some(StaleLockClaim { quarantine_path })),
        Ok(_) => Err(format!(
            "single-instance owner marker changed while quarantining stale lock; quarantine retained at {}",
            quarantine_path.display()
        )),
        Err(error) => Err(format!(
            "cannot verify quarantined stale instance lock; quarantine retained at {}: {}",
            quarantine_path.display(),
            error
        )),
    }
}

fn reserve_recovery_lock(
    lock_path: &Path,
    replacement_owner: &InstanceOwner,
    claim: &StaleLockClaim,
) -> Result<Option<File>, String> {
    let mut file = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(lock_path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            remove_quarantined_file(&claim.quarantine_path, "stale instance lock")?;
            return Ok(None);
        }
        Err(error) => {
            return Err(format!(
                "cannot reserve single-instance lock after stale quarantine: {}",
                error
            ));
        }
    };
    if let Err(error) = write_instance_owner(&mut file, replacement_owner) {
        return Err(format!(
            "cannot write recovery owner marker; lock retained at {}: {}",
            lock_path.display(),
            error
        ));
    }
    Ok(Some(file))
}

fn request_focus_with_retry(socket_path: &Path, owner: &InstanceOwner) -> Result<(), String> {
    let owner_marker = serde_json::to_string(owner)
        .map_err(|error| format!("cannot serialize owner marker for focus request: {}", error))?;
    let request = format!("focus {}\n", owner_marker);
    let mut last_error = "not attempted".to_string();
    for attempt in 0..INSTANCE_FOCUS_RETRY_ATTEMPTS {
        match UnixStream::connect(socket_path) {
            Ok(mut stream) => {
                let _ = stream.set_read_timeout(Some(Duration::from_millis(
                    INSTANCE_FOCUS_RESPONSE_TIMEOUT_MS,
                )));
                match stream
                    .write_all(request.as_bytes())
                    .and_then(|()| stream.shutdown(std::net::Shutdown::Write))
                {
                    Ok(()) => {
                        let mut response = String::new();
                        match stream.read_to_string(&mut response) {
                            Ok(_) if response.trim() == "focused" => return Ok(()),
                            Ok(_) => {
                                last_error = format!(
                                    "focus socket returned an unexpected response: {:?}",
                                    response.trim()
                                )
                            }
                            Err(error) => last_error = error.to_string(),
                        }
                    }
                    Err(error) => last_error = error.to_string(),
                }
            }
            Err(error) => last_error = error.to_string(),
        }
        if attempt + 1 < INSTANCE_FOCUS_RETRY_ATTEMPTS {
            thread::sleep(Duration::from_millis(INSTANCE_FOCUS_RETRY_DELAY_MS));
        }
    }
    Err(format!(
        "focus socket unavailable after {} bounded attempts: {}",
        INSTANCE_FOCUS_RETRY_ATTEMPTS, last_error
    ))
}

fn recover_stale_instance(
    lock_path: &Path,
    socket_path: &Path,
    stale_owner: &InstanceOwner,
    replacement_owner: &InstanceOwner,
    reason: String,
    recovery_count: &mut usize,
    recovery: &mut Option<InstanceRecoveryEvidence>,
) -> Result<Option<InstanceGuard>, String> {
    if *recovery_count >= INSTANCE_MAX_STALE_RECOVERIES {
        return Err(format!(
            "repeated stale instance recovery exceeded {} attempts; lock retained",
            INSTANCE_MAX_STALE_RECOVERIES
        ));
    }
    *recovery_count += 1;
    validate_instance_owner(replacement_owner)?;
    let Some(claim) = claim_stale_lock(lock_path, stale_owner)? else {
        return Ok(None);
    };
    let Some(file) = reserve_recovery_lock(lock_path, replacement_owner, &claim)? else {
        return Ok(None);
    };
    let socket_quarantine = quarantine_file(socket_path, "stale focus socket")?;
    if let Some(quarantine_path) = socket_quarantine {
        remove_quarantined_file(&quarantine_path, "stale focus socket")?;
    }
    remove_quarantined_file(&claim.quarantine_path, "stale instance lock")?;
    *recovery = Some(InstanceRecoveryEvidence {
        status: "PASS".to_string(),
        state: "stale-recovered".to_string(),
        reason: Some(format!(
            "{}; recovery owner reserved the lock before verified stale lock and socket quarantine cleanup",
            reason
        )),
    });
    Ok(Some(InstanceGuard {
        lock_path: lock_path.to_path_buf(),
        socket_path: socket_path.to_path_buf(),
        owner: replacement_owner.clone(),
        _file: file,
    }))
}

fn acquire_instance() -> Result<InstanceAcquisition, String> {
    let user_data =
        PathBuf::from(env::var_os("POC_TAURI_USER_DATA").ok_or("POC_TAURI_USER_DATA is missing")?);
    let lock_path = PathBuf::from(
        env::var_os("POC_TAURI_INSTANCE_LOCK")
            .unwrap_or_else(|| user_data.join("instance.lock").into_os_string()),
    );
    let socket_path = PathBuf::from(
        env::var_os("POC_TAURI_INSTANCE_SOCKET")
            .unwrap_or_else(|| user_data.join("instance.sock").into_os_string()),
    );
    if lock_path == socket_path {
        return Err("single-instance lock and focus socket must be different paths".to_string());
    }
    if let Some(parent) = lock_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if let Some(parent) = socket_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut recovery = None;
    let mut recovery_count = 0;
    loop {
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
        {
            Ok(mut file) => {
                let owner = match current_instance_owner() {
                    Ok(owner) => owner,
                    Err(error) => {
                        let _ = fs::remove_file(&lock_path);
                        return Err(format!(
                            "single-instance lock acquired but owner identity is unavailable: {}",
                            error
                        ));
                    }
                };
                if let Err(error) = write_instance_owner(&mut file, &owner) {
                    let _ = fs::remove_file(&lock_path);
                    return Err(error);
                }
                if let Err(error) =
                    quarantine_and_remove_file_if_present(&socket_path, "stale focus socket")
                {
                    let _ = fs::remove_file(&lock_path);
                    return Err(error);
                }
                return Ok(InstanceAcquisition {
                    guard: Some(InstanceGuard {
                        lock_path,
                        socket_path,
                        owner,
                        _file: file,
                    }),
                    recovery,
                });
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let owner = read_instance_owner(&lock_path)
                    .map_err(|error| format!("{}; lock retained", error))?;
                match read_instance_owner_status(&owner)? {
                    InstanceOwnerStatus::Active => {
                        match request_focus_with_retry(&socket_path, &owner) {
                            Ok(()) => {
                                return Ok(InstanceAcquisition {
                                    guard: None,
                                    recovery: None,
                                });
                            }
                            Err(focus_error) => {
                                let latest_owner = read_instance_owner(&lock_path)
                                    .map_err(|error| format!("{}; lock retained", error))?;
                                match read_instance_owner_status(&latest_owner)? {
                                    InstanceOwnerStatus::Exited(reason) => {
                                        let replacement_owner = current_instance_owner().map_err(
                                            |error| {
                                                format!(
                                                    "current process identity is unavailable during stale recovery: {}; lock retained",
                                                    error
                                                )
                                            },
                                        )?;
                                        if let Some(guard) = recover_stale_instance(
                                            &lock_path,
                                            &socket_path,
                                            &latest_owner,
                                            &replacement_owner,
                                            reason,
                                            &mut recovery_count,
                                            &mut recovery,
                                        )? {
                                            return Ok(InstanceAcquisition {
                                                guard: Some(guard),
                                                recovery,
                                            });
                                        }
                                        continue;
                                    }
                                    InstanceOwnerStatus::Active => {
                                        return Err(format!(
                                        "existing instance owner is active but focus socket is unavailable: {}; lock retained at {}",
                                        focus_error,
                                        lock_path.display()
                                    ));
                                    }
                                    InstanceOwnerStatus::Unverifiable(reason) => {
                                        return Err(format!(
                                        "existing instance owner cannot be verified after focus failure: {}; {}",
                                        reason, focus_error
                                    ));
                                    }
                                }
                            }
                        }
                    }
                    InstanceOwnerStatus::Exited(reason) => {
                        let replacement_owner = current_instance_owner().map_err(|error| {
                            format!(
                                "current process identity is unavailable during stale recovery: {}; lock retained",
                                error
                            )
                        })?;
                        if let Some(guard) = recover_stale_instance(
                            &lock_path,
                            &socket_path,
                            &owner,
                            &replacement_owner,
                            reason,
                            &mut recovery_count,
                            &mut recovery,
                        )? {
                            return Ok(InstanceAcquisition {
                                guard: Some(guard),
                                recovery,
                            });
                        }
                        continue;
                    }
                    InstanceOwnerStatus::Unverifiable(reason) => {
                        return Err(format!(
                            "existing instance owner cannot be verified: {}; lock retained at {}",
                            reason,
                            lock_path.display()
                        ));
                    }
                }
            }
            Err(error) => return Err(format!("single-instance lock creation failed: {}", error)),
        }
    }
}

fn spawn_focus_listener(
    socket_path: PathBuf,
    app: tauri::AppHandle,
    shared: Arc<SharedState>,
    owner: InstanceOwner,
) -> Result<(), String> {
    let listener = UnixListener::bind(&socket_path)
        .map_err(|error| format!("single-instance focus socket bind failed: {}", error))?;
    thread::spawn(move || {
        for incoming in listener.incoming() {
            let Ok(mut stream) = incoming else {
                continue;
            };
            let mut message = String::new();
            let _ = stream.read_to_string(&mut message);
            let expected = format!(
                "focus {}",
                serde_json::to_string(&owner).unwrap_or_else(|_| "{}".to_string())
            );
            if message.trim() != expected {
                continue;
            }
            let Some(window) = app.get_webview_window("main") else {
                continue;
            };
            {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            if let Ok(mut state) = shared.state.lock() {
                state.instance_recovery = Some(InstanceRecoveryEvidence {
                    status: "PASS".to_string(),
                    state: "active-owner-focused".to_string(),
                    reason: Some(
                        "verified owner marker and focus socket acknowledgement".to_string(),
                    ),
                });
                state.duplicate_launches += 1;
                state
                    .lifecycle_events
                    .push(serde_json::json!({ "type": "duplicate-launch-focus" }));
            }
            write_state(&shared);
            let _ = stream.write_all(b"focused\n");
        }
    });
    Ok(())
}

fn spawn_command_listener(command_path: PathBuf, app: tauri::AppHandle) {
    thread::spawn(move || loop {
        if let Ok(content) = fs::read_to_string(&command_path) {
            if content.contains("\"close\"") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
                break;
            }
        }
        thread::sleep(Duration::from_millis(100));
    });
}

fn main_state(mode: String, instance_recovery: Option<InstanceRecoveryEvidence>) -> MainState {
    MainState {
        schema_version: 1,
        candidate: "tauri-node-sidecar".to_string(),
        mode,
        status: "UNVERIFIED".to_string(),
        instance_recovery,
        primary_window: PrimaryWindowEvidence {
            count: 0,
            created: false,
            user_facing: true,
            shell_api_exposed: false,
            usable_status: "UNVERIFIED".to_string(),
            usable_reason: Some("waiting for Tauri PageLoadEvent::Finished for /notes".to_string()),
            usable_observation_complete: false,
            usable_url: None,
            usable_page_load_event: None,
            usable_at: None,
        },
        runtime: RuntimeEvidence { host: HOST.to_string(), port: PORT, pid: None, root_pid: None, process_group: None, process_tree_at_ready: None, ready_status: "UNVERIFIED".to_string() },
        cold_start: ColdStartEvidence { process_launch_to_runtime_ready_ms: None, process_launch_to_primary_window_usable_ms: None },
        operations: SimpleStatus { status: "UNVERIFIED".to_string(), reason: Some("Tauri GUI operation automation is not part of the GUI-independent shell runner".to_string()) },
        renderer: serde_json::json!({ "pid": null, "status": "UNVERIFIED", "reason": "Tauri WebView PID was not exposed by the PoC shell" }),
        ui_smoke: SimpleStatus { status: "BLOCKED".to_string(), reason: Some("Tauri native WebView GUI automation is not available in the GUI-independent runner".to_string()) },
        duplicate_launches: 0,
        lifecycle_events: Vec::new(),
        shutdown: None,
        errors: Vec::new(),
        measured_at: None,
    }
}

fn run_app(
    instance: InstanceGuard,
    instance_recovery: Option<InstanceRecoveryEvidence>,
) -> Result<(), String> {
    let mode = env::var("POC_TAURI_MODE").unwrap_or_else(|_| "smoke".to_string());
    let paths = state_paths();
    let start = Instant::now();
    let socket_path = instance.socket_path.clone();
    let owner = instance.owner.clone();
    let shared_state = Arc::new(Mutex::new(main_state(mode.clone(), instance_recovery)));
    let shared_sidecar = Arc::new(Mutex::new(None));
    let shared = Arc::new(SharedState {
        state: shared_state,
        sidecar: shared_sidecar,
        paths: paths.clone(),
    });
    let shared_for_setup = shared.clone();
    let shared_for_page_load = shared.clone();
    let page_load_start = start.clone();
    tauri::Builder::default()
        .on_page_load(move |_webview, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished)
                || !is_runtime_notes_url(payload.url())
            {
                return;
            }
            let mut should_write = false;
            if let Ok(mut state) = shared_for_page_load.state.lock() {
                if state.primary_window.usable_observation_complete {
                    return;
                }
                state.primary_window.usable_status = "PASS".to_string();
                state.primary_window.usable_reason = None;
                state.primary_window.usable_observation_complete = true;
                state.primary_window.usable_url = Some(payload.url().to_string());
                state.primary_window.usable_page_load_event = Some("Finished".to_string());
                state.primary_window.usable_at = Some(now_iso());
                state.status = "PASS".to_string();
                state.cold_start.process_launch_to_primary_window_usable_ms =
                    Some(page_load_start.elapsed().as_millis());
                should_write = true;
            }
            if should_write {
                write_state(&shared_for_page_load);
            }
        })
        .setup(move |app| {
            app.manage(instance);
            let shared = shared_for_setup.clone();
            app.manage(shared.clone());
            let window = app
                .get_webview_window("main")
                .ok_or("primary window 'main' was not created")?;
            let sidecar = start_sidecar()?;
            let runtime_ready_ms = wait_for_runtime(HOST, PORT)?;
            let ready_tree = observe_descendant(sidecar.root_pid, sidecar.process_group.id);
            let mut sidecar = sidecar;
            sidecar.process_tree_at_ready = ready_tree.clone();
            {
                if let Ok(mut locked) = shared.sidecar.lock() {
                    *locked = Some(sidecar);
                }
                if let Ok(mut state) = shared.state.lock() {
                    state.primary_window = PrimaryWindowEvidence {
                        count: 1,
                        created: true,
                        user_facing: true,
                        shell_api_exposed: false,
                        usable_status: "UNVERIFIED".to_string(),
                        usable_reason: Some(
                            "waiting for Tauri PageLoadEvent::Finished for /notes".to_string(),
                        ),
                        usable_observation_complete: false,
                        usable_url: None,
                        usable_page_load_event: None,
                        usable_at: None,
                    };
                    state.runtime = RuntimeEvidence {
                        host: HOST.to_string(),
                        port: PORT,
                        pid: Some(ready_tree.root_pid),
                        root_pid: Some(ready_tree.root_pid),
                        process_group: Some(
                            shared
                                .sidecar
                                .lock()
                                .ok()
                                .and_then(|locked| {
                                    locked.as_ref().map(|handle| handle.process_group.clone())
                                })
                                .unwrap_or(ProcessGroupEvidence {
                                    id: None,
                                    detached: false,
                                    validated: false,
                                    status: "UNVERIFIED".to_string(),
                                    method: "not-observed".to_string(),
                                    reason: Some("sidecar state unavailable".to_string()),
                                }),
                        ),
                        process_tree_at_ready: Some(ready_tree),
                        ready_status: "PASS".to_string(),
                    };
                    state.cold_start = ColdStartEvidence {
                        process_launch_to_runtime_ready_ms: Some(runtime_ready_ms),
                        process_launch_to_primary_window_usable_ms: None,
                    };
                }
            }
            let script =
                serde_json::to_string(&runtime_url()).map_err(|error| error.to_string())?;
            if let Err(error) = window.eval(&format!("window.location.replace({});", script)) {
                let reason = format!("Tauri WebView navigation request failed: {}", error);
                record_primary_window_not_usable(&shared, "BLOCKED", reason);
                return Err(error.to_string().into());
            }
            spawn_primary_window_readiness_timeout(shared.clone());
            if env::var("POC_SHOW_WINDOW").unwrap_or_default() == "1" {
                let _ = window.show();
            }
            spawn_focus_listener(socket_path, app.handle().clone(), shared.clone(), owner)?;
            write_state(&shared);
            if let Some(command_path) = &paths.command {
                spawn_command_listener(command_path.clone(), app.handle().clone());
            }
            let shared_for_close = shared.clone();
            let app_for_close = app.handle().clone();
            window.on_window_event(move |event| {
                if !matches!(event, WindowEvent::CloseRequested { .. }) {
                    return;
                }
                if let Ok(mut sidecar) = shared_for_close.sidecar.lock() {
                    if let Some(handle) = sidecar.take() {
                        let shutdown = stop_sidecar(handle);
                        if let Ok(mut state) = shared_for_close.state.lock() {
                            state.shutdown = Some(shutdown);
                        }
                        write_state(&shared_for_close);
                    }
                }
                if let Ok(mut state) = shared_for_close.state.lock() {
                    state
                        .lifecycle_events
                        .push(serde_json::json!({ "type": "primary-window-close-request" }));
                }
                write_state(&shared_for_close);
                app_for_close.exit(0);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|error| error.to_string())
}

fn main() {
    match acquire_instance() {
        Ok(InstanceAcquisition {
            guard: Some(instance),
            recovery,
        }) => {
            if let Err(error) = run_app(instance, recovery) {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
        Ok(InstanceAcquisition { guard: None, .. }) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owner(pid: u32, process_group_id: u32) -> InstanceOwner {
        InstanceOwner {
            schema_version: INSTANCE_OWNER_SCHEMA_VERSION,
            pid,
            process_group_id,
            command_name: "cornell-method-tauri-poc".to_string(),
            command_line: "cornell-method-tauri-poc --poc".to_string(),
        }
    }

    #[test]
    fn zombie_process_record_is_recognized_as_exited() {
        let record = ProcessRecord {
            pid: 100,
            ppid: 1,
            pgid: 100,
            rss_kb: 0,
            state: "Z".to_string(),
            command_name: "<defunct>".to_string(),
            command_line: "<defunct>".to_string(),
        };
        assert!(is_zombie(&record));
    }

    fn record(owner: &InstanceOwner, state: &str) -> ProcessRecord {
        ProcessRecord {
            pid: owner.pid,
            ppid: 1,
            pgid: owner.process_group_id,
            rss_kb: 1,
            state: state.to_string(),
            command_name: owner.command_name.clone(),
            command_line: owner.command_line.clone(),
        }
    }

    fn test_directory(label: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after the Unix epoch")
            .as_nanos();
        let directory = PathBuf::from(format!(
            "/private/tmp/ct-{}-{}-{}",
            label,
            std::process::id(),
            suffix
        ));
        fs::create_dir_all(&directory).expect("test directory should be created");
        directory
    }

    #[test]
    fn active_owner_requires_the_complete_process_identity_marker() {
        let expected = owner(100, 200);
        assert_eq!(
            classify_instance_owner(&expected, &[record(&expected, "S")]),
            InstanceOwnerStatus::Active
        );

        let mut reused_pid = record(&expected, "S");
        reused_pid.pgid = 201;
        assert!(matches!(
            classify_instance_owner(&expected, &[reused_pid]),
            InstanceOwnerStatus::Unverifiable(_)
        ));
    }

    #[test]
    fn stale_owner_is_only_recoverable_when_identity_is_verified_as_exited() {
        let expected = owner(100, 200);
        assert!(matches!(
            classify_instance_owner(&expected, &[]),
            InstanceOwnerStatus::Exited(_)
        ));
        let mut reused_pid = record(&expected, "S");
        reused_pid.command_line = "unrelated-process".to_string();
        assert!(matches!(
            classify_instance_owner(&expected, &[reused_pid]),
            InstanceOwnerStatus::Unverifiable(_)
        ));
        assert!(matches!(
            classify_instance_owner(&expected, &[record(&expected, "Z")]),
            InstanceOwnerStatus::Exited(_)
        ));
    }

    #[test]
    fn stale_recovery_quarantines_stale_paths_before_returning_a_guard() {
        let directory = test_directory("stale");
        let lock_path = directory.join("instance.lock");
        let socket_path = directory.join("instance.sock");
        let stale_owner = owner(100, 200);
        let replacement_owner = owner(101, 201);
        fs::write(
            &lock_path,
            format!("{}\n", serde_json::to_string_pretty(&stale_owner).unwrap()),
        )
        .unwrap();
        fs::write(&socket_path, "stale socket placeholder").unwrap();

        let mut recovery_count = 0;
        let mut recovery = None;
        let guard = recover_stale_instance(
            &lock_path,
            &socket_path,
            &stale_owner,
            &replacement_owner,
            "owner exited".to_string(),
            &mut recovery_count,
            &mut recovery,
        )
        .unwrap()
        .expect("stale recovery should reserve the replacement lock");

        assert_eq!(read_instance_owner(&lock_path).unwrap(), replacement_owner);
        assert!(!socket_path.exists());
        assert_eq!(recovery_count, 1);
        assert_eq!(recovery.unwrap().state, "stale-recovered");
        drop(guard);
        assert!(!lock_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn stale_recovery_does_not_remove_replacement_paths_after_lock_claim_race() {
        let directory = test_directory("replacement-race");
        let lock_path = directory.join("instance.lock");
        let socket_path = directory.join("instance.sock");
        let stale_owner = owner(100, 200);
        let replacement_owner = owner(101, 201);
        let recovery_owner = owner(102, 202);
        fs::write(
            &lock_path,
            format!("{}\n", serde_json::to_string_pretty(&stale_owner).unwrap()),
        )
        .unwrap();
        fs::write(&socket_path, "stale socket placeholder").unwrap();

        let claim = claim_stale_lock(&lock_path, &stale_owner)
            .unwrap()
            .expect("recovery should atomically claim the stale lock");
        assert!(!lock_path.exists());

        let mut replacement_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
            .unwrap();
        write_instance_owner(&mut replacement_file, &replacement_owner).unwrap();
        fs::write(&socket_path, "replacement socket placeholder").unwrap();

        let result = reserve_recovery_lock(&lock_path, &recovery_owner, &claim).unwrap();
        assert!(result.is_none(), "replacement owner must win the lock race");
        assert_eq!(read_instance_owner(&lock_path).unwrap(), replacement_owner);
        assert_eq!(
            fs::read_to_string(&socket_path).unwrap(),
            "replacement socket placeholder"
        );
        assert!(!claim.quarantine_path.exists());
        drop(replacement_file);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn focus_handshake_requires_the_verified_owner_marker() {
        let socket_path =
            PathBuf::from(format!(".cornell-tauri-focus-{}.sock", std::process::id()));
        let _ = fs::remove_file(&socket_path);
        let expected = owner(100, 200);
        let listener = UnixListener::bind(&socket_path).unwrap();
        let expected_message = format!("focus {}\n", serde_json::to_string(&expected).unwrap());
        let thread = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut message = String::new();
            stream.read_to_string(&mut message).unwrap();
            assert_eq!(message, expected_message);
            stream.write_all(b"focused\n").unwrap();
        });

        request_focus_with_retry(&socket_path, &expected).unwrap();
        thread.join().unwrap();
        fs::remove_file(socket_path).unwrap();
    }

    #[test]
    fn malformed_owner_marker_is_rejected_without_removing_stale_files() {
        let directory = test_directory("malformed");
        let lock_path = directory.join("instance.lock");
        let socket_path = directory.join("instance.sock");
        fs::write(&lock_path, "123\n").unwrap();
        fs::write(&socket_path, "stale socket placeholder").unwrap();

        assert!(read_instance_owner(&lock_path).is_err());
        assert!(claim_stale_lock(&lock_path, &owner(100, 200)).is_err());
        assert!(lock_path.exists());
        assert!(socket_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn normal_guard_cleanup_only_removes_its_own_marker_and_socket() {
        let directory = test_directory("cleanup");
        let lock_path = directory.join("instance.lock");
        let socket_path = directory.join("instance.sock");
        let expected = owner(100, 200);
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
            .unwrap();
        write_instance_owner(&mut file, &expected).unwrap();
        fs::write(&socket_path, "socket placeholder").unwrap();
        drop(InstanceGuard {
            lock_path: lock_path.clone(),
            socket_path: socket_path.clone(),
            owner: expected,
            _file: file,
        });
        assert!(!lock_path.exists());
        assert!(!socket_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn guard_does_not_remove_a_replaced_lock_or_socket() {
        let directory = test_directory("replaced");
        let lock_path = directory.join("instance.lock");
        let socket_path = directory.join("instance.sock");
        let expected = owner(100, 200);
        let replacement = owner(101, 201);
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&lock_path)
            .unwrap();
        write_instance_owner(&mut file, &expected).unwrap();
        fs::write(&socket_path, "socket placeholder").unwrap();
        fs::write(
            &lock_path,
            format!("{}\n", serde_json::to_string_pretty(&replacement).unwrap()),
        )
        .unwrap();
        drop(InstanceGuard {
            lock_path: lock_path.clone(),
            socket_path: socket_path.clone(),
            owner: expected,
            _file: file,
        });
        assert!(lock_path.exists());
        assert!(socket_path.exists());
        fs::remove_dir_all(directory).unwrap();
    }
}
