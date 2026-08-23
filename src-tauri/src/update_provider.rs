use std::collections::HashSet;
use std::fmt;
use std::io::{self, Read};
use std::time::{Duration, Instant};

use reqwest::blocking::{Client, Response};
use reqwest::header::{CONTENT_TYPE, LOCATION};
use reqwest::Url;

use crate::update_manifest::{parse_manifest, UpdateManifest};

pub(crate) const GITHUB_RELEASES_MANIFEST_URL: &str =
    "https://github.com/ka-akehi/Cornell-Method/releases/latest/download/cornell-method-notebook-update-manifest.json";
pub(crate) const MANIFEST_FETCH_TIMEOUT: Duration = Duration::from_secs(15);
pub(crate) const MAX_MANIFEST_REDIRECT_HOPS: usize = 5;
pub(crate) const MAX_MANIFEST_BODY_BYTES: usize = 1_048_576;
pub(crate) const ALLOWED_MANIFEST_CONTENT_TYPES: &[&str] =
    &["application/json", "application/octet-stream"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ManifestProviderError {
    Network,
    Timeout,
    Redirect,
    HttpStatus,
    ContentType,
    EmptyResponse,
    ResponseTooLarge,
    InvalidEncoding,
    InvalidJson,
    InvalidManifest,
    Internal,
}

impl ManifestProviderError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::Network => "provider-network",
            Self::Timeout => "provider-timeout",
            Self::Redirect => "provider-redirect",
            Self::HttpStatus => "provider-http-status",
            Self::ContentType => "provider-content-type",
            Self::EmptyResponse => "provider-empty-response",
            Self::ResponseTooLarge => "provider-response-too-large",
            Self::InvalidEncoding => "provider-invalid-encoding",
            Self::InvalidJson => "provider-invalid-json",
            Self::InvalidManifest => "provider-invalid-manifest",
            Self::Internal => "provider-internal",
        }
    }
}

impl fmt::Display for ManifestProviderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl std::error::Error for ManifestProviderError {}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ManifestHttpError {
    Network,
    Timeout,
    Tls,
    Redirect,
    ContentType,
    ResponseTooLarge,
    Internal,
}

