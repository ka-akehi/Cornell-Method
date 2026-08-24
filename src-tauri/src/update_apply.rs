use std::cmp::Ordering;
use std::sync::Arc;

use serde::Serialize;
use tauri::Manager;

use crate::lifecycle::{request_explicit_update_restart, AppState};
use crate::runtime::StorageLayout;
use crate::update_archive::{
    revalidate_verified_archive, ArchiveExtractionError, ExtractedArchive,
};
use crate::update_bundle::{validate_extracted_app_bundle, BundleValidationError};
use crate::update_download::{PackageDownloadError, VerifiedArchiveHandle};
use crate::update_manifest::MANIFEST_PRODUCT_ID;
use crate::update_provider::ReqwestManifestHttpTransport;
use crate::update_signature::EmbeddedTrustedKeyStore;
use crate::update_state::{
    current_timestamp, PendingUpdate, UpdateStateError, UpdateStateSnapshot, UpdateStateStore,
    UpdateStatus, VerificationState,
};
use crate::update_target::{load_update_target_context, UpdateTargetContext, UpdateTargetError};
use crate::update_verification::{
    revalidate_verified_candidate, VerifiedCandidateRevalidationError,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ApplyUpdateOutcome {
    RestartRequested,
    Busy,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ApplyUpdateResponse {
    pub(crate) outcome: ApplyUpdateOutcome,
    pub(crate) state: UpdateStateSnapshot,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum ApplyUpdateCommandCode {
    UpdateState,
    NoAvailableUpdate,
    UpdateNotVerified,
    UpdateCandidateChanged,
    UpdateTargetAppVersionInvalid,
    UpdateTargetMacosCommandFailed,
    UpdateTargetMacosOutputInvalid,
    UpdateTargetMismatch,
    UpdateRevalidation,
    UpdateIntegrity,
    UpdateSignatureKey,
    UpdateSignatureProof,
    UpdateArchive,
    UpdateBundle,
    StagingPath,
    StagingRead,
    StagingWrite,
    StagingRename,
    UpdateCommandWorkerFailed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub(crate) enum ApplyUpdateCommandError {
    CommandError { code: ApplyUpdateCommandCode },
    StateError { code: ApplyUpdateCommandCode },
}

impl ApplyUpdateCommandError {
    pub(crate) const fn state() -> Self {
        Self::StateError {
            code: ApplyUpdateCommandCode::UpdateState,
        }
    }

    pub(crate) const fn no_available_update() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::NoAvailableUpdate,
        }
    }

    pub(crate) const fn not_verified() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::UpdateNotVerified,
        }
    }

    pub(crate) const fn candidate_changed() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::UpdateCandidateChanged,
        }
    }

    pub(crate) const fn target_mismatch() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::UpdateTargetMismatch,
        }
    }

    pub(crate) const fn revalidation() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::UpdateRevalidation,
        }
    }

    pub(crate) const fn worker_failed() -> Self {
        Self::CommandError {
            code: ApplyUpdateCommandCode::UpdateCommandWorkerFailed,
        }
    }
}

impl From<UpdateStateError> for ApplyUpdateCommandError {
    fn from(_: UpdateStateError) -> Self {
        Self::state()
    }
}

impl From<UpdateTargetError> for ApplyUpdateCommandError {
    fn from(error: UpdateTargetError) -> Self {
        let code = match error {
            UpdateTargetError::InvalidAppVersion => {
                ApplyUpdateCommandCode::UpdateTargetAppVersionInvalid
            }
            UpdateTargetError::MacOsCommandFailed => {
                ApplyUpdateCommandCode::UpdateTargetMacosCommandFailed
            }
            UpdateTargetError::MacOsOutputInvalid => {
                ApplyUpdateCommandCode::UpdateTargetMacosOutputInvalid
            }
        };
        Self::CommandError { code }
    }
}

