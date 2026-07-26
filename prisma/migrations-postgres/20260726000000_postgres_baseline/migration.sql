-- Hand-reviewed Postgres baseline for the current MVP only.
-- Keep this migration separate from prisma/migrations (the SQLite history).

CREATE TABLE "notebooks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note_date" TIMESTAMP(3) NOT NULL,
    "source_type" TEXT,
    "source_title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "body_mode" TEXT NOT NULL DEFAULT 'markdown',
    "summary" TEXT NOT NULL DEFAULT '',
    "next_review_date" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notebook_canvases" (
    "notebook_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "document_json" TEXT NOT NULL,
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notebook_canvases_pkey" PRIMARY KEY ("notebook_id"),
    CONSTRAINT "notebook_canvases_notebook_id_fkey"
      FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "cues" (
    "id" TEXT NOT NULL,
    "notebook_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cues_notebook_id_fkey"
      FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notebook_tags" (
    "notebook_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    CONSTRAINT "notebook_tags_pkey" PRIMARY KEY ("notebook_id", "tag_id"),
    CONSTRAINT "notebook_tags_notebook_id_fkey"
      FOREIGN KEY ("notebook_id") REFERENCES "notebooks" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notebook_tags_tag_id_fkey"
      FOREIGN KEY ("tag_id") REFERENCES "tags" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notebooks_note_date_idx" ON "notebooks" ("note_date");
CREATE INDEX "notebooks_next_review_date_idx" ON "notebooks" ("next_review_date");
CREATE UNIQUE INDEX "tags_name_key" ON "tags" ("name");
CREATE INDEX "cues_notebook_id_order_idx" ON "cues" ("notebook_id", "order");
