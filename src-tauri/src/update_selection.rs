use std::cmp::Ordering;
use std::fmt;

use crate::update_manifest::{
    MacOsVersion, SemVer, UpdateManifest, UpdateRelease, TARGET_ARCHITECTURE,
    TARGET_ARTIFACT_FORMAT, TARGET_CHANNEL,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum UpdateSelectionError {
    InvalidInput(String),
    Ambiguous { candidate_count: usize },
}

impl fmt::Display for UpdateSelectionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(message) => {
                write!(formatter, "invalid update selection input: {message}")
            }
            Self::Ambiguous { candidate_count } => write!(
                formatter,
                "multiple compatible update candidates have the highest version ({candidate_count} candidates)"
            ),
        }
    }
}

impl std::error::Error for UpdateSelectionError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum UpdateSelection<'a> {
    NoUpdate,
    Selected(&'a UpdateRelease),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct SelectionTarget {
    current_version: SemVer,
    channel: String,
    architecture: String,
    macos_version: MacOsVersion,
}

impl SelectionTarget {
    pub(crate) fn new(
        current_version: &str,
        channel: &str,
        architecture: &str,
        macos_version: &str,
    ) -> Result<Self, UpdateSelectionError> {
        validate_target_text(channel, "target channel")?;
        validate_target_text(architecture, "target architecture")?;

        if channel != TARGET_CHANNEL {
            return Err(UpdateSelectionError::InvalidInput(format!(
                "target channel must be {TARGET_CHANNEL}"
            )));
        }
        if architecture != TARGET_ARCHITECTURE {
            return Err(UpdateSelectionError::InvalidInput(format!(
                "target architecture must be {TARGET_ARCHITECTURE}"
            )));
        }

        let current_version = SemVer::parse(current_version).map_err(|error| {
            UpdateSelectionError::InvalidInput(format!("current version is invalid: {error}"))
        })?;
        let macos_version =
            MacOsVersion::parse(macos_version, "target macOS version").map_err(|error| {
                UpdateSelectionError::InvalidInput(format!(
                    "target macOS version is invalid: {error}"
                ))
            })?;

        Ok(Self {
            current_version,
            channel: channel.to_string(),
            architecture: architecture.to_string(),
            macos_version,
        })
    }
}

pub(crate) fn select_update<'a>(
    manifest: &'a UpdateManifest,
    current_version: &str,
    target_channel: &str,
    target_architecture: &str,
    target_macos_version: &str,
) -> Result<UpdateSelection<'a>, UpdateSelectionError> {
    let target = SelectionTarget::new(
        current_version,
        target_channel,
        target_architecture,
        target_macos_version,
    )?;
    select_update_for_target(manifest, &target)
}

fn select_update_for_target<'a>(
    manifest: &'a UpdateManifest,
    target: &SelectionTarget,
) -> Result<UpdateSelection<'a>, UpdateSelectionError> {
    let compatible: Vec<&UpdateRelease> = manifest
        .releases
        .iter()
        .filter(|release| {
            release.channel == target.channel
                && release.architecture == target.architecture
                && release.artifact.format == TARGET_ARTIFACT_FORMAT
                && !release.version.is_prerelease()
                && release.version.precedence_cmp(&target.current_version) == Ordering::Greater
                && release.min_version <= target.macos_version
                && release
                    .max_version_exclusive
                    .as_ref()
                    .map_or(true, |max_version| target.macos_version < *max_version)
        })
        .collect();

    let Some(highest_version) = compatible
        .iter()
        .map(|release| &release.version)
        .max_by(|left, right| left.precedence_cmp(right))
    else {
        return Ok(UpdateSelection::NoUpdate);
    };

    let highest_candidates: Vec<&UpdateRelease> = compatible
        .into_iter()
        .filter(|release| release.version.precedence_cmp(highest_version) == Ordering::Equal)
        .collect();

    match highest_candidates.as_slice() {
        [release] => Ok(UpdateSelection::Selected(release)),
        [] => unreachable!("the highest compatible update version must have a candidate"),
        candidates => Err(UpdateSelectionError::Ambiguous {
            candidate_count: candidates.len(),
        }),
    }
}

