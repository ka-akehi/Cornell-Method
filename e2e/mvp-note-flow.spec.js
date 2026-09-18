const { test, expect } = require("@playwright/test");

test.describe.configure({ mode: "serial" });

const E2E_BASE_URL = "http://localhost:4173";

function todayDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

async function cleanupNote(request, noteId) {
  if (!noteId) return;

  const response = await request.delete(`/api/notes/${noteId}`, {
    headers: { Origin: E2E_BASE_URL },
  });
  expect([204, 404]).toContain(response.status());
}

async function createNote(page, { title, cue, cues, summary }) {
  await page.goto("/notes/new");
  await expect(page.locator("#note-title")).toBeVisible();
  await page.locator("#note-title").fill(title);
  await page.locator("#note-date").fill(todayDateString());

  const cueTexts = cues ?? (cue ? [cue] : []);
  for (const [index, cueText] of cueTexts.entries()) {
    await page.getByRole("button", { name: "Cue 追加", exact: true }).click();
    await page.locator(`#cue-${index}`).fill(cueText);
  }

  await page.locator("#summary").fill(summary);

  const saveResponsePromise = page.waitForResponse((response) => {
    return (
      response.url().endsWith("/api/notes") &&
      response.request().method() === "POST"
    );
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(201);

  const savedNote = await saveResponse.json();
  expect(savedNote.id).toEqual(expect.any(String));
  await expect(page).toHaveURL(new RegExp(`/notes/${savedNote.id}$`));

  return savedNote;
}

async function expectCanvasViewer(page) {
  await expect(
    page.getByRole("img", { name: /保存済みCanvas本文/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/保存済みCanvasを表示しています/),
  ).toBeVisible();
}

test("ホームからノート一覧へ redirect する", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/notes$/);
  await expect(
    page.getByRole("heading", { name: "ノート一覧", level: 1 }),
  ).toBeVisible();
});

test("ノートを作成して編集保存し、一覧の query 検索で確認する", async ({
  page,
  request,
}) => {
  const initialTitle = `E2E 作成 ${Date.now()}`;
  const updatedTitle = `${initialTitle} 更新`;
  const initialSummary = "E2E 作成時の Summary";
  const updatedSummary = "E2E 編集後の Summary";
  const initialCues = ["E2E 作成時の Cue 1", "E2E 作成時の Cue 2"];
  let noteId;

  try {
    const savedNote = await createNote(page, {
      title: initialTitle,
      cues: initialCues,
      summary: initialSummary,
    });
    noteId = savedNote.id;

    const persistedNoteResponse = await request.get(`/api/notes/${noteId}`);
    expect(persistedNoteResponse.status()).toBe(200);
    const persistedNote = await persistedNoteResponse.json();
    expect(persistedNote.cues).toHaveLength(initialCues.length);
    expect(
      persistedNote.cues.map(({ text, order }) => ({ text, order })),
    ).toEqual(
      initialCues.map((text, order) => ({ text, order })),
    );

    await expect(
      page.getByRole("heading", { name: initialTitle, level: 1 }),
    ).toBeVisible();
    await expectCanvasViewer(page);
    await expect(page.getByText(initialSummary, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page.locator("#note-title")).toHaveValue(initialTitle);
    await page.locator("#note-title").fill(updatedTitle);
    await page.locator("#summary").fill(updatedSummary);

    const updateResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().endsWith(`/api/notes/${noteId}`) &&
        response.request().method() === "PATCH"
      );
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: updatedTitle, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(updatedSummary, { exact: true })).toBeVisible();
    await expectCanvasViewer(page);

    await page.goto("/notes");
    await expect(
      page.getByRole("heading", { name: "ノート一覧", level: 1 }),
    ).toBeVisible();
    await page.locator("#notes-query").fill(updatedTitle);

    const searchResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/notes" &&
        response.request().method() === "GET" &&
        url.searchParams.get("query") === updatedTitle
      );
    });
    await page.getByRole("button", { name: "検索", exact: true }).click();
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.status()).toBe(200);
    const searchResult = await searchResponse.json();
    expect(searchResult.totalCount).toBe(1);
    expect(searchResult.data[0].id).toBe(noteId);

    await expect(
      page.getByRole("heading", { name: "検索結果", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: updatedTitle, level: 3 }),
    ).toBeVisible();
  } finally {
    await cleanupNote(request, noteId);
  }
});

