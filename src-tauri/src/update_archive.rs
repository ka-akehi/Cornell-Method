use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};

use flate2::bufread::GzDecoder;
use tar::{Archive, EntryType};

use crate::update_download::VerifiedArchive;

pub(crate) const MAX_COMPRESSED_ARCHIVE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub(crate) const MAX_EXPANDED_REGULAR_BYTES: u64 = 8 * 1024 * 1024 * 1024;
pub(crate) const MAX_SINGLE_REGULAR_ENTRY_BYTES: u64 = 1024 * 1024 * 1024;
pub(crate) const MAX_MATERIAL_ENTRIES: usize = 250_000;
pub(crate) const MAX_PATH_BYTES: usize = 1024;
pub(crate) const MAX_SYMLINK_HOPS: usize = 16;

const ROOT_NAME: &str = "Cornell Method Notebook.app";
const IO_BUFFER_BYTES: usize = 64 * 1024;
const TAR_BLOCK_BYTES: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ArchiveExtractionError {
    ArchiveGzip,
    ArchiveTar,
    ArchiveTrailingData,
    ArchivePath,
    ArchiveRoot,
    ArchiveLimit,
    ArchiveSymlink,
    ArchiveSpecialFile,
    ArchivePermission,
    StagingPath,
    StagingRead,
    StagingWrite,
    StagingRename,
}

impl ArchiveExtractionError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::ArchiveGzip => "archive-gzip",
            Self::ArchiveTar => "archive-tar",
            Self::ArchiveTrailingData => "archive-trailing-data",
            Self::ArchivePath => "archive-path",
            Self::ArchiveRoot => "archive-root",
            Self::ArchiveLimit => "archive-limit",
            Self::ArchiveSymlink => "archive-symlink",
            Self::ArchiveSpecialFile => "archive-special-file",
            Self::ArchivePermission => "archive-permission",
            Self::StagingPath => "staging-path",
            Self::StagingRead => "staging-read",
            Self::StagingWrite => "staging-write",
            Self::StagingRename => "staging-rename",
        }
    }
}

impl fmt::Display for ArchiveExtractionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl std::error::Error for ArchiveExtractionError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ExtractedArchive {
    pub(crate) relative_app_path: PathBuf,
    pub(crate) artifact_id: String,
    pub(crate) raw_sha256: String,
    pub(crate) version: String,
    pub(crate) architecture: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MaterialKind {
    Directory,
    Regular,
    Symlink,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ArchiveEntrySpec {
    path: String,
    kind: MaterialKind,
    mode: u32,
    size: u64,
    link_target: Option<String>,
}

#[derive(Debug)]
struct LimitExceeded;

#[derive(Debug)]
struct GzipReadFailure;

impl fmt::Display for LimitExceeded {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("archive limit")
    }
}

impl std::error::Error for LimitExceeded {}

impl fmt::Display for GzipReadFailure {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("archive gzip")
    }
}

impl std::error::Error for GzipReadFailure {}

struct CappedCompressedReader {
    file: File,
    compressed_bytes: u64,
}

impl CappedCompressedReader {
    fn new(file: File) -> Self {
        Self {
            file,
            compressed_bytes: 0,
        }
    }

    fn into_file(self) -> File {
        self.file
    }
}

impl Read for CappedCompressedReader {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }
        if self.compressed_bytes >= MAX_COMPRESSED_ARCHIVE_BYTES {
            let file_size = self.file.metadata()?.len();
            if file_size <= self.compressed_bytes {
                return Ok(0);
            }
            return Err(io::Error::new(io::ErrorKind::Other, LimitExceeded));
        }
        let remaining = (MAX_COMPRESSED_ARCHIVE_BYTES - self.compressed_bytes) as usize;
        let read_limit = buffer.len().min(remaining);
        let bytes_read = self.file.read(&mut buffer[..read_limit])?;
        self.compressed_bytes = self
            .compressed_bytes
            .checked_add(bytes_read as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, LimitExceeded))?;
        Ok(bytes_read)
    }
}

struct LimitedArchiveReader {
    decoder: GzDecoder<BufReader<CappedCompressedReader>>,
    decompressed_bytes: u64,
    trailer_bytes: u64,
    trailer_nonzero: bool,
    tracking_trailer: bool,
    last_bytes: [u8; TAR_BLOCK_BYTES * 2],
    last_len: usize,
}

impl LimitedArchiveReader {
    fn new(file: File) -> Result<Self, ArchiveExtractionError> {
        let decoder = GzDecoder::new(BufReader::with_capacity(
            IO_BUFFER_BYTES,
            CappedCompressedReader::new(file),
        ));
        if decoder.header().is_none() {
            return Err(ArchiveExtractionError::ArchiveGzip);
        }
        Ok(Self {
            decoder,
            decompressed_bytes: 0,
            trailer_bytes: 0,
            trailer_nonzero: false,
            tracking_trailer: false,
            last_bytes: [0; TAR_BLOCK_BYTES * 2],
            last_len: 0,
        })
    }

    fn begin_tar_trailer(&mut self) {
        self.tracking_trailer = true;
        self.trailer_bytes = 0;
        self.trailer_nonzero = false;
    }

    fn finish_file(self) -> Result<File, ArchiveExtractionError> {
        let mut buffered = self.decoder.into_inner();
        let trailing = buffered.fill_buf().map_err(|error| {
            if error
                .get_ref()
                .is_some_and(|source| source.is::<LimitExceeded>())
            {
                ArchiveExtractionError::ArchiveLimit
            } else {
                ArchiveExtractionError::ArchiveGzip
            }
        })?;
        if !trailing.is_empty() {
            return Err(ArchiveExtractionError::ArchiveTrailingData);
        }
        let mut file = buffered.into_inner().into_file();
        file.seek(SeekFrom::Start(0))
            .map_err(|_| ArchiveExtractionError::StagingRead)?;
        Ok(file)
    }

