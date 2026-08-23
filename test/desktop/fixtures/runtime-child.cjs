const http = require("node:http");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const port = Number(argumentValue("--port"));
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("fixture runtime requires a positive --port");
}

const server = http.createServer((request, response) => {
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
