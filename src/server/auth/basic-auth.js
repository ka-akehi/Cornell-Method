const BASIC_AUTH_HEADER_PATTERN = /^Basic[ \t]+([A-Za-z0-9+/]+={0,2})$/i;

const PUBLIC_METADATA_PATHS = new Set([
  "/manifest.json",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
]);

const STATIC_ASSET_PATTERN =
  /\.(?:avif|bmp|css|csv|gif|ico|jpeg|jpg|js|json|map|png|svg|txt|webmanifest|webp|woff|woff2|xml)$/i;

/**
 * This value is intentionally generic. It is safe to use in an API response,
 * and it does not reveal whether credentials are missing or merely incorrect.
 */
const UNAUTHORIZED_API_ERROR_BODY = Object.freeze({
  code: "unauthorized",
  message: "認証が必要です",
});

function isHostedAuthEnvironment(environment = process.env) {
  const vercelEnvironment = environment.VERCEL_ENV;

  if (
    vercelEnvironment === "preview" ||
    vercelEnvironment === "production"
  ) {
    return true;
  }

  return environment.VERCEL === "1" && vercelEnvironment !== "development";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getBasicAuthState(environment = process.env) {
  const hosted = isHostedAuthEnvironment(environment);
  const enabledValue = environment.BASIC_AUTH_ENABLED;

  if (enabledValue === undefined) {
    if (!hosted) {
      return { mode: "disabled", hosted };
    }
  } else {
    const normalizedEnabledValue = enabledValue.trim().toLowerCase();

    if (normalizedEnabledValue === "false") {
      return hosted
        ? { mode: "fail-closed", hosted }
        : { mode: "disabled", hosted };
    }

    if (normalizedEnabledValue !== "true") {
      return { mode: "fail-closed", hosted };
    }
  }

  const username = environment.BASIC_AUTH_USER;
  const password = environment.BASIC_AUTH_PASSWORD;

  // A colon separates the username from the password in Basic credentials.
  // Rejecting it here avoids accepting a configuration that can never match
  // the wire format reliably.
  if (
    !isNonEmptyString(username) ||
    username.includes(":") ||
    !isNonEmptyString(password)
  ) {
    return { mode: "fail-closed", hosted };
  }

  return {
    mode: "enabled",
    hosted,
    username,
    password,
  };
}

function decodeBasicToken(token) {
  if (
    token.length === 0 ||
    token.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(token) ||
    typeof globalThis.atob !== "function"
  ) {
    return null;
  }

  try {
    const binary = globalThis.atob(token);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );

    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function parseBasicAuthorization(authorization) {
  if (typeof authorization !== "string") {
    return null;
  }

  const match = BASIC_AUTH_HEADER_PATTERN.exec(authorization.trim());

  if (!match) {
    return null;
  }

  const decoded = decodeBasicToken(match[1]);

  if (decoded === null) {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === decoded.length - 1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function constantTimeStringEqual(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function isBasicAuthAuthorized(authorization, state) {
  if (!state || state.mode !== "enabled") {
    return false;
  }

  const credentials = parseBasicAuthorization(authorization);

  if (!credentials) {
    return false;
  }

  return (
    constantTimeStringEqual(credentials.username, state.username) &&
    constantTimeStringEqual(credentials.password, state.password)
  );
}

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPublicPath(pathname) {
  if (isApiPath(pathname)) {
    return false;
  }

  if (
    pathname.startsWith("/_next/static/") ||
    pathname === "/_next/image" ||
    pathname.startsWith("/_next/image/")
  ) {
    return true;
  }

  if (PUBLIC_METADATA_PATHS.has(pathname)) {
    return true;
  }

  return STATIC_ASSET_PATTERN.test(pathname);
}

function getBasicAuthDecision({
  pathname,
  authorization,
  environment = process.env,
}) {
  if (isPublicPath(pathname)) {
    return "public";
  }

  const state = getBasicAuthState(environment);

  if (
    state.mode === "disabled" ||
    (state.mode === "enabled" && isBasicAuthAuthorized(authorization, state))
  ) {
    return "allow";
  }

  return isApiPath(pathname) ? "deny-api" : "deny-page";
}

module.exports = {
  UNAUTHORIZED_API_ERROR_BODY,
  getBasicAuthDecision,
  getBasicAuthState,
  isApiPath,
  isBasicAuthAuthorized,
  isHostedAuthEnvironment,
  isPublicPath,
  parseBasicAuthorization,
};
