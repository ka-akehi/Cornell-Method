-- AlterTable
ALTER TABLE "notebooks" ADD COLUMN "body_mode" TEXT NOT NULL DEFAULT 'markdown';

-- CreateTable
CREATE TABLE "notebook_canvases" (
    "notebook_id" TEXT NOT NULL PRIMARY KEY,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "document_json" TEXT NOT NULL,
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notebook_canvases_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