fn validate_target_text(value: &str, field: &str) -> Result<(), UpdateSelectionError> {
    if value.is_empty() || value.chars().any(char::is_control) {
        return Err(UpdateSelectionError::InvalidInput(format!(
            "{field} must be a non-empty string without control characters"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::update_manifest::{HttpsUrl, UpdateArtifact, UpdateSignature};

    const SHA256: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    fn valid_url() -> HttpsUrl {
        crate::update_manifest::parse_manifest(
            r#"{
              "productId":"com.cornellmethod.notebook",
              "schemaVersion":1,
              "releases":[{
                "channel":"stable",
                "version":"1.0.0",
                "architecture":"aarch64-apple-darwin",
                "minVersion":"14",
                "artifact":{
                  "artifactId":"selection-test-url",
                  "format":"app-archive",
                  "url":"https://updates.example.test/selection-test-url",
                  "sizeBytes":1,
                  "sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                },
                "signature":{"keyId":"test-key","proof":"opaque-proof"}
              }]
            }"#,
        )
        .unwrap()
        .releases
        .into_iter()
        .next()
        .unwrap()
        .artifact
        .url
    }

    fn release(
        channel: &str,
        version: &str,
        architecture: &str,
        min_version: &str,
        max_version_exclusive: Option<&str>,
        format: &str,
        artifact_id: &str,
    ) -> UpdateRelease {
        UpdateRelease {
            channel: channel.to_string(),
            version: SemVer::parse(version).unwrap(),
            architecture: architecture.to_string(),
            min_version: MacOsVersion::parse(min_version, "test minVersion").unwrap(),
            max_version_exclusive: max_version_exclusive
                .map(|value| MacOsVersion::parse(value, "test maxVersionExclusive").unwrap()),
            artifact: UpdateArtifact {
                artifact_id: artifact_id.to_string(),
                format: format.to_string(),
                url: valid_url(),
                size_bytes: 1,
                sha256: SHA256.to_string(),
            },
            signature: UpdateSignature {
                key_id: "test-key".to_string(),
                proof: "opaque-proof".to_string(),
            },
        }
    }

    fn manifest(releases: Vec<UpdateRelease>) -> UpdateManifest {
        UpdateManifest {
            product_id: "com.cornellmethod.notebook".to_string(),
            schema_version: 1,
            releases,
        }
    }

    fn select<'a>(
        manifest: &'a UpdateManifest,
    ) -> Result<UpdateSelection<'a>, UpdateSelectionError> {
        select_update(
            manifest,
            "1.0.0",
            TARGET_CHANNEL,
            TARGET_ARCHITECTURE,
            "14.0",
        )
    }

    #[test]
    fn selects_highest_compatible_version_independent_of_release_order() {
        let releases = vec![
            release(
                TARGET_CHANNEL,
                "1.9.0",
                TARGET_ARCHITECTURE,
                "13",
                Some("15"),
                TARGET_ARTIFACT_FORMAT,
                "older-compatible",
            ),
            release(
                TARGET_CHANNEL,
                "2.0.0+build.2",
                TARGET_ARCHITECTURE,
                "14",
                Some("15"),
                TARGET_ARTIFACT_FORMAT,
                "newest-compatible",
            ),
            release(
                TARGET_CHANNEL,
                "1.5.0",
                TARGET_ARCHITECTURE,
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "middle-compatible",
            ),
        ];
        let original = manifest(releases.clone());
        let reversed = manifest(releases.into_iter().rev().collect());

        for candidate_manifest in [&original, &reversed] {
            let selection = select(candidate_manifest).unwrap();
            let UpdateSelection::Selected(release) = selection else {
                panic!("expected an update candidate");
            };
            assert_eq!(release.artifact.artifact_id, "newest-compatible");
            assert_eq!(release.version.to_string(), "2.0.0+build.2");
        }
    }

    #[test]
    fn excludes_prerelease_downgrade_non_target_and_out_of_range_releases() {
        let candidate_manifest = manifest(vec![
            release(
                TARGET_CHANNEL,
                "2.0.0-rc.1",
                TARGET_ARCHITECTURE,
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "prerelease",
            ),
            release(
                TARGET_CHANNEL,
                "0.9.0",
                TARGET_ARCHITECTURE,
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "downgrade",
            ),
            release(
                "beta",
                "9.0.0",
                TARGET_ARCHITECTURE,
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "wrong-channel",
            ),
            release(
                TARGET_CHANNEL,
                "9.0.0",
                "x86_64-apple-darwin",
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "wrong-architecture",
            ),
            release(
                TARGET_CHANNEL,
                "9.0.0",
                TARGET_ARCHITECTURE,
                "14",
                None,
                "other-format",
                "wrong-format",
            ),
            release(
                TARGET_CHANNEL,
                "9.0.0",
                TARGET_ARCHITECTURE,
                "15",
                None,
                TARGET_ARTIFACT_FORMAT,
                "above-minimum",
            ),
            release(
                TARGET_CHANNEL,
                "9.0.0",
                TARGET_ARCHITECTURE,
                "13",
                Some("14"),
                TARGET_ARTIFACT_FORMAT,
                "at-exclusive-maximum",
            ),
        ]);

        assert!(matches!(
            select(&candidate_manifest),
            Ok(UpdateSelection::NoUpdate)
        ));
    }

    #[test]
    fn fails_closed_when_highest_version_has_multiple_compatible_candidates() {
        let candidate_manifest = manifest(vec![
            release(
                TARGET_CHANNEL,
                "2.0.0+one",
                TARGET_ARCHITECTURE,
                "13",
                Some("15"),
                TARGET_ARTIFACT_FORMAT,
                "candidate-one",
            ),
            release(
                TARGET_CHANNEL,
                "2.0.0+two",
                TARGET_ARCHITECTURE,
                "14",
                Some("16"),
                TARGET_ARTIFACT_FORMAT,
                "candidate-two",
            ),
            release(
                TARGET_CHANNEL,
                "1.5.0",
                TARGET_ARCHITECTURE,
                "14",
                None,
                TARGET_ARTIFACT_FORMAT,
                "lower-version",
            ),
        ]);

        assert!(matches!(
            select(&candidate_manifest),
            Err(UpdateSelectionError::Ambiguous {
                candidate_count: 2,
                ..
            })
        ));
    }

    #[test]
    fn distinguishes_invalid_target_input_from_no_update() {
        let empty_manifest = manifest(Vec::new());
        assert!(matches!(
            select_update(
                &empty_manifest,
                "not-semver",
                TARGET_CHANNEL,
                TARGET_ARCHITECTURE,
                "14"
            ),
            Err(UpdateSelectionError::InvalidInput(_))
        ));
        assert!(matches!(
            select_update(&empty_manifest, "1.0.0", "beta", TARGET_ARCHITECTURE, "14"),
            Err(UpdateSelectionError::InvalidInput(_))
        ));
        assert!(matches!(
            select_update(
                &empty_manifest,
                "1.0.0",
                TARGET_CHANNEL,
                TARGET_ARCHITECTURE,
                "14.x"
            ),
            Err(UpdateSelectionError::InvalidInput(_))
        ));
        assert!(matches!(
            select_update(
                &empty_manifest,
                "1.0.0",
                TARGET_CHANNEL,
                TARGET_ARCHITECTURE,
                "14"
            ),
            Ok(UpdateSelection::NoUpdate)
        ));
    }
}