    fn record_output(&mut self, bytes: &[u8]) {
        if self.tracking_trailer {
            self.trailer_bytes = self.trailer_bytes.saturating_add(bytes.len() as u64);
            if bytes.iter().any(|byte| *byte != 0) {
                self.trailer_nonzero = true;
            }
        }

        if bytes.len() >= self.last_bytes.len() {
            let start = bytes.len() - self.last_bytes.len();
            self.last_bytes.copy_from_slice(&bytes[start..]);
            self.last_len = self.last_bytes.len();
            return;
        }

        let keep = self.last_len.min(self.last_bytes.len() - bytes.len());
        if keep > 0 {
            let source_start = self.last_len - keep;
            self.last_bytes.copy_within(source_start..self.last_len, 0);
        }
        self.last_bytes[keep..keep + bytes.len()].copy_from_slice(bytes);
        self.last_len = keep + bytes.len();
    }
}

impl Read for LimitedArchiveReader {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }

        let bytes_read = self.decoder.read(buffer).map_err(|error| {
            if error
                .get_ref()
                .is_some_and(|source| source.is::<LimitExceeded>())
            {
                io::Error::new(io::ErrorKind::Other, LimitExceeded)
            } else {
                io::Error::new(io::ErrorKind::InvalidData, GzipReadFailure)
            }
        })?;
        if bytes_read == 0 {
            return Ok(0);
        }

        let next_total = self
            .decompressed_bytes
            .checked_add(bytes_read as u64)
            .ok_or_else(|| io::Error::new(io::ErrorKind::Other, LimitExceeded))?;
        if next_total > MAX_EXPANDED_REGULAR_BYTES {
            return Err(io::Error::new(io::ErrorKind::Other, LimitExceeded));
        }
        self.decompressed_bytes = next_total;
        self.record_output(&buffer[..bytes_read]);
        Ok(bytes_read)
    }
}

pub(crate) fn extract_verified_archive(
    verified_archive: &VerifiedArchive,
    staging_root: &Path,
) -> Result<ExtractedArchive, ArchiveExtractionError> {
    validate_staging_root(staging_root)?;
    let digest = validate_digest(&verified_archive.raw_sha256)?;
    let package_file =
        open_verified_package(staging_root, &verified_archive.relative_package_path)?;
    let package_size = package_file
        .metadata()
        .map_err(|_| ArchiveExtractionError::StagingRead)?
        .len();
    if package_size > MAX_COMPRESSED_ARCHIVE_BYTES {
        return Err(ArchiveExtractionError::ArchiveLimit);
    }

    let (specs, mut package_file) = preflight_archive(package_file)?;
    let extract_directory = staging_root.join("extract");
    ensure_directory_no_follow(&extract_directory)?;

    let ready_directory = extract_directory.join(&digest);
    if let Err(error) = ensure_ready_absent(&ready_directory) {
        return Err(error);
    }

    let temporary_directory = extract_directory.join(format!("{digest}.tmp"));
    create_temporary_directory(&temporary_directory)?;

    let extraction_result = (|| {
        prepare_directory_tree(&temporary_directory, &specs)?;
        package_file
            .seek(SeekFrom::Start(0))
            .map_err(|_| ArchiveExtractionError::StagingRead)?;
        extract_archive(&mut package_file, &temporary_directory, &specs)
    })();

    if let Err(error) = extraction_result {
        return Err(cleanup_temporary_directory(&temporary_directory, error));
    }

    if let Err(error) = ensure_ready_absent(&ready_directory) {
        return Err(cleanup_temporary_directory(&temporary_directory, error));
    }
    if fs::rename(&temporary_directory, &ready_directory).is_err() {
        return Err(cleanup_temporary_directory(
            &temporary_directory,
            ArchiveExtractionError::StagingRename,
        ));
    }

    Ok(ExtractedArchive {
        relative_app_path: PathBuf::from("extract").join(digest).join(ROOT_NAME),
        artifact_id: verified_archive.artifact_id.clone(),
        raw_sha256: verified_archive.raw_sha256.clone(),
        version: verified_archive.version.clone(),
        architecture: verified_archive.architecture.clone(),
    })
}

fn preflight_archive(
    package_file: File,
) -> Result<(Vec<ArchiveEntrySpec>, File), ArchiveExtractionError> {
    let reader = LimitedArchiveReader::new(package_file)?;
    let mut archive = Archive::new(reader);
    let mut specs = Vec::new();
    let mut expanded_regular_bytes = 0_u64;
    {
        let mut entries = archive.entries().map_err(|error| map_tar_error(&error))?;
        for result in &mut entries {
            if specs.len() >= MAX_MATERIAL_ENTRIES {
                return Err(ArchiveExtractionError::ArchiveLimit);
            }
            let mut entry = result.map_err(|error| map_tar_error(&error))?;
            let spec = inspect_entry(&mut entry)?;
            let actual_size = consume_entry(
                &mut entry,
                spec.kind,
                spec.size,
                None,
                &mut expanded_regular_bytes,
            )?;
            if spec.kind == MaterialKind::Regular && actual_size != spec.size {
                return Err(ArchiveExtractionError::ArchiveTar);
            }
            specs.push(spec);
        }
    }

    validate_archive_structure(&specs)?;
    let mut reader = archive.into_inner();
    finish_tar_stream(&mut reader)?;
    let package_file = reader.finish_file()?;
    Ok((specs, package_file))
}

