-- AlterTable
ALTER TABLE "notebook_tags"
    ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing relations with a deterministic name-based order. Historical
-- append order is unavailable, so this intentionally uses the current tag name
-- order with tag_id as a stable tie-breaker.
WITH "ordered_tags" AS (
    SELECT
        "notebook_tags"."notebook_id",
        "notebook_tags"."tag_id",
        ROW_NUMBER() OVER (
            PARTITION BY "notebook_tags"."notebook_id"
            ORDER BY "tags"."name" ASC, "notebook_tags"."tag_id" ASC
        ) - 1 AS "order"
    FROM "notebook_tags"
    INNER JOIN "tags"
        ON "tags"."id" = "notebook_tags"."tag_id"
)
UPDATE "notebook_tags"
SET "order" = "ordered_tags"."order"
FROM "ordered_tags"
WHERE "ordered_tags"."notebook_id" = "notebook_tags"."notebook_id"
  AND "ordered_tags"."tag_id" = "notebook_tags"."tag_id";

-- CreateIndex
CREATE INDEX "notebook_tags_notebook_id_order_idx"
    ON "notebook_tags"("notebook_id", "order");