impl From<ManifestHttpError> for ManifestProviderError {
    fn from(error: ManifestHttpError) -> Self {
        match error {
            ManifestHttpError::Network | ManifestHttpError::Tls => Self::Network,
            ManifestHttpError::Timeout => Self::Timeout,
            ManifestHttpError::Redirect => Self::Redirect,
            ManifestHttpError::ContentType => Self::ContentType,
            ManifestHttpError::ResponseTooLarge => Self::ResponseTooLarge,
            ManifestHttpError::Internal => Self::Internal,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ManifestHttpRequest {
    pub(crate) url: &'static str,
    pub(crate) timeout: Duration,
    pub(crate) max_redirects: usize,
    pub(crate) max_body_bytes: usize,
    pub(crate) accepted_content_types: &'static [&'static str],
}

impl ManifestHttpRequest {
    fn fixed() -> Self {
        Self {
            url: GITHUB_RELEASES_MANIFEST_URL,
            timeout: MANIFEST_FETCH_TIMEOUT,
            max_redirects: MAX_MANIFEST_REDIRECT_HOPS,
            max_body_bytes: MAX_MANIFEST_BODY_BYTES,
            accepted_content_types: ALLOWED_MANIFEST_CONTENT_TYPES,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ManifestRedirect {
    pub(crate) status: u16,
    pub(crate) location: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ManifestHttpResponse {
    pub(crate) status: u16,
    pub(crate) content_type: Option<String>,
    pub(crate) content_length: Option<u64>,
    pub(crate) body: Vec<u8>,
    pub(crate) redirects: Vec<ManifestRedirect>,
    pub(crate) final_url: String,
}

pub(crate) trait ManifestHttpTransport {
    fn get(&self, request: ManifestHttpRequest) -> Result<ManifestHttpResponse, ManifestHttpError>;
}

pub(crate) struct ReqwestManifestHttpTransport {
    client: Client,
}

impl ReqwestManifestHttpTransport {
    pub(crate) fn new() -> Result<Self, ManifestProviderError> {
        let client = Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(MANIFEST_FETCH_TIMEOUT)
            .build()
            .map_err(|_| ManifestProviderError::Internal)?;
        Ok(Self { client })
    }
}

impl ManifestHttpTransport for ReqwestManifestHttpTransport {
    fn get(&self, request: ManifestHttpRequest) -> Result<ManifestHttpResponse, ManifestHttpError> {
        if !is_fixed_request(&request) {
            return Err(ManifestHttpError::Internal);
        }

        let mut current_url = Url::parse(request.url).map_err(|_| ManifestHttpError::Internal)?;
        if !is_safe_https_url(&current_url)
            || current_url.query().is_some()
            || current_url.fragment().is_some()
        {
            return Err(ManifestHttpError::Internal);
        }

        let deadline = Instant::now()
            .checked_add(request.timeout)
            .ok_or(ManifestHttpError::Internal)?;
        let mut visited = HashSet::new();
        visited.insert(current_url.to_string());
        let mut redirects = Vec::new();

        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(ManifestHttpError::Timeout);
            }

            let response = self
                .client
                .get(current_url.clone())
                .timeout(remaining)
                .send()
                .map_err(|error| map_reqwest_error(error, deadline))?;
            let status = response.status().as_u16();

            if is_redirect_status(status) {
                if redirects.len() >= request.max_redirects {
                    return Err(ManifestHttpError::Redirect);
                }
                let location = response
                    .headers()
                    .get(LOCATION)
                    .and_then(|value| value.to_str().ok())
                    .ok_or(ManifestHttpError::Redirect)?;
                let next_url = resolve_redirect(&current_url, location)
                    .map_err(|_| ManifestHttpError::Redirect)?;
                if !visited.insert(next_url.to_string()) {
                    return Err(ManifestHttpError::Redirect);
                }
                redirects.push(ManifestRedirect {
                    status,
                    location: Some(location.to_string()),
                });
                current_url = next_url;
                continue;
            }

            let content_type = response_content_type(&response);
            let content_length = response.content_length();
            if status == 200 {
                if !is_allowed_content_type(content_type.as_deref(), request.accepted_content_types)
                {
                    return Err(ManifestHttpError::ContentType);
                }
                if content_length.is_some_and(|length| length > request.max_body_bytes as u64) {
                    return Err(ManifestHttpError::ResponseTooLarge);
                }
            }

            let body = if status == 200 {
                read_limited_body(response, request.max_body_bytes, deadline)?
            } else {
                Vec::new()
            };

            return Ok(ManifestHttpResponse {
                status,
                content_type,
                content_length,
                body,
                redirects,
                final_url: current_url.to_string(),
            });
        }
    }
}

pub(crate) fn fetch_manifest_from_github() -> Result<UpdateManifest, ManifestProviderError> {
    let transport = ReqwestManifestHttpTransport::new()?;
    fetch_manifest(&transport)
}

pub(crate) fn fetch_manifest<T: ManifestHttpTransport + ?Sized>(
    transport: &T,
) -> Result<UpdateManifest, ManifestProviderError> {
    let request = ManifestHttpRequest::fixed();
    let response = transport
        .get(request.clone())
        .map_err(ManifestProviderError::from)?;

    validate_redirect_trace(&request, &response)?;
    if response.status != 200 {
        return Err(ManifestProviderError::HttpStatus);
    }
    if !is_allowed_content_type(
        response.content_type.as_deref(),
        request.accepted_content_types,
    ) {
        return Err(ManifestProviderError::ContentType);
    }
    if response
        .content_length
        .is_some_and(|length| length > request.max_body_bytes as u64)
        || response.body.len() > request.max_body_bytes
    {
        return Err(ManifestProviderError::ResponseTooLarge);
    }
    if response.body.is_empty() {
        return Err(ManifestProviderError::EmptyResponse);
    }

    let text =
        String::from_utf8(response.body).map_err(|_| ManifestProviderError::InvalidEncoding)?;
    serde_json::from_str::<serde_json::Value>(&text)
        .map_err(|_| ManifestProviderError::InvalidJson)?;
    parse_manifest(&text).map_err(|_| ManifestProviderError::InvalidManifest)
}

fn is_fixed_request(request: &ManifestHttpRequest) -> bool {
    request.url == GITHUB_RELEASES_MANIFEST_URL
        && request.timeout == MANIFEST_FETCH_TIMEOUT
        && request.max_redirects == MAX_MANIFEST_REDIRECT_HOPS
        && request.max_body_bytes == MAX_MANIFEST_BODY_BYTES
        && request.accepted_content_types == ALLOWED_MANIFEST_CONTENT_TYPES
}

fn is_redirect_status(status: u16) -> bool {
    matches!(status, 301 | 302 | 303 | 307 | 308)
}

fn is_safe_https_url(url: &Url) -> bool {
    url.scheme().eq_ignore_ascii_case("https")
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
}

fn resolve_redirect(current_url: &Url, location: &str) -> Result<Url, ()> {
    if location.is_empty() || location.trim() != location || location.chars().any(char::is_control)
    {
        return Err(());
    }
    let next_url = current_url.join(location).map_err(|_| ())?;
    if !is_safe_https_url(&next_url) {
        return Err(());
    }
    Ok(next_url)
}

fn validate_redirect_trace(
    request: &ManifestHttpRequest,
    response: &ManifestHttpResponse,
) -> Result<(), ManifestProviderError> {
    let mut current_url = Url::parse(request.url).map_err(|_| ManifestProviderError::Internal)?;
    if !is_safe_https_url(&current_url)
        || current_url.query().is_some()
        || current_url.fragment().is_some()
    {
        return Err(ManifestProviderError::Internal);
    }

    if response.redirects.len() > request.max_redirects {
        return Err(ManifestProviderError::Redirect);
    }
    let mut visited = HashSet::new();
    visited.insert(current_url.to_string());
    for redirect in &response.redirects {
        if !is_redirect_status(redirect.status) {
            return Err(ManifestProviderError::Redirect);
        }
        let location = redirect
            .location
            .as_deref()
            .ok_or(ManifestProviderError::Redirect)?;
        let next_url = resolve_redirect(&current_url, location)
            .map_err(|_| ManifestProviderError::Redirect)?;
        if !visited.insert(next_url.to_string()) {
            return Err(ManifestProviderError::Redirect);
        }
        current_url = next_url;
    }

    let final_url = Url::parse(&response.final_url).map_err(|_| ManifestProviderError::Redirect)?;
    if !is_safe_https_url(&final_url) || final_url != current_url {
        return Err(ManifestProviderError::Redirect);
    }
    Ok(())
}

fn response_content_type(response: &Response) -> Option<String> {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
}

fn is_allowed_content_type(content_type: Option<&str>, allowed: &[&str]) -> bool {
    let Some(media_type) = content_type.and_then(|value| value.split(';').next()) else {
        return false;
    };
    let media_type = media_type.trim();
    !media_type.is_empty()
        && allowed
            .iter()
            .any(|candidate| media_type.eq_ignore_ascii_case(candidate))
}

fn read_limited_body<R: Read>(
    mut reader: R,
    max_body_bytes: usize,
    deadline: Instant,
) -> Result<Vec<u8>, ManifestHttpError> {
    let mut body = Vec::new();
    let mut buffer = [0_u8; 8192];
    loop {
        if Instant::now() >= deadline {
            return Err(ManifestHttpError::Timeout);
        }
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|error| map_io_error(error, deadline))?;
        if bytes_read == 0 {
            return Ok(body);
        }
        if bytes_read > max_body_bytes.saturating_sub(body.len()) {
            return Err(ManifestHttpError::ResponseTooLarge);
        }
        body.extend_from_slice(&buffer[..bytes_read]);
    }
}

fn map_reqwest_error(error: reqwest::Error, deadline: Instant) -> ManifestHttpError {
    if error.is_timeout() || Instant::now() >= deadline {
        ManifestHttpError::Timeout
    } else {
        ManifestHttpError::Network
    }
}

fn map_io_error(error: io::Error, deadline: Instant) -> ManifestHttpError {
    if error.kind() == io::ErrorKind::TimedOut || Instant::now() >= deadline {
        ManifestHttpError::Timeout
    } else {
        ManifestHttpError::Network
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::io::Cursor;

    const VALID_MANIFEST: &[u8] = br#"{
      "productId":"com.cornellmethod.notebook",
      "schemaVersion":1,
      "releases":[{
        "channel":"stable",
        "version":"1.2.3",
        "architecture":"aarch64-apple-darwin",
        "minVersion":"14",
        "artifact":{
          "artifactId":"cornell-method-notebook-1.2.3",
          "format":"app-archive",
          "url":"https://updates.example.test/cornell-method-notebook-1.2.3",
          "sizeBytes":123,
          "sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        },
        "signature":{"keyId":"test-key","proof":"opaque-proof"}
      }]
    }"#;

    fn response(body: impl Into<Vec<u8>>) -> ManifestHttpResponse {
        let body = body.into();
        ManifestHttpResponse {
            status: 200,
            content_type: Some("application/json".to_string()),
            content_length: Some(body.len() as u64),
            body,
            redirects: Vec::new(),
            final_url: GITHUB_RELEASES_MANIFEST_URL.to_string(),
        }
    }

    fn response_with_content_type(
        content_type: Option<&str>,
        body: impl Into<Vec<u8>>,
    ) -> ManifestHttpResponse {
        let mut result = response(body);
        result.content_type = content_type.map(str::to_owned);
        result
    }

    fn response_with_redirects(
        redirects: Vec<(u16, Option<&str>)>,
        final_url: &str,
    ) -> ManifestHttpResponse {
        let mut result = response(VALID_MANIFEST);
        result.redirects = redirects
            .into_iter()
            .map(|(status, location)| ManifestRedirect {
                status,
                location: location.map(str::to_owned),
            })
            .collect();
        result.final_url = final_url.to_string();
        result
    }

    struct FakeTransport {
        result: Result<ManifestHttpResponse, ManifestHttpError>,
        requests: RefCell<Vec<ManifestHttpRequest>>,
    }

    impl FakeTransport {
        fn response(response: ManifestHttpResponse) -> Self {
            Self {
                result: Ok(response),
                requests: RefCell::new(Vec::new()),
            }
        }

        fn error(error: ManifestHttpError) -> Self {
            Self {
                result: Err(error),
                requests: RefCell::new(Vec::new()),
            }
        }
    }

    impl ManifestHttpTransport for FakeTransport {
        fn get(
            &self,
            request: ManifestHttpRequest,
        ) -> Result<ManifestHttpResponse, ManifestHttpError> {
            self.requests.borrow_mut().push(request);
            self.result.clone()
        }
    }

    fn assert_provider_error<T>(result: Result<T, ManifestProviderError>, code: &str) {
        let error = match result {
            Ok(_) => panic!("expected provider failure"),
            Err(error) => error,
        };
        assert_eq!(error.code(), code);
        assert_eq!(error.to_string(), code);
    }

    #[test]
    fn sends_only_the_fixed_get_request_policy_to_the_transport() {
        let fake = FakeTransport::response(response(VALID_MANIFEST));
        fetch_manifest(&fake).unwrap();

        let requests = fake.requests.borrow();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].url, GITHUB_RELEASES_MANIFEST_URL);
        assert_eq!(requests[0].timeout, Duration::from_secs(15));
        assert_eq!(requests[0].max_redirects, 5);
        assert_eq!(requests[0].max_body_bytes, 1_048_576);
        assert_eq!(
            requests[0].accepted_content_types,
            &["application/json", "application/octet-stream"]
        );
    }

    #[test]
    fn accepts_json_content_types_case_insensitively_with_parameters() {
        for content_type in [
            Some("application/json"),
            Some("Application/JSON; charset=utf-8"),
            Some("application/octet-stream; version=1"),
        ] {
            let fake =
                FakeTransport::response(response_with_content_type(content_type, VALID_MANIFEST));
            assert!(
                fetch_manifest(&fake).is_ok(),
                "content type: {content_type:?}"
            );
        }
    }

    #[test]
    fn rejects_missing_or_unsupported_content_types_without_sniffing() {
        for content_type in [None, Some("text/html"), Some("application/jsonish")] {
            let fake =
                FakeTransport::response(response_with_content_type(content_type, VALID_MANIFEST));
            assert_provider_error(fetch_manifest(&fake), "provider-content-type");
        }
    }

    #[test]
    fn accepts_only_final_200_status() {
        for status in [204, 206, 304, 301, 404, 500] {
            let mut result = response(VALID_MANIFEST);
            result.status = status;
            let fake = FakeTransport::response(result);
            assert_provider_error(fetch_manifest(&fake), "provider-http-status");
        }
    }

    #[test]
    fn rejects_empty_and_oversized_responses_at_the_boundary() {
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(response(Vec::new()))),
            "provider-empty-response",
        );

        let mut exactly_at_limit = VALID_MANIFEST.to_vec();
        exactly_at_limit.resize(MAX_MANIFEST_BODY_BYTES, b' ');
        assert!(fetch_manifest(&FakeTransport::response(response(exactly_at_limit))).is_ok());

        let mut declared_too_large = response(VALID_MANIFEST);
        declared_too_large.content_length = Some((MAX_MANIFEST_BODY_BYTES + 1) as u64);
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(declared_too_large)),
            "provider-response-too-large",
        );

        let mut body_too_large = VALID_MANIFEST.to_vec();
        body_too_large.resize(MAX_MANIFEST_BODY_BYTES + 1, b' ');
        let mut streamed_too_large = response(body_too_large);
        streamed_too_large.content_length = None;
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(streamed_too_large)),
            "provider-response-too-large",
        );
    }

    #[test]
    fn streaming_reader_stops_when_the_body_cap_is_exceeded() {
        let body = vec![b'x'; MAX_MANIFEST_BODY_BYTES + 1];
        let error = read_limited_body(
            Cursor::new(body),
            MAX_MANIFEST_BODY_BYTES,
            Instant::now() + Duration::from_secs(1),
        )
        .expect_err("streamed body should be rejected");
        assert_eq!(error, ManifestHttpError::ResponseTooLarge);
    }

    #[test]
    fn classifies_transport_timeout_network_and_tls_errors_without_details() {
        for (transport_error, provider_code) in [
            (ManifestHttpError::Timeout, "provider-timeout"),
            (ManifestHttpError::Network, "provider-network"),
            (ManifestHttpError::Tls, "provider-network"),
        ] {
            let fake = FakeTransport::error(transport_error);
            assert_provider_error(fetch_manifest(&fake), provider_code);
        }
    }

    #[test]
    fn accepts_each_allowed_https_redirect_status_and_opaque_query() {
        for status in [301, 302, 303, 307, 308] {
            let final_url =
                "https://release-assets.githubusercontent.com/manifest.json?opaque=provider-value";
            let fake = FakeTransport::response(response_with_redirects(
                vec![(status, Some(final_url))],
                final_url,
            ));
            assert!(fetch_manifest(&fake).is_ok(), "redirect status: {status}");
        }
    }

    #[test]
    fn accepts_at_most_five_redirect_hops_and_rejects_six() {
        let five_hops = vec![
            (301, Some("https://github.com/hop-1")),
            (302, Some("https://github.com/hop-2")),
            (303, Some("https://github.com/hop-3")),
            (307, Some("https://github.com/hop-4")),
            (308, Some("https://github.com/hop-5")),
        ];
        assert!(
            fetch_manifest(&FakeTransport::response(response_with_redirects(
                five_hops,
                "https://github.com/hop-5",
            )))
            .is_ok()
        );

        let six_hops = vec![
            (301, Some("https://github.com/hop-1")),
            (302, Some("https://github.com/hop-2")),
            (303, Some("https://github.com/hop-3")),
            (307, Some("https://github.com/hop-4")),
            (308, Some("https://github.com/hop-5")),
            (301, Some("https://github.com/hop-6")),
        ];
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(response_with_redirects(
                six_hops,
                "https://github.com/hop-6",
            ))),
            "provider-redirect",
        );
    }

    #[test]
    fn rejects_missing_location_loops_downgrades_non_https_and_userinfo() {
        let cases = [
            (vec![(301, None)], GITHUB_RELEASES_MANIFEST_URL),
            (
                vec![(302, Some(GITHUB_RELEASES_MANIFEST_URL))],
                GITHUB_RELEASES_MANIFEST_URL,
            ),
            (
                vec![(303, Some("http://github.com/downgrade"))],
                "http://github.com/downgrade",
            ),
            (
                vec![(307, Some("ftp://github.com/not-https"))],
                "ftp://github.com/not-https",
            ),
            (
                vec![(308, Some("https://user:password@github.com/private"))],
                "https://user:password@github.com/private",
            ),
        ];
        for (redirects, final_url) in cases {
            assert_provider_error(
                fetch_manifest(&FakeTransport::response(response_with_redirects(
                    redirects, final_url,
                ))),
                "provider-redirect",
            );
        }
    }

    #[test]
    fn rejects_invalid_utf8_bom_and_malformed_json() {
        let mut invalid_utf8 = response(vec![0xff, 0xfe]);
        invalid_utf8.content_length = Some(2);
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(invalid_utf8)),
            "provider-invalid-encoding",
        );

        let mut bom = vec![0xef, 0xbb, 0xbf];
        bom.extend_from_slice(VALID_MANIFEST);
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(response(bom))),
            "provider-invalid-json",
        );

        assert_provider_error(
            fetch_manifest(&FakeTransport::response(response(b"{not-json"))),
            "provider-invalid-json",
        );
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(response(b"   \n\t"))),
            "provider-invalid-json",
        );
    }

    #[test]
    fn delegates_schema_and_logical_validation_to_the_existing_manifest_parser() {
        let mut invalid_manifest = response(VALID_MANIFEST);
        invalid_manifest.body = br#"{
          "productId":"com.cornellmethod.notebook",
          "schemaVersion":1,
          "releases":[],
          "unexpected":true
        }"#
        .to_vec();
        invalid_manifest.content_length = Some(invalid_manifest.body.len() as u64);
        assert_provider_error(
            fetch_manifest(&FakeTransport::response(invalid_manifest)),
            "provider-invalid-manifest",
        );

        let empty =
            br#"{"productId":"com.cornellmethod.notebook","schemaVersion":1,"releases":[]}"#;
        let result = fetch_manifest(&FakeTransport::response(response(empty))).unwrap();
        assert!(result.is_no_update());

        let non_target = br#"{
          "productId":"com.cornellmethod.notebook",
          "schemaVersion":1,
          "releases":[{
            "channel":"beta",
            "version":"9.0.0",
            "architecture":"x86_64-apple-darwin",
            "minVersion":"14",
            "artifact":{
              "artifactId":"non-target",
              "format":"app-archive",
              "url":"https://updates.example.test/non-target",
              "sizeBytes":1,
              "sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            },
            "signature":{"keyId":"test-key","proof":"opaque-proof"}
          }]
        }"#;
        let result = fetch_manifest(&FakeTransport::response(response(non_target))).unwrap();
        assert!(result.is_no_update());
    }

    #[test]
    fn provider_errors_do_not_carry_response_body_or_url_details() {
        let mut invalid_manifest = response(VALID_MANIFEST);
        invalid_manifest.body = br#"{"secret":"response-body"}"#.to_vec();
        let error = fetch_manifest(&FakeTransport::response(invalid_manifest)).unwrap_err();
        assert_eq!(error, ManifestProviderError::InvalidManifest);
        assert_eq!(error.to_string(), "provider-invalid-manifest");
        assert!(!format!("{error:?}").contains("response-body"));
        assert!(!format!("{error:?}").contains(GITHUB_RELEASES_MANIFEST_URL));
    }
}