fn extract_archive(
    package_file: &mut File,
    temporary_directory: &Path,
    expected_specs: &[ArchiveEntrySpec],
) -> Result<(), ArchiveExtractionError> {
    let reader = LimitedArchiveReader::new(
        package_file
            .try_clone()
            .map_err(|_| ArchiveExtractionError::StagingRead)?,
    )?;
    let mut archive = Archive::new(reader);
    let mut expanded_regular_bytes = 0_u64;
    let mut entry_index = 0_usize;
    {
        let mut entries = archive.entries().map_err(|error| map_tar_error(&error))?;
        for result in &mut entries {
            let mut entry = result.map_err(|error| map_tar_error(&error))?;
            let observed = inspect_entry(&mut entry)?;
            let expected = expected_specs
                .get(entry_index)
                .ok_or(ArchiveExtractionError::ArchiveTar)?;
            if &observed != expected {
                return Err(ArchiveExtractionError::ArchiveTar);
            }

            let target_path = archive_path_to_filesystem(temporary_directory, &observed.path);
            match observed.kind {
                MaterialKind::Directory => {
                    ensure_directory_no_follow(&target_path)?;
                }
                MaterialKind::Regular => {
                    let mut output = open_new_regular_file(&target_path)?;
                    let actual_size = consume_entry(
                        &mut entry,
                        observed.kind,
                        observed.size,
                        Some(&mut output),
                        &mut expanded_regular_bytes,
                    )?;
                    if actual_size != observed.size {
                        return Err(ArchiveExtractionError::ArchiveTar);
                    }
                    output
                        .flush()
                        .map_err(|_| ArchiveExtractionError::StagingWrite)?;
                    output
                        .sync_all()
                        .map_err(|_| ArchiveExtractionError::StagingWrite)?;
                    set_safe_mode(&target_path, observed.mode, observed.kind)?;
                }
                MaterialKind::Symlink => {
                    let link_target = observed
                        .link_target
                        .as_deref()
                        .ok_or(ArchiveExtractionError::ArchiveSymlink)?;
                    create_symlink(link_target, &target_path)?;
                }
            }
            entry_index += 1;
        }
    }

    if entry_index != expected_specs.len() {
        return Err(ArchiveExtractionError::ArchiveTar);
    }

    let mut reader = archive.into_inner();
    finish_tar_stream(&mut reader)?;
    let _ = reader.finish_file()?;

    for spec in expected_specs {
        if spec.kind == MaterialKind::Directory {
            let path = archive_path_to_filesystem(temporary_directory, &spec.path);
            set_safe_mode(&path, spec.mode, spec.kind)?;
        }
    }
    Ok(())
}

fn inspect_entry(
    entry: &mut tar::Entry<'_, LimitedArchiveReader>,
) -> Result<ArchiveEntrySpec, ArchiveExtractionError> {
    if let Some(extensions) = entry
        .pax_extensions()
        .map_err(|_| ArchiveExtractionError::ArchiveTar)?
    {
        for extension in extensions {
            let extension = extension.map_err(|_| ArchiveExtractionError::ArchiveTar)?;
            validate_pax_numeric_field(extension.key_bytes(), extension.value_bytes())?;
        }
    }

    let raw_path = entry.path_bytes();
    let (path, had_trailing_slash) = normalize_archive_path(&raw_path)?;
    let entry_type = entry.header().entry_type();
    let kind = if entry_type.is_dir() {
        MaterialKind::Directory
    } else if entry_type.is_file() || entry_type.is_gnu_sparse() {
        if had_trailing_slash {
            return Err(ArchiveExtractionError::ArchivePath);
        }
        MaterialKind::Regular
    } else if entry_type.is_symlink() {
        if had_trailing_slash {
            return Err(ArchiveExtractionError::ArchivePath);
        }
        MaterialKind::Symlink
    } else {
        return Err(ArchiveExtractionError::ArchiveSpecialFile);
    };

    let mode = entry
        .header()
        .mode()
        .map_err(|_| ArchiveExtractionError::ArchiveTar)?;
    validate_mode(&path, kind, mode)?;

    let size = entry.size();
    if kind != MaterialKind::Regular && size != 0 {
        return Err(ArchiveExtractionError::ArchiveTar);
    }
    if kind == MaterialKind::Regular {
        if size > MAX_SINGLE_REGULAR_ENTRY_BYTES {
            return Err(ArchiveExtractionError::ArchiveLimit);
        }
    }

    let link_target = match kind {
        MaterialKind::Symlink => {
            let raw_target = entry
                .link_name_bytes()
                .ok_or(ArchiveExtractionError::ArchiveSymlink)?;
            let target = normalize_symlink_target(&raw_target)?;
            Some(target)
        }
        _ => None,
    };

    Ok(ArchiveEntrySpec {
        path,
        kind,
        mode,
        size,
        link_target,
    })
}

