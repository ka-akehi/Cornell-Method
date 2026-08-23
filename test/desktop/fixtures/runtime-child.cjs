const http = require("node:http");

const HEALTH_PATH = "/api/desktop/health";
const HEALTH_KIND = "cornell-desktop-health";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const port = Number(argumentValue("--port"));
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("fixture runtime requires a positive --port");
}
const healthNonce = process.env.CORNELL_DESKTOP_RUNTIME_HEALTH_NONCE
  ?? process.env.CORNELL_DESKTOP_READY_NONCE;
const exitAfterHealth = process.env.CORNELL_DESKTOP_RUNTIME_EXIT_AFTER_HEALTH === "1";

const server = http.createServer((request, response) => {
  if (request.url === HEALTH_PATH) {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({
        kind: HEALTH_KIND,
        status: "ready",
        nonce: healthNonce,
      }),
      () => {
        if (exitAfterHealth) shutdown();
      });
    return;
  }
  if (request.url === "/notes") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<main>fixture notes</main>");
    return;
  }
  response.writeHead(404);
  response.end();
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
server.listen({ host: "127.0.0.1", port });
