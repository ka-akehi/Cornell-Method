-- CreateTable
CREATE TABLE "notebooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "note_date" DATETIME NOT NULL,
    "source_type" TEXT,
    "source_title" TEXT NOT NULL DEFAULT '',
    "overview" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "next_review_date" DATETIME,
    "reviewed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notebook_tags" (
    "notebook_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    PRIMARY KEY ("notebook_id", "tag_id"),
    CONSTRAINT "notebook_tags_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notebook_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notebook_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cues_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notebooks_note_date_idx" ON "notebooks"("note_date");

-- CreateIndex
CREATE INDEX "notebooks_next_review_date_idx" ON "notebooks"("next_review_date");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "cues_notebook_id_order_idx" ON "cues"("notebook_id", "order");
