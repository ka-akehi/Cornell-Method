## Code Review Rules

### Current MVP contract

- Treat `doc/implementation/MVP_CONTRACT.md` as the source of truth for current
  routes, APIs, save, delete, review, Canvas, and acceptance behavior. Flag a
  change that silently alters those contracts or mixes Phase 2 work such as
  autosave, soft delete/Undo, dedicated review tasks, NoteCard/D&D, PDF export,
  or tag-management mutations into an MVP change.
  Safe path: update the MVP/Phase 2 boundary and acceptance criteria explicitly,
  then change implementation, documentation, and verification evidence together.

### Note and Canvas persistence

- A note save must preserve Notebook, Canvas, Cue, and Tag relations as one
  consistent operation. For `bodyMode="canvas"`, the canonical body is a
  validated `CanvasDocumentV1` and legacy `Notebook.body` stays empty; legacy
  Markdown notes must not be auto-converted. Page-size changes must preserve all
  existing element geometry, style, text, order, and search semantics.
  Safe path: use the shared contracts and the existing application/repository
  transaction boundary, regenerate Canvas `searchText` from canonical text
  elements, and verify save/read-back behavior.

### Local data and trust boundary

- This application is authentication-free and intended for local personal use.
  Do not describe a shared/public deployment as safe without an explicit threat
  model and access control. Keep user Markdown sanitized, keep backup/prune
  operations inside the intended SQLite/backup paths, and preserve the current
  confirmation-plus-physical-delete contract.
  Safe path: retain the sanitized Markdown renderer, test backup logic only with
  disposable paths, and treat any network exposure or authentication change as a
  separately reviewed product and security decision.