pub(crate) fn apply_verified_update_worker(
    app: tauri::AppHandle,
) -> Result<ApplyUpdateResponse, ApplyUpdateCommandError> {
    let state_store = app.state::<UpdateStateStore>();
    let Some(_operation) = state_store.try_acquire_operation()? else {
        return Ok(ApplyUpdateResponse {
            outcome: ApplyUpdateOutcome::Busy,
            state: state_store.read_only_snapshot()?,
        });
    };

    let state = state_store.snapshot();
    if state.status != UpdateStatus::Available {
        return Err(ApplyUpdateCommandError::no_available_update());
    }
    let candidate = state
        .pending_update
        .clone()
        .ok_or_else(ApplyUpdateCommandError::no_available_update)?;
    if candidate.verification_state != VerificationState::Verified
        || candidate.signed_identity_sha256.is_none()
        || candidate.package_path.is_none()
        || candidate.extracted_app_path.is_none()
        || candidate.sha256.is_none()
        || candidate.size_bytes.is_none()
        || candidate.verified_at.is_none()
    {
        return Err(ApplyUpdateCommandError::not_verified());
    }

    let target_context = load_update_target_context()?;
    validate_candidate_target(&candidate, &target_context)?;
    let storage = app.state::<StorageLayout>();
    candidate
        .validate_paths_at(&storage.staging_directory())
        .map_err(map_candidate_validation_error)?;

    let manifest_transport =
        ReqwestManifestHttpTransport::new().map_err(|_| ApplyUpdateCommandError::revalidation())?;
    let trust_store =
        EmbeddedTrustedKeyStore::embedded().map_err(|_| ApplyUpdateCommandError::CommandError {
            code: ApplyUpdateCommandCode::UpdateSignatureKey,
        })?;
    let revalidated = revalidate_verified_candidate(
        &candidate,
        &target_context,
        &storage.staging_directory(),
        &manifest_transport,
        &trust_store,
    )
    .map_err(map_revalidation_error)?;
    if revalidated.release.version.to_string() != candidate.version
        || revalidated.release.channel != candidate.channel
        || revalidated.release.architecture != candidate.architecture
    {
        return Err(ApplyUpdateCommandError::candidate_changed());
    }
    let staging_root = storage.staging_directory();
    revalidate_verified_archive(&revalidated.archive, &staging_root)
        .map_err(map_archive_error)
        .map_err(|code| ApplyUpdateCommandError::CommandError { code })?;
    validate_extracted_bundle(&candidate, &revalidated.archive, &staging_root)?;

    state_store.begin_apply_preparation(&candidate, current_timestamp())?;
    let response = ApplyUpdateResponse {
        outcome: ApplyUpdateOutcome::RestartRequested,
        state: UpdateStateSnapshot::from(&state_store.snapshot()),
    };
    let lifecycle_state = app.state::<Arc<AppState>>();
    request_explicit_update_restart(&app, lifecycle_state.inner().as_ref());
    Ok(response)
}

fn validate_candidate_target(
    candidate: &PendingUpdate,
    target_context: &UpdateTargetContext,
) -> Result<(), ApplyUpdateCommandError> {
    if candidate.channel != target_context.target_channel
        || candidate.architecture != target_context.target_architecture
    {
        return Err(ApplyUpdateCommandError::target_mismatch());
    }
    let candidate_version =
        crate::update_manifest::SemVer::parse(&candidate.version).map_err(|_| {
            ApplyUpdateCommandError::CommandError {
                code: ApplyUpdateCommandCode::UpdateTargetMismatch,
            }
        })?;
    if candidate_version.precedence_cmp(&target_context.current_app_version) != Ordering::Greater {
        return Err(ApplyUpdateCommandError::target_mismatch());
    }
    Ok(())
}

fn map_candidate_validation_error(error: UpdateStateError) -> ApplyUpdateCommandError {
    match error {
        UpdateStateError::Invalid(_) => ApplyUpdateCommandError::CommandError {
            code: ApplyUpdateCommandCode::StagingPath,
        },
        UpdateStateError::Storage(_) | UpdateStateError::LockPoisoned => {
            ApplyUpdateCommandError::state()
        }
    }
}