fn consume_entry(
    entry: &mut tar::Entry<'_, LimitedArchiveReader>,
    kind: MaterialKind,
    expected_size: u64,
    mut output: Option<&mut File>,
    expanded_regular_bytes: &mut u64,
) -> Result<u64, ArchiveExtractionError> {
    if kind != MaterialKind::Regular {
        return Ok(0);
    }

    let mut buffer = [0_u8; IO_BUFFER_BYTES];
    let mut actual_size = 0_u64;
    loop {
        let bytes_read = entry.read(&mut buffer).map_err(|error| {
            if error
                .get_ref()
                .is_some_and(|source| source.is::<LimitExceeded>())
            {
                ArchiveExtractionError::ArchiveLimit
            } else if error
                .get_ref()
                .is_some_and(|source| source.is::<GzipReadFailure>())
            {
                ArchiveExtractionError::ArchiveGzip
            } else {
                ArchiveExtractionError::ArchiveTar
            }
        })?;
        if bytes_read == 0 {
            break;
        }

        actual_size = actual_size
            .checked_add(bytes_read as u64)
            .ok_or(ArchiveExtractionError::ArchiveLimit)?;
        if actual_size > expected_size || actual_size > MAX_SINGLE_REGULAR_ENTRY_BYTES {
            return Err(ArchiveExtractionError::ArchiveLimit);
        }
        *expanded_regular_bytes = expanded_regular_bytes
            .checked_add(bytes_read as u64)
            .ok_or(ArchiveExtractionError::ArchiveLimit)?;
        if *expanded_regular_bytes > MAX_EXPANDED_REGULAR_BYTES {
            return Err(ArchiveExtractionError::ArchiveLimit);
        }
        if let Some(file) = output.as_deref_mut() {
            file.write_all(&buffer[..bytes_read])
                .map_err(|_| ArchiveExtractionError::StagingWrite)?;
        }
    }
    Ok(actual_size)
}

fn finish_tar_stream(reader: &mut LimitedArchiveReader) -> Result<(), ArchiveExtractionError> {
    reader.begin_tar_trailer();
    let mut buffer = [0_u8; IO_BUFFER_BYTES];
    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|error| {
            if error
                .get_ref()
                .is_some_and(|source| source.is::<LimitExceeded>())
            {
                ArchiveExtractionError::ArchiveLimit
            } else {
                ArchiveExtractionError::ArchiveGzip
            }
        })?;
        if bytes_read == 0 {
            break;
        }
    }
    if reader.trailer_bytes < TAR_BLOCK_BYTES as u64 {
        return Err(ArchiveExtractionError::ArchiveTar);
    }
    if reader.trailer_nonzero {
        return Err(ArchiveExtractionError::ArchiveTrailingData);
    }
    if reader.last_len < TAR_BLOCK_BYTES * 2
        || reader.last_bytes[..TAR_BLOCK_BYTES * 2]
            .iter()
            .any(|byte| *byte != 0)
    {
        return Err(ArchiveExtractionError::ArchiveTar);
    }
    Ok(())
}

fn validate_archive_structure(specs: &[ArchiveEntrySpec]) -> Result<(), ArchiveExtractionError> {
    let mut by_path = HashMap::with_capacity(specs.len());
    for spec in specs {
        if !is_root_path(&spec.path) {
            return Err(ArchiveExtractionError::ArchiveRoot);
        }
        if spec.path == ROOT_NAME && spec.kind != MaterialKind::Directory {
            return Err(ArchiveExtractionError::ArchiveRoot);
        }
        if spec.path != ROOT_NAME
            && split_path(&spec.path)
                .iter()
                .skip(1)
                .any(|component| component.ends_with(".app"))
        {
            return Err(ArchiveExtractionError::ArchiveRoot);
        }
        if by_path.insert(spec.path.clone(), spec).is_some() {
            return Err(ArchiveExtractionError::ArchivePath);
        }
    }

    let root = by_path
        .get(ROOT_NAME)
        .ok_or(ArchiveExtractionError::ArchiveRoot)?;
    if root.kind != MaterialKind::Directory {
        return Err(ArchiveExtractionError::ArchiveRoot);
    }

    for spec in specs {
        let components = split_path(&spec.path);
        for prefix_len in 1..components.len() {
            let prefix = components[..prefix_len].join("/");
            if let Some(parent) = by_path.get(&prefix) {
                match parent.kind {
                    MaterialKind::Directory => {}
                    MaterialKind::Symlink => return Err(ArchiveExtractionError::ArchiveSymlink),
                    MaterialKind::Regular => return Err(ArchiveExtractionError::ArchivePath),
                }
            }
        }
    }

    for spec in specs {
        if spec.kind != MaterialKind::Symlink {
            continue;
        }
        let target = spec
            .link_target
            .as_deref()
            .ok_or(ArchiveExtractionError::ArchiveSymlink)?;
        resolve_symlink(&spec.path, target, &by_path)?;
    }
    Ok(())
}

fn resolve_symlink(
    link_path: &str,
    link_target: &str,
    by_path: &HashMap<String, &ArchiveEntrySpec>,
) -> Result<(), ArchiveExtractionError> {
    let mut current = link_path.to_owned();
    let mut visited = HashSet::new();
    let mut hops = 0_usize;
    loop {
        if !visited.insert(current.clone()) {
            return Err(ArchiveExtractionError::ArchiveSymlink);
        }
        let entry = by_path
            .get(&current)
            .ok_or(ArchiveExtractionError::ArchiveSymlink)?;
        if entry.kind != MaterialKind::Symlink {
            return Ok(());
        }
        if hops >= MAX_SYMLINK_HOPS {
            return Err(ArchiveExtractionError::ArchiveSymlink);
        }
        let target = if current == link_path {
            link_target
        } else {
            entry
                .link_target
                .as_deref()
                .ok_or(ArchiveExtractionError::ArchiveSymlink)?
        };
        current = resolve_relative_target(&current, target)?;
        hops += 1;
    }
}

fn resolve_relative_target(
    link_path: &str,
    target: &str,
) -> Result<String, ArchiveExtractionError> {
    let mut components = split_path(link_path);
    components.pop();
    for component in target.split('/') {
        if component == ".." {
            if components.len() <= 1 {
                return Err(ArchiveExtractionError::ArchiveSymlink);
            }
            components.pop();
        } else {
            components.push(component);
        }
    }
    if components.first().copied() != Some(ROOT_NAME) {
        return Err(ArchiveExtractionError::ArchiveSymlink);
    }
    Ok(components.join("/"))
}

