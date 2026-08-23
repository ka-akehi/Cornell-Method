use std::process::Command;

use crate::update_manifest::{MacOsVersion, SemVer, TARGET_ARCHITECTURE, TARGET_CHANNEL};

pub(crate) const INVALID_APP_VERSION_ERROR_CODE: &str = "update-target-app-version-invalid";
pub(crate) const MACOS_COMMAND_ERROR_CODE: &str = "update-target-macos-command-failed";
pub(crate) const MACOS_OUTPUT_ERROR_CODE: &str = "update-target-macos-output-invalid";

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct UpdateTargetContext {
    pub(crate) current_app_version: SemVer,
    pub(crate) target_channel: &'static str,
    pub(crate) target_architecture: &'static str,
    pub(crate) current_macos_version: MacOsVersion,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum UpdateTargetError {
    InvalidAppVersion,
    MacOsCommandFailed,
    MacOsOutputInvalid,
}

impl UpdateTargetError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::InvalidAppVersion => INVALID_APP_VERSION_ERROR_CODE,
            Self::MacOsCommandFailed => MACOS_COMMAND_ERROR_CODE,
            Self::MacOsOutputInvalid => MACOS_OUTPUT_ERROR_CODE,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SwVersCommandOutput {
    status_success: bool,
    stdout: Vec<u8>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SwVersRunnerError {
    Io,
}

trait SwVersCommandRunner {
    fn run(&self) -> Result<SwVersCommandOutput, SwVersRunnerError>;
}

struct SystemSwVersCommandRunner;

impl SwVersCommandRunner for SystemSwVersCommandRunner {
    fn run(&self) -> Result<SwVersCommandOutput, SwVersRunnerError> {
        let output = Command::new("/usr/bin/sw_vers")
            .arg("-productVersion")
            .output()
            .map_err(|_| SwVersRunnerError::Io)?;

        Ok(SwVersCommandOutput {
            status_success: output.status.success(),
            stdout: output.stdout,
        })
    }
}

pub(crate) fn load_update_target_context() -> Result<UpdateTargetContext, UpdateTargetError> {
    build_update_target_context(env!("CARGO_PKG_VERSION"), &SystemSwVersCommandRunner)
}

fn build_update_target_context<R: SwVersCommandRunner>(
    current_app_version: &str,
    runner: &R,
) -> Result<UpdateTargetContext, UpdateTargetError> {
    let current_app_version =
        SemVer::parse(current_app_version).map_err(|_| UpdateTargetError::InvalidAppVersion)?;
    let output = runner
        .run()
        .map_err(|_| UpdateTargetError::MacOsCommandFailed)?;
    let current_macos_version = parse_sw_vers_output(output)?;

    Ok(UpdateTargetContext {
        current_app_version,
        target_channel: TARGET_CHANNEL,
        target_architecture: TARGET_ARCHITECTURE,
        current_macos_version,
    })
}

fn parse_sw_vers_output(output: SwVersCommandOutput) -> Result<MacOsVersion, UpdateTargetError> {
    if !output.status_success {
        return Err(UpdateTargetError::MacOsCommandFailed);
    }

    let stdout =
        std::str::from_utf8(&output.stdout).map_err(|_| UpdateTargetError::MacOsOutputInvalid)?;
    let version = stdout
        .strip_suffix('\n')
        .map_or(stdout, |value| value.strip_suffix('\r').unwrap_or(value));

    if version.is_empty() || version.chars().any(char::is_control) {
        return Err(UpdateTargetError::MacOsOutputInvalid);
    }

    MacOsVersion::parse(version, "target macOS version")
        .map_err(|_| UpdateTargetError::MacOsOutputInvalid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Clone)]
    struct FakeRunner {
        result: Result<SwVersCommandOutput, SwVersRunnerError>,
    }

    impl FakeRunner {
        fn output(status_success: bool, stdout: &[u8]) -> Self {
            Self {
                result: Ok(SwVersCommandOutput {
                    status_success,
                    stdout: stdout.to_vec(),
                }),
            }
        }

        fn io_error() -> Self {
            Self {
                result: Err(SwVersRunnerError::Io),
            }
        }
    }

    impl SwVersCommandRunner for FakeRunner {
        fn run(&self) -> Result<SwVersCommandOutput, SwVersRunnerError> {
            self.result.clone()
        }
    }

    #[test]
    fn builds_a_canonical_validated_target_context_from_fixed_target_constants() {
        let target =
            build_update_target_context("1.2.3+build.7", &FakeRunner::output(true, b"15.6.0\n"))
                .unwrap();

        assert_eq!(target.current_app_version.to_string(), "1.2.3+build.7");
        assert_eq!(target.target_channel, TARGET_CHANNEL);
        assert_eq!(target.target_architecture, TARGET_ARCHITECTURE);
        assert_eq!(target.current_macos_version.to_string(), "15.6");
    }

    #[test]
    fn rejects_invalid_app_versions_with_a_fixed_error_code() {
        let error =
            build_update_target_context("1.2", &FakeRunner::output(true, b"15.6\n")).unwrap_err();

        assert_eq!(error, UpdateTargetError::InvalidAppVersion);
        assert_eq!(error.code(), INVALID_APP_VERSION_ERROR_CODE);
    }

    #[test]
    fn rejects_command_failure_and_non_zero_exit_without_details() {
        let runner_error =
            build_update_target_context("1.2.3", &FakeRunner::io_error()).unwrap_err();
        assert_eq!(runner_error, UpdateTargetError::MacOsCommandFailed);
        assert_eq!(runner_error.code(), MACOS_COMMAND_ERROR_CODE);

        let non_zero = build_update_target_context("1.2.3", &FakeRunner::output(false, b"15.6\n"))
            .unwrap_err();
        assert_eq!(non_zero, UpdateTargetError::MacOsCommandFailed);
    }

    #[test]
    fn rejects_invalid_sw_vers_stdout_as_a_fixed_error() {
        for stdout in [
            b"".as_slice(),
            b"\n".as_slice(),
            b"15.6\t\n".as_slice(),
            b"15.6\n15.7\n".as_slice(),
            b"15.x\n".as_slice(),
            &[0xff, b'\n'],
        ] {
            let error = build_update_target_context("1.2.3", &FakeRunner::output(true, stdout))
                .unwrap_err();
            assert_eq!(error, UpdateTargetError::MacOsOutputInvalid);
            assert_eq!(error.code(), MACOS_OUTPUT_ERROR_CODE);
        }
    }
}
