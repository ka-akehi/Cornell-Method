/* eslint-disable @typescript-eslint/no-require-imports -- This focused contract test uses Node's built-in test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const vm = require("node:vm");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadTranspiledModule(relativePath, dependencies = {}) {
  const output = ts.transpileModule(readSource(relativePath), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const moduleObject = { exports: {} };

  vm.runInNewContext(output, {
    Response,
    console,
    module: moduleObject,
    exports: moduleObject.exports,
    require: (request) => {
      if (Object.prototype.hasOwnProperty.call(dependencies, request)) {
        return dependencies[request];
      }
      throw new Error(`Unexpected dependency: ${request}`);
    },
  });

  return moduleObject.exports;
}

function loadApiErrorDependencies() {
  const apiErrors = loadTranspiledModule("src/shared/http/api-error.ts", {
    zod: require("zod"),
  });
  const apiErrorResponse = (body) => new Response(JSON.stringify(body), {
    status: apiErrors.apiErrorStatus[body.code],
    headers: { "content-type": "application/json" },
  });

  return { ...apiErrors, apiErrorResponse };
}

function loadRoute(relativePath, { application, contracts }) {
  const http = loadApiErrorDependencies();

  return loadTranspiledModule(relativePath, {
    "next/server": {
      NextResponse: {
        json(body, init = {}) {
          return new Response(JSON.stringify(body), {
            status: init.status ?? 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
    "@/server/notes/application": application,
    "@/shared/http": http,
    "@/modules/notes/contracts": contracts,
  });
}

const acceptingNotebookSchema = {
  safeParse(value) {
    return { success: true, data: value };
  },
};

function jsonRequest(method, payload) {
  return new Request("http://localhost/api/notes/note-1", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("PATCH rejects a changed noteDate with a noteDate invalid-body error", async () => {
  let updateCalled = false;
  const route = loadRoute("src/app/api/notes/[id]/route.ts", {
    application: {
      getNoteDetail: async () => ({ noteDate: "2026-08-08" }),
      updateNote: async () => {
        updateCalled = true;
        return { id: "note-1" };
      },
    },
    contracts: { notebookInputSchema: acceptingNotebookSchema },
  });

  const response = await route.PATCH(
    jsonRequest("PATCH", { title: "Updated", noteDate: "2026-08-07" }),
    { params: Promise.resolve({ id: "note-1" }) },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "invalid_body",
    message: "入力内容に誤りがあります",
    errors: [{ field: "noteDate", message: "保存後の学習日は編集できません" }],
  });
  assert.equal(updateCalled, false);
});

test("PATCH accepts the current noteDate and the update repository leaves it untouched", async () => {
  let updateInput;
  const route = loadRoute("src/app/api/notes/[id]/route.ts", {
    application: {
      getNoteDetail: async () => ({ noteDate: "2026-08-08" }),
      updateNote: async (_id, input) => {
        updateInput = input;
        return { id: "note-1", ...input };
      },
    },
    contracts: { notebookInputSchema: acceptingNotebookSchema },
  });

  const response = await route.PATCH(
    jsonRequest("PATCH", { title: "Updated", noteDate: "2026-08-08" }),
    { params: Promise.resolve({ id: "note-1" }) },
  );

  assert.equal(response.status, 200);
  assert.equal(updateInput.noteDate, "2026-08-08");
  assert.equal((await response.json()).noteDate, "2026-08-08");

  const repository = readSource(
    "src/server/notes/infrastructure/notebook.command.repository.ts",
  );
  const updateStart = repository.indexOf("await tx.notebook.update({");
  const updateEnd = repository.indexOf("await replaceCueRelations", updateStart);
  const updateBlock = repository.slice(updateStart, updateEnd);
  assert.doesNotMatch(updateBlock, /noteDate:/);
});

test("POST still forwards the supplied noteDate to the create API", async () => {
  let createInput;
  const route = loadRoute("src/app/api/notes/route.ts", {
    application: {
      createNote: async (input) => {
        createInput = input;
        return { id: "note-1", noteDate: input.noteDate };
      },
    },
    contracts: {
      notebookInputSchema: acceptingNotebookSchema,
      notesQuerySchema: { safeParse: () => ({ success: true, data: {} }) },
    },
  });

  const response = await route.POST(
    jsonRequest("POST", { title: "New", noteDate: "2026-08-07" }),
  );

  assert.equal(response.status, 201);
  assert.equal(createInput.noteDate, "2026-08-07");

  const repository = readSource(
    "src/server/notes/infrastructure/notebook.command.repository.ts",
  );
  const updateStart = repository.indexOf("export async function updateNoteRecord");
  const createBlock = repository.slice(0, updateStart);
  assert.match(createBlock, /noteDate: dateOnlyToUtcDate\(input\.noteDate\)/);
});