fn normalize_archive_path(bytes: &[u8]) -> Result<(String, bool), ArchiveExtractionError> {
    validate_path_bytes(bytes)?;
    let had_trailing_slash = bytes.last() == Some(&b'/');
    let end = if had_trailing_slash {
        bytes.len() - 1
    } else {
        bytes.len()
    };
    let text =
        std::str::from_utf8(&bytes[..end]).map_err(|_| ArchiveExtractionError::ArchivePath)?;
    let components: Vec<&str> = text.split('/').collect();
    if components
        .iter()
        .any(|component| component.is_empty() || *component == "." || *component == "..")
    {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    Ok((components.join("/"), had_trailing_slash))
}

fn normalize_symlink_target(bytes: &[u8]) -> Result<String, ArchiveExtractionError> {
    validate_path_bytes(bytes).map_err(|_| ArchiveExtractionError::ArchiveSymlink)?;
    if bytes.first() == Some(&b'/') {
        return Err(ArchiveExtractionError::ArchiveSymlink);
    }
    let had_trailing_slash = bytes.last() == Some(&b'/');
    let end = if had_trailing_slash {
        bytes.len() - 1
    } else {
        bytes.len()
    };
    let text =
        std::str::from_utf8(&bytes[..end]).map_err(|_| ArchiveExtractionError::ArchiveSymlink)?;
    let components: Vec<&str> = text.split('/').collect();
    if components.is_empty()
        || components
            .iter()
            .any(|component| component.is_empty() || *component == ".")
    {
        return Err(ArchiveExtractionError::ArchiveSymlink);
    }
    Ok(text.to_owned())
}

fn validate_path_bytes(bytes: &[u8]) -> Result<(), ArchiveExtractionError> {
    if bytes.is_empty() || bytes.len() > MAX_PATH_BYTES {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    if bytes
        .iter()
        .any(|byte| *byte == b'\\' || *byte == 0 || *byte < 0x20 || *byte == 0x7f)
    {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    if bytes.first() == Some(&b'/') {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    if bytes.last() == Some(&b'/') && bytes.len() == 1 {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    if std::str::from_utf8(bytes)
        .map(|text| text.chars().any(char::is_control))
        .unwrap_or(true)
    {
        return Err(ArchiveExtractionError::ArchivePath);
    }
    Ok(())
}

fn validate_mode(path: &str, kind: MaterialKind, mode: u32) -> Result<(), ArchiveExtractionError> {
    if kind == MaterialKind::Symlink {
        return Ok(());
    }
    if mode & !0o7777 != 0 || mode & (0o4000 | 0o2000 | 0o1000 | 0o022) != 0 {
        return Err(ArchiveExtractionError::ArchivePermission);
    }
    if kind == MaterialKind::Regular
        && path.starts_with(&format!("{ROOT_NAME}/Contents/MacOS/"))
        && mode & 0o100 == 0
    {
        return Err(ArchiveExtractionError::ArchivePermission);
    }
    Ok(())
}

fn validate_pax_numeric_field(key: &[u8], value: &[u8]) -> Result<(), ArchiveExtractionError> {
    let is_size_field = key == b"size"
        || key == b"GNU.sparse.size"
        || key == b"GNU.sparse.realsize"
        || key == b"GNU.sparse.offset"
        || key == b"GNU.sparse.numbytes";
    if key == b"GNU.sparse.map" {
        return Err(ArchiveExtractionError::ArchiveTar);
    }
    if !is_size_field && key != b"GNU.sparse.numblocks" {
        return Ok(());
    }
    let value = std::str::from_utf8(value)
        .map_err(|_| ArchiveExtractionError::ArchiveLimit)?
        .parse::<u64>()
        .map_err(|_| ArchiveExtractionError::ArchiveLimit)?;
    let limit = if key == b"GNU.sparse.numblocks" {
        MAX_MATERIAL_ENTRIES as u64
    } else {
        MAX_EXPANDED_REGULAR_BYTES
    };
    if value > limit {
        return Err(ArchiveExtractionError::ArchiveLimit);
    }
    Ok(())
}

fn validate_staging_root(staging_root: &Path) -> Result<(), ArchiveExtractionError> {
    if !staging_root.is_absolute()
        || staging_root
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(ArchiveExtractionError::StagingPath);
    }
    match fs::symlink_metadata(staging_root) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            Err(ArchiveExtractionError::StagingPath)
        }
        Ok(_) => Ok(()),
        Err(_) => Err(ArchiveExtractionError::StagingRead),
    }
}

fn open_verified_package(
    staging_root: &Path,
    relative_package_path: &Path,
) -> Result<File, ArchiveExtractionError> {
    let components = safe_relative_components(relative_package_path)?;
    if components.is_empty() {
        return Err(ArchiveExtractionError::StagingPath);
    }

    let mut current = staging_root.to_path_buf();
    for component in &components[..components.len() - 1] {
        current.push(component);
        let metadata =
            fs::symlink_metadata(&current).map_err(|_| ArchiveExtractionError::StagingRead)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(ArchiveExtractionError::StagingPath);
        }
    }
    current.push(&components[components.len() - 1]);
    let metadata =
        fs::symlink_metadata(&current).map_err(|_| ArchiveExtractionError::StagingRead)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(ArchiveExtractionError::StagingPath);
    }

    open_read_only_no_follow(&current)
}

fn safe_relative_components(path: &Path) -> Result<Vec<String>, ArchiveExtractionError> {
    if path.is_absolute() {
        return Err(ArchiveExtractionError::StagingPath);
    }
    let mut components = Vec::new();
    for component in path.components() {
        let Component::Normal(value) = component else {
            return Err(ArchiveExtractionError::StagingPath);
        };
        let value = value.to_str().ok_or(ArchiveExtractionError::StagingPath)?;
        if value.is_empty() || value.contains('\\') || value.chars().any(char::is_control) {
            return Err(ArchiveExtractionError::StagingPath);
        }
        components.push(value.to_owned());
    }
    Ok(components)
}

