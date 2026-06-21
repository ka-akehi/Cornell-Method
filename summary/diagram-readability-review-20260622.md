# Diagram Readability Review Summary

Task: Cross-review SVG diagram artifacts under `doc/diagrams`, `doc/workflows`, and `doc/screens`.
Date: 2026-06-22

## Scope

- Reviewed 19 generated SVG files listed in `doc/diagrams/DIAGRAM_ASSETS.md`.
- Checked source Markdown, extracted Mermaid files, generated SVG files, and temporary PNG renders.
- Rendered temporary PNGs under `/tmp/cornell-diagram-review/` for visual inspection.

## Changes Made

- Updated `doc/diagrams/MVP_STATE_DIAGRAMS.md`.
  - Added Japanese display names for stateDiagram states.
  - Shortened transition labels without changing transitions.
- Regenerated Mermaid source and SVG assets with `npm run diagrams:build`.

Generated files affected by the rebuild:

- `doc/diagrams/assets/mmd/mvp-state-diagrams-01-diagram.mmd`
- `doc/diagrams/assets/mmd/mvp-state-diagrams-02-diagram.mmd`
- `doc/diagrams/assets/svg/mvp-state-diagrams-01-diagram.svg`
- `doc/diagrams/assets/svg/mvp-state-diagrams-02-diagram.svg`
- `doc/diagrams/DIAGRAM_ASSETS.md` was regenerated but its logical mapping stayed at 19 diagrams.

## Classification

| SVG | Result | Notes |
| --- | --- | --- |
| `doc/diagrams/assets/svg/mvp-business-flow-diagrams-01-diagram.svg` | OK | Vertical but readable. |
| `doc/diagrams/assets/svg/mvp-business-flow-diagrams-02-diagram.svg` | OK | Readable. |
| `doc/diagrams/assets/svg/mvp-business-flow-diagrams-03-diagram.svg` | Needs decision | Visual layout is readable, but review flow uses old `/notes` reviewDue / `nextReviewDate` model rather than current review task spec. |
| `doc/diagrams/assets/svg/mvp-business-flow-diagrams-04-diagram.svg` | Needs decision | Uses physical delete and `/backup`; current spec uses soft delete Undo and `/notes/backup`. |
| `doc/diagrams/assets/svg/mvp-business-flow-diagrams-05-diagram.svg` | Needs decision | Uses `/backup` and `POST /api/backups`; current spec uses `/notes/backup` and retry/copy command flow. |
| `doc/diagrams/assets/svg/mvp-er-diagram-01-notebook-cue-tag-notebooktag.svg` | Needs decision | Readable, but ER model is the older MVP subset, not current AGENTS.md full data model. |
| `doc/diagrams/assets/svg/mvp-screen-transition-diagram-01-notes-notesnew-notesid-backup.svg` | OK | Previous readability fix holds; wide but usable for review. |
| `doc/diagrams/assets/svg/mvp-sequence-diagrams-01-diagram.svg` | OK | Readable. |
| `doc/diagrams/assets/svg/mvp-sequence-diagrams-02-diagram.svg` | Needs decision | Readable, but includes old `reviewDue` search parameter. |
| `doc/diagrams/assets/svg/mvp-sequence-diagrams-03-diagram.svg` | Needs decision | Readable, but update flow replaces Cue records and omits current card/draft/version model. |
| `doc/diagrams/assets/svg/mvp-sequence-diagrams-04-diagram.svg` | Needs decision | Readable, but uses old `POST /api/notes/:id/review` and `nextReviewDate` flow. |
| `doc/diagrams/assets/svg/mvp-sequence-diagrams-05-diagram.svg` | Needs decision | Readable, but uses old `POST /api/backups` flow. |
| `doc/diagrams/assets/svg/mvp-state-diagrams-01-diagram.svg` | Split recommended | Minor label fix applied; still too many success/error/delete transitions in one state diagram. |
| `doc/diagrams/assets/svg/mvp-state-diagrams-02-diagram.svg` | Needs decision | Minor label fix applied; readable enough, but old `nextReviewDate` state model conflicts with current `reviewStatus` task model. |
| `doc/workflows/assets/svg/mvp-workflow-design-01-diagram.svg` | Needs decision | Readable, but old `nextReviewDate` manual review scheduling model. |
| `doc/workflows/assets/svg/mvp-workflow-design-02-diagram.svg` | Needs decision | Readable, but old `/notes` reviewDue workflow rather than `/tasks/review`. |
| `doc/workflows/assets/svg/mvp-workflow-design-03-diagram.svg` | Needs decision | Readable, but old physical delete / backup-before-delete workflow. |
| `doc/screens/assets/svg/mvp-screen-design-01-diagram.svg` | Needs decision | Readable, but routes use `/backup` and no `/tasks/review`. |
| `doc/screens/assets/svg/mvp-screen-inventory-01-diagram.svg` | Needs decision | Readable, but routes use `/backup` and no `/tasks/review`. |

## Follow-up Task Candidates

1. Split `MVP_STATE_DIAGRAMS.md` detail-mode state diagram into:
   - normal view/edit/review mode transition
   - error recovery transition
   - delete confirmation/deleted transition

2. Align old MVP diagram docs with current AGENTS.md specification:
   - replace `/backup` with `/notes/backup`
   - add `/tasks/review`
   - replace `nextReviewDate` / `reviewDue` model with `NotebookReviewProgress` and `reviewStatus`
   - replace physical delete with soft delete, Undo, and `POST /api/undo`
   - update ER diagram to include current full schema tables

3. Review whether `doc/workflows/MVP_WORKFLOW_DESIGN.md` and `doc/diagrams/MVP_*` are intended to remain historical MVP docs. If yes, label them explicitly as historical so they are not confused with the current AGENTS.md spec.

## Verification

- `npm run diagrams:build` succeeded.
- Confirmed 19 Mermaid diagrams were extracted and 19 SVG diagrams rendered.
- Confirmed all SVG files under the target asset directories include the white background rect.

## Next Read

- `doc/diagrams/MVP_STATE_DIAGRAMS.md`
- `doc/diagrams/DIAGRAM_ASSETS.md`
- `summary/diagram-readability-review-20260622.md`
