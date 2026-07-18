/*
  Warnings:

  - You are about to drop the column `overview` on the `notebooks` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notebooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "note_date" DATETIME NOT NULL,
    "source_type" TEXT,
    "source_title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "next_review_date" DATETIME,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);
INSERT INTO "new_notebooks" ("body", "created_at", "deleted_at", "id", "next_review_date", "note_date", "reviewed_at", "source_title", "source_type", "summary", "title", "updated_at") SELECT "body", "created_at", "deleted_at", "id", "next_review_date", "note_date", "reviewed_at", "source_title", "source_type", "summary", "title", "updated_at" FROM "notebooks";
DROP TABLE "notebooks";
ALTER TABLE "new_notebooks" RENAME TO "notebooks";
CREATE INDEX "notebooks_note_date_idx" ON "notebooks"("note_date");
CREATE INDEX "notebooks_next_review_date_idx" ON "notebooks"("next_review_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