fn open_read_only_no_follow(path: &Path) -> Result<File, ArchiveExtractionError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NOFOLLOW)
            .open(path)
            .map_err(|_| ArchiveExtractionError::StagingRead)
    }
    #[cfg(not(unix))]
    {
        OpenOptions::new()
            .read(true)
            .open(path)
            .map_err(|_| ArchiveExtractionError::StagingRead)
    }
}

fn ensure_directory_no_follow(path: &Path) -> Result<(), ArchiveExtractionError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            Err(ArchiveExtractionError::StagingPath)
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            fs::create_dir(path).map_err(|error| {
                if error.kind() == io::ErrorKind::AlreadyExists {
                    ArchiveExtractionError::StagingPath
                } else {
                    ArchiveExtractionError::StagingWrite
                }
            })?;
            let metadata =
                fs::symlink_metadata(path).map_err(|_| ArchiveExtractionError::StagingRead)?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(ArchiveExtractionError::StagingPath);
            }
            Ok(())
        }
        Err(_) => Err(ArchiveExtractionError::StagingRead),
    }
}

fn ensure_ready_absent(path: &Path) -> Result<(), ArchiveExtractionError> {
    match fs::symlink_metadata(path) {
        Ok(_) => Err(ArchiveExtractionError::StagingRename),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ArchiveExtractionError::StagingRead),
    }
}

fn create_temporary_directory(path: &Path) -> Result<(), ArchiveExtractionError> {
    fs::create_dir(path).map_err(|error| {
        if error.kind() == io::ErrorKind::AlreadyExists {
            ArchiveExtractionError::StagingPath
        } else {
            ArchiveExtractionError::StagingWrite
        }
    })?;
    ensure_directory_no_follow(path)
}

fn cleanup_temporary_directory(
    path: &Path,
    original: ArchiveExtractionError,
) -> ArchiveExtractionError {
    if fs::remove_dir_all(path).is_ok() {
        original
    } else {
        ArchiveExtractionError::StagingWrite
    }
}

fn prepare_directory_tree(
    temporary_directory: &Path,
    specs: &[ArchiveEntrySpec],
) -> Result<(), ArchiveExtractionError> {
    for spec in specs {
        let path = archive_path_to_filesystem(temporary_directory, &spec.path);
        ensure_parent_directories(temporary_directory, &spec.path)?;
        if spec.kind == MaterialKind::Directory {
            ensure_directory_no_follow(&path)?;
        }
    }
    Ok(())
}

fn ensure_parent_directories(
    temporary_directory: &Path,
    archive_path: &str,
) -> Result<(), ArchiveExtractionError> {
    let components = split_path(archive_path);
    let mut current = temporary_directory.to_path_buf();
    for component in components.iter().take(components.len().saturating_sub(1)) {
        current.push(component);
        ensure_directory_no_follow(&current)?;
    }
    Ok(())
}

fn archive_path_to_filesystem(root: &Path, archive_path: &str) -> PathBuf {
    let mut result = root.to_path_buf();
    for component in split_path(archive_path) {
        result.push(component);
    }
    result
}

fn open_new_regular_file(path: &Path) -> Result<File, ArchiveExtractionError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .custom_flags(libc::O_NOFOLLOW)
            .open(path)
            .map_err(|error| {
                if error.kind() == io::ErrorKind::AlreadyExists {
                    ArchiveExtractionError::StagingPath
                } else {
                    ArchiveExtractionError::StagingWrite
                }
            })
    }
    #[cfg(not(unix))]
    {
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|error| {
                if error.kind() == io::ErrorKind::AlreadyExists {
                    ArchiveExtractionError::StagingPath
                } else {
                    ArchiveExtractionError::StagingWrite
                }
            })
    }
}

fn create_symlink(target: &str, path: &Path) -> Result<(), ArchiveExtractionError> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, path).map_err(|_| ArchiveExtractionError::StagingWrite)
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_file(target, path)
            .map_err(|_| ArchiveExtractionError::StagingWrite)
    }
}

fn set_safe_mode(path: &Path, mode: u32, kind: MaterialKind) -> Result<(), ArchiveExtractionError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let safe_mode = match kind {
            MaterialKind::Directory => 0o700,
            MaterialKind::Regular if mode & 0o100 != 0 => 0o700,
            MaterialKind::Regular => 0o600,
            MaterialKind::Symlink => return Ok(()),
        };
        fs::set_permissions(path, fs::Permissions::from_mode(safe_mode))
            .map_err(|_| ArchiveExtractionError::StagingWrite)
    }
    #[cfg(not(unix))]
    {
        let _ = (path, mode, kind);
        Ok(())
    }
}

fn is_root_path(path: &str) -> bool {
    path == ROOT_NAME || path.starts_with(&format!("{ROOT_NAME}/"))
}

fn split_path(path: &str) -> Vec<&str> {
    path.split('/').collect()
}

fn validate_digest(value: &str) -> Result<String, ArchiveExtractionError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(ArchiveExtractionError::StagingPath);
    }
    Ok(value.to_owned())
}

