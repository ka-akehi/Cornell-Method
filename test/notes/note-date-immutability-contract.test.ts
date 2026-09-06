// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- this focused contract test uses VM-loaded modules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);

const projectRoot = path.resolve(__dirname, "../..");

function readSource(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
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

function loadApplicationErrors() {
  return loadTranspiledModule("src/server/notes/application/errors.ts");
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

test("application updateNote rejects a changed noteDate before repository update", async () => {
  let updateCalled = false;
  const applicationErrors = loadApplicationErrors();
  const commandService = loadTranspiledModule(
    "src/server/notes/application/command.service.ts",
    {
      "@/server/notes/infrastructure": {
        findExistingNote: async () => ({
          id: "note-1",
          noteDate: new Date("2026-08-08T00:00:00.000Z"),
        }),
        updateNoteRecord: async () => {
          updateCalled = true;
          return { id: "note-1" };
        },
      },
      "@/server/notes/presenters": {
        formatNoteDetail: (note) => note,
      },
      "@/shared/date": {
        dateOnlyToUtcDate: (value) => new Date(`${value}T00:00:00.000Z`),
      },
      "./errors": applicationErrors,
    },
  );

  await assert.rejects(
    commandService.updateNote("note-1", {
      title: "Updated",
      noteDate: "2026-08-07",
    }),
    (error) => {
      assert.ok(error instanceof applicationErrors.NoteDateImmutableError);
      assert.equal(error.message, "保存後の学習日は編集できません");
      return true;
    },
  );
  assert.equal(updateCalled, false);
});

test("PATCH maps the application noteDate error to a noteDate invalid-body error", async () => {
  const applicationErrors = loadApplicationErrors();
  const route = loadRoute("src/app/api/notes/[id]/route.ts", {
    application: {
      NoteDateImmutableError: applicationErrors.NoteDateImmutableError,
      updateNote: async () => {
        throw new applicationErrors.NoteDateImmutableError();
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
});

test("PATCH accepts the current noteDate and the update repository leaves it untouched", async () => {
  let updateInput;
  const applicationErrors = loadApplicationErrors();
  const route = loadRoute("src/app/api/notes/[id]/route.ts", {
    application: {
      NoteDateImmutableError: applicationErrors.NoteDateImmutableError,
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

test("PATCH preserves the not-found response when application update returns null", async () => {
  const applicationErrors = loadApplicationErrors();
  const route = loadRoute("src/app/api/notes/[id]/route.ts", {
    application: {
      NoteDateImmutableError: applicationErrors.NoteDateImmutableError,
      updateNote: async () => null,
    },
    contracts: { notebookInputSchema: acceptingNotebookSchema },
  });

  const response = await route.PATCH(
    jsonRequest("PATCH", { title: "Updated", noteDate: "2026-08-08" }),
    { params: Promise.resolve({ id: "missing-note" }) },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    code: "not_found",
    message: "ノートが見つかりません",
  });
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