test("編集モードのURLをリロード後も保持し、キャンセルと保存で解除する", async ({
  page,
  request,
}) => {
  const initialTitle = `E2E 編集モード ${Date.now()}`;
  const updatedTitle = `${initialTitle} 更新`;
  const initialCue = "E2E 編集モードの保存済み Cue";
  const updatedCue = "E2E 編集モードで更新した Cue";
  let noteId;

  try {
    const savedNote = await createNote(page, {
      title: initialTitle,
      cue: initialCue,
      summary: "E2E 編集モードの Summary",
    });
    noteId = savedNote.id;

    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/notes/${noteId}\\?mode=edit$`),
    );
    await expect(page.locator("#note-title")).toBeVisible();
    await expect(page.locator("#note-title")).toHaveValue(initialTitle);
    await expect(page.locator("#cue-0")).toBeVisible();
    await expect(page.locator("#cue-0")).toHaveValue(initialCue);

    await page.reload();
    await expect(page).toHaveURL(
      new RegExp(`/notes/${noteId}\\?mode=edit$`),
    );
    await expect(page.locator("#note-title")).toBeVisible();
    await expect(page.locator("#note-title")).toHaveValue(initialTitle);
    await expect(page.locator("#cue-0")).toBeVisible();
    await expect(page.locator("#cue-0")).toHaveValue(initialCue);

    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/notes/${noteId}$`));
    await expect(
      page.getByRole("heading", { name: initialTitle, level: 1 }),
    ).toBeVisible();
    await expect(page.locator("#note-title")).toHaveCount(0);

    await page.getByRole("button", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/notes/${noteId}\\?mode=edit$`),
    );
    await page.locator("#note-title").fill(updatedTitle);
    await page.locator("#cue-0").fill(updatedCue);

    const updateResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().endsWith(`/api/notes/${noteId}`) &&
        response.request().method() === "PATCH"
      );
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);

    await expect(page).toHaveURL(new RegExp(`/notes/${noteId}$`));
    await expect(
      page.getByRole("heading", { name: updatedTitle, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(updatedCue, { exact: true })).toBeVisible();
    await expect(page.locator("#note-title")).toHaveCount(0);
  } finally {
    await cleanupNote(request, noteId);
  }
});

test("復習モードで本文を表示・非表示にし、復習済み更新後に削除する", async ({
  page,
  request,
}) => {
  const title = `E2E 復習 ${Date.now()}`;
  const summary = "E2E 復習用 Summary";
  let noteId;

  try {
    const savedNote = await createNote(page, {
      title,
      cue: "E2E 復習用 Cue",
      summary,
    });
    noteId = savedNote.id;

    await page.getByRole("button", { name: "復習", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "本文を表示", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /保存済みCanvas本文/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "本文確認後に開く", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "本文を表示", exact: true }).click();
    await expectCanvasViewer(page);
    await expect(
      page.getByRole("button", { name: "本文を隠す", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "本文を隠す", exact: true }).click();
    await expect(
      page.getByRole("img", { name: /保存済みCanvas本文/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "本文を表示", exact: true }).click();
    await page.getByRole("button", { name: "サマリーを表示", exact: true }).click();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();

    const reviewResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().endsWith(`/api/notes/${noteId}/review`) &&
        response.request().method() === "POST"
      );
    });
    await page.getByRole("button", { name: "復習済みにする", exact: true }).click();
    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.status()).toBe(200);
    const reviewResult = await reviewResponse.json();
    expect(reviewResult.id).toBe(noteId);
    expect(reviewResult.reviewedAt).toEqual(expect.any(String));
    await expect(
      page.getByRole("button", { name: "復習", exact: true }),
    ).toBeVisible();

    const dialogPromise = page.waitForEvent("dialog");
    const deleteResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().endsWith(`/api/notes/${noteId}`) &&
        response.request().method() === "DELETE"
      );
    });
    const deleteClickPromise = page
      .getByRole("button", { name: "削除", exact: true })
      .click();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("ノートを削除");
    await dialog.accept();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);
    await deleteClickPromise;

    await expect(page).toHaveURL(/\/notes$/);
    await expect(
      page.getByRole("heading", { name: "ノート一覧", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: title, level: 3 }),
    ).toHaveCount(0);

    const deletedNoteResponse = await request.get(`/api/notes/${noteId}`);
    expect(deletedNoteResponse.status()).toBe(404);
  } finally {
    await cleanupNote(request, noteId);
  }
});