fn map_tar_error(error: &io::Error) -> ArchiveExtractionError {
    if error
        .get_ref()
        .is_some_and(|source| source.is::<LimitExceeded>())
    {
        ArchiveExtractionError::ArchiveLimit
    } else if error
        .get_ref()
        .is_some_and(|source| source.is::<GzipReadFailure>())
    {
        ArchiveExtractionError::ArchiveGzip
    } else {
        ArchiveExtractionError::ArchiveTar
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    use tar::{Builder, Header};

    static NEXT_ROOT: AtomicU64 = AtomicU64::new(0);

    struct TestRoot {
        path: PathBuf,
    }

    impl TestRoot {
        fn new() -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock")
                .as_nanos();
            let counter = NEXT_ROOT.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "cornell-method-update-archive-{timestamp}-{counter}"
            ));
            fs::create_dir(&path).expect("test root");
            fs::create_dir(path.join("packages")).expect("packages");
            Self { path }
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn verified(root: &Path, bytes: &[u8]) -> VerifiedArchive {
        let digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        fs::write(
            root.join("packages").join(format!("{digest}.app.tar.gz")),
            bytes,
        )
        .expect("package");
        VerifiedArchive {
            relative_package_path: PathBuf::from("packages").join(format!("{digest}.app.tar.gz")),
            artifact_id: "test-artifact".to_owned(),
            raw_size_bytes: bytes.len() as u64,
            raw_sha256: digest.to_owned(),
            version: "1.2.3".to_owned(),
            architecture: "aarch64".to_owned(),
        }
    }

    fn append_directory(builder: &mut Builder<&mut GzEncoder<Vec<u8>>>, path: &str, mode: u32) {
        let mut header = Header::new_gnu();
        header.set_path(path).expect("directory path");
        header.set_entry_type(EntryType::dir());
        header.set_mode(mode);
        header.set_size(0);
        builder
            .append_data(&mut header, path, io::empty())
            .expect("directory");
    }

    fn append_file(
        builder: &mut Builder<&mut GzEncoder<Vec<u8>>>,
        path: &str,
        mode: u32,
        contents: &[u8],
    ) {
        let mut header = Header::new_gnu();
        header.set_path(path).expect("file path");
        header.set_entry_type(EntryType::file());
        header.set_mode(mode);
        header.set_size(contents.len() as u64);
        builder
            .append_data(&mut header, path, contents)
            .expect("file");
    }

    fn append_link(builder: &mut Builder<&mut GzEncoder<Vec<u8>>>, path: &str, target: &str) {
        let mut header = Header::new_gnu();
        header.set_path(path).expect("link path");
        header.set_entry_type(EntryType::symlink());
        header.set_link_name(target).expect("link target");
        header.set_mode(0o777);
        header.set_size(0);
        builder
            .append_data(&mut header, path, io::empty())
            .expect("link");
    }

    fn archive_with_raw_entry(path: &[u8], entry_type: u8) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, ROOT_NAME, 0o755);
            let mut header = Header::new_gnu();
            header.set_path(ROOT_NAME).expect("raw header seed");
            header.set_mode(0o644);
            header.set_size(0);
            let name = &mut header.as_mut_bytes()[..100];
            name.fill(0);
            name[..path.len()].copy_from_slice(path);
            header.as_mut_bytes()[156] = entry_type;
            header.set_cksum();
            builder.append(&header, io::empty()).expect("raw entry");
            builder.finish().expect("tar finish");
        }
        encoder.finish().expect("gzip finish")
    }

    fn valid_archive() -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, ROOT_NAME, 0o755);
            append_directory(&mut builder, &format!("{ROOT_NAME}/Contents/"), 0o755);
            append_directory(&mut builder, &format!("{ROOT_NAME}/Contents/MacOS/"), 0o755);
            append_file(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/MacOS/notebook"),
                0o755,
                b"not a Mach-O fixture",
            );
            append_file(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/Info.plist"),
                0o644,
                b"metadata is intentionally not inspected",
            );
            append_link(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/current"),
                "MacOS/notebook",
            );
            builder.finish().expect("tar finish");
        }
        encoder.finish().expect("gzip finish")
    }

    fn assert_error(result: Result<ExtractedArchive, ArchiveExtractionError>, code: &str) {
        let error = result.expect_err("expected archive error");
        assert_eq!(error.code(), code);
        assert_eq!(error.to_string(), code);
    }

    #[test]
    fn extracts_valid_archive_to_relative_ready_path_and_preserves_input() {
        let root = TestRoot::new();
        let bytes = valid_archive();
        let verified_archive = verified(&root.path, &bytes);
        let package_path = root.path.join(&verified_archive.relative_package_path);
        let package_before = fs::read(&package_path).expect("package before");

        let extracted = extract_verified_archive(&verified_archive, &root.path).expect("extract");
        assert_eq!(
            extracted.relative_app_path,
            PathBuf::from("extract")
                .join(&verified_archive.raw_sha256)
                .join(ROOT_NAME)
        );
        assert!(root
            .path
            .join(&extracted.relative_app_path)
            .join("Contents/MacOS/notebook")
            .is_file());
        assert!(root
            .path
            .join(&extracted.relative_app_path)
            .join("Contents/current")
            .is_symlink());
        assert_eq!(
            fs::read(&package_path).expect("package after"),
            package_before
        );
    }

    #[test]
    fn rejects_invalid_gzip_crc_and_compressed_trailing_data() {
        let root = TestRoot::new();
        let valid = valid_archive();

        let mut invalid_gzip = verified(&root.path, b"not gzip");
        assert_error(
            extract_verified_archive(&invalid_gzip, &root.path),
            "archive-gzip",
        );

        let mut crc = valid.clone();
        let crc_offset = crc.len() - 8;
        crc[crc_offset] ^= 1;
        invalid_gzip = verified(&root.path, &crc);
        assert_error(
            extract_verified_archive(&invalid_gzip, &root.path),
            "archive-gzip",
        );

        let mut trailing = valid;
        trailing.extend_from_slice(b"trailing");
        invalid_gzip = verified(&root.path, &trailing);
        assert_error(
            extract_verified_archive(&invalid_gzip, &root.path),
            "archive-trailing-data",
        );

        let mut second_member = GzEncoder::new(Vec::new(), Compression::default());
        second_member
            .write_all(b"second gzip member")
            .expect("member");
        let second_member = second_member.finish().expect("second gzip finish");
        let mut concatenated = valid_archive();
        concatenated.extend_from_slice(&second_member);
        invalid_gzip = verified(&root.path, &concatenated);
        assert_error(
            extract_verified_archive(&invalid_gzip, &root.path),
            "archive-trailing-data",
        );

        let valid_for_truncation = valid_archive();
        let mut tar_decoder = flate2::read::GzDecoder::new(&valid_for_truncation[..]);
        let mut truncated_tar = Vec::new();
        tar_decoder
            .read_to_end(&mut truncated_tar)
            .expect("decode tar");
        truncated_tar.truncate(truncated_tar.len() - TAR_BLOCK_BYTES);
        let mut truncated_encoder = GzEncoder::new(Vec::new(), Compression::default());
        truncated_encoder
            .write_all(&truncated_tar)
            .expect("truncated tar");
        let truncated = truncated_encoder.finish().expect("truncated gzip finish");
        invalid_gzip = verified(&root.path, &truncated);
        assert_error(
            extract_verified_archive(&invalid_gzip, &root.path),
            "archive-tar",
        );
    }

    #[test]
    fn rejects_root_wrapper_nested_app_and_permission_abuse() {
        let root = TestRoot::new();

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, "release/", 0o755);
            append_directory(&mut builder, &format!("release/{ROOT_NAME}/"), 0o755);
            builder.finish().expect("tar finish");
        }
        let wrapper = encoder.finish().expect("gzip finish");
        let archive = verified(&root.path, &wrapper);
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "archive-root",
        );

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, ROOT_NAME, 0o755);
            append_directory(&mut builder, &format!("{ROOT_NAME}/Nested.app/"), 0o755);
            builder.finish().expect("tar finish");
        }
        let nested = encoder.finish().expect("gzip finish");
        let archive = verified(&root.path, &nested);
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "archive-root",
        );

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, ROOT_NAME, 0o755);
            append_file(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/MacOS/notebook"),
                0o644,
                b"binary",
            );
            builder.finish().expect("tar finish");
        }
        let permission = encoder.finish().expect("gzip finish");
        let archive = verified(&root.path, &permission);
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "archive-permission",
        );
    }

    #[test]
    fn rejects_path_components_special_files_hardlinks_and_package_traversal() {
        let root = TestRoot::new();
        let cases = [
            (b"/tmp/outside".as_slice(), "archive-path", 0),
            (
                b"Cornell Method Notebook.app/./file".as_slice(),
                "archive-path",
                0,
            ),
            (
                b"Cornell Method Notebook.app/../file".as_slice(),
                "archive-path",
                0,
            ),
            (
                b"Cornell Method Notebook.app//file".as_slice(),
                "archive-path",
                0,
            ),
            (
                b"Cornell Method Notebook.app/Contents\\bad".as_slice(),
                "archive-path",
                0,
            ),
            (
                b"Cornell Method Notebook.app/Contents/special".as_slice(),
                "archive-special-file",
                b'3',
            ),
            (
                b"Cornell Method Notebook.app/Contents/hardlink".as_slice(),
                "archive-special-file",
                b'1',
            ),
        ];
        for (path, code, entry_type) in cases {
            let bytes = archive_with_raw_entry(path, entry_type);
            let archive = verified(&root.path, &bytes);
            assert_error(extract_verified_archive(&archive, &root.path), code);
        }

        let bytes = valid_archive();
        let mut archive = verified(&root.path, &bytes);
        archive.relative_package_path = PathBuf::from("../outside.app.tar.gz");
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "staging-path",
        );
    }

    #[test]
    fn rejects_external_dangling_and_loop_symlinks_and_cleans_partial_tree() {
        let root = TestRoot::new();
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut encoder);
            append_directory(&mut builder, ROOT_NAME, 0o755);
            append_directory(&mut builder, &format!("{ROOT_NAME}/Contents/"), 0o755);
            append_link(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/external"),
                "../../outside",
            );
            append_file(
                &mut builder,
                &format!("{ROOT_NAME}/Contents/after"),
                0o644,
                b"partial tree must be removed",
            );
            builder.finish().expect("tar finish");
        }
        let bytes = encoder.finish().expect("gzip finish");
        let archive = verified(&root.path, &bytes);
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "archive-symlink",
        );
        let digest = &archive.raw_sha256;
        assert!(!root
            .path
            .join("extract")
            .join(format!("{digest}.tmp"))
            .exists());
    }

    #[test]
    fn rejects_symlink_package_path_and_ready_collision_without_overwrite() {
        let root = TestRoot::new();
        let bytes = valid_archive();
        let archive = verified(&root.path, &bytes);
        let package = root.path.join(&archive.relative_package_path);
        let target = root.path.join("real-package");
        fs::rename(&package, &target).expect("move package");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &package).expect("package link");
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "staging-path",
        );

        let root = TestRoot::new();
        let archive = verified(&root.path, &bytes);
        let ready = root.path.join("extract").join(&archive.raw_sha256);
        fs::create_dir_all(&ready).expect("ready collision");
        fs::write(ready.join("untouched"), b"keep").expect("collision marker");
        assert_error(
            extract_verified_archive(&archive, &root.path),
            "staging-rename",
        );
        assert_eq!(fs::read(ready.join("untouched")).expect("marker"), b"keep");
    }
}