fn validate_extracted_bundle(
    candidate: &PendingUpdate,
    archive: &VerifiedArchiveHandle,
    staging_root: &std::path::Path,
) -> Result<(), ApplyUpdateCommandError> {
    let extracted_archive = ExtractedArchive {
        relative_app_path: candidate
            .extracted_app_path
            .clone()
            .ok_or_else(ApplyUpdateCommandError::not_verified)?,
        artifact_id: candidate.artifact.clone(),
        raw_sha256: candidate
            .sha256
            .clone()
            .ok_or_else(ApplyUpdateCommandError::not_verified)?,
        version: candidate.version.clone(),
        architecture: candidate.architecture.clone(),
    };
    if archive.archive.artifact_id != extracted_archive.artifact_id
        || archive.archive.raw_sha256 != extracted_archive.raw_sha256
        || archive.archive.version != extracted_archive.version
        || archive.archive.architecture != extracted_archive.architecture
    {
        return Err(ApplyUpdateCommandError::candidate_changed());
    }

    let verified_bundle = validate_extracted_app_bundle(&extracted_archive, staging_root)
        .map_err(map_bundle_error)?;
    if verified_bundle.relative_app_path != extracted_archive.relative_app_path
        || verified_bundle.bundle_identifier != MANIFEST_PRODUCT_ID
        || verified_bundle.version != candidate.version
        || verified_bundle.architecture != candidate.architecture
    {
        return Err(ApplyUpdateCommandError::CommandError {
            code: ApplyUpdateCommandCode::UpdateBundle,
        });
    }
    Ok(())
}

fn map_revalidation_error(error: VerifiedCandidateRevalidationError) -> ApplyUpdateCommandError {
    match error {
        VerifiedCandidateRevalidationError::Revalidation => ApplyUpdateCommandError::revalidation(),
        VerifiedCandidateRevalidationError::CandidateChanged => {
            ApplyUpdateCommandError::candidate_changed()
        }
        VerifiedCandidateRevalidationError::Package(error) => {
            ApplyUpdateCommandError::CommandError {
                code: map_package_error(error),
            }
        }
    }
}

fn map_package_error(error: PackageDownloadError) -> ApplyUpdateCommandCode {
    match error {
        PackageDownloadError::Size | PackageDownloadError::Digest => {
            ApplyUpdateCommandCode::UpdateIntegrity
        }
        PackageDownloadError::SignatureKey => ApplyUpdateCommandCode::UpdateSignatureKey,
        PackageDownloadError::Signature | PackageDownloadError::SignatureProof => {
            ApplyUpdateCommandCode::UpdateSignatureProof
        }
        PackageDownloadError::StagingPath => ApplyUpdateCommandCode::StagingPath,
        PackageDownloadError::StagingRead => ApplyUpdateCommandCode::StagingRead,
        PackageDownloadError::StagingWrite => ApplyUpdateCommandCode::StagingWrite,
        PackageDownloadError::StagingRename => ApplyUpdateCommandCode::StagingRename,
        PackageDownloadError::Network
        | PackageDownloadError::Timeout
        | PackageDownloadError::HttpStatus
        | PackageDownloadError::Redirect
        | PackageDownloadError::ContentType => ApplyUpdateCommandCode::UpdateRevalidation,
    }
}

fn map_archive_error(error: ArchiveExtractionError) -> ApplyUpdateCommandCode {
    match error {
        ArchiveExtractionError::StagingPath => ApplyUpdateCommandCode::StagingPath,
        ArchiveExtractionError::StagingRead => ApplyUpdateCommandCode::StagingRead,
        ArchiveExtractionError::StagingWrite => ApplyUpdateCommandCode::StagingWrite,
        ArchiveExtractionError::StagingRename => ApplyUpdateCommandCode::StagingRename,
        ArchiveExtractionError::ArchiveGzip
        | ArchiveExtractionError::ArchiveFormatUnsupported
        | ArchiveExtractionError::ArchiveTar
        | ArchiveExtractionError::ArchiveTrailingData
        | ArchiveExtractionError::ArchivePath
        | ArchiveExtractionError::ArchiveRoot
        | ArchiveExtractionError::ArchiveLimit
        | ArchiveExtractionError::ArchiveSymlink
        | ArchiveExtractionError::ArchiveSpecialFile
        | ArchiveExtractionError::ArchivePermission => ApplyUpdateCommandCode::UpdateArchive,
    }
}

fn map_bundle_error(error: BundleValidationError) -> ApplyUpdateCommandError {
    let code = match error {
        BundleValidationError::StagingPath => ApplyUpdateCommandCode::StagingPath,
        BundleValidationError::StagingRead => ApplyUpdateCommandCode::StagingRead,
        BundleValidationError::BundleLayout
        | BundleValidationError::BundlePlist
        | BundleValidationError::BundleIdentity
        | BundleValidationError::BundleVersion
        | BundleValidationError::BundleExecutable
        | BundleValidationError::BundleArchitecture => ApplyUpdateCommandCode::UpdateBundle,
    };
    ApplyUpdateCommandError::CommandError { code }
}
