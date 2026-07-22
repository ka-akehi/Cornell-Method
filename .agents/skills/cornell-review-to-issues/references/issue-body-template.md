# Code review follow-up Issue template

Use the complete structure below. Remove instructional placeholders before creating the Issue.

```md
## Summary

<One paragraph describing the verified problem or separately required follow-up.>

## Source

- Pull request: #<PR_NUMBER> — <PR_URL>
- Source review: <REVIEW_OR_COMMENT_URL>
- Verified head: `<HEAD_SHA>`
- Review author: <AUTHOR>
- Priority: <P0|P1|P2|P3>
- Disposition: <deferred follow-up | runtime verification | enhancement | architecture task>

## Current location and affected path

- Primary location: `<PATH>:<LINE_OR_RANGE>`
- Affected flow: `<UI -> remote -> Route Handler -> application -> repository -> persistence -> DTO>`

## Trigger

1. <Concrete input, state, environment, or operation order>
2. <Next condition>
3. <Observed or expected failure>

## Impact

<Specific user, data, runtime, security, performance, or maintenance consequence.>

## Evidence

- <Current code evidence at verified head>
- <Relevant MVP contract, target architecture, or test-scenario reference>
- <Command/runtime evidence, or explicit statement that runtime evidence is missing>

## Suggested direction

<Smallest root-cause-oriented direction. Do not prescribe a full implementation unless established by design.>

## Acceptance criteria

- [ ] <Observable behavior or invariant>
- [ ] <Boundary/error/rollback scenario>
- [ ] <Compatibility requirement>
- [ ] <Documentation/evidence update when applicable>

## Verification

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] <Specific unit/API/browser scenario>
- [ ] <Temporary DB or disposable filesystem requirement when applicable>

Remove commands that are not relevant; add the exact runtime scenario that proves completion.

## Contract and architecture impact

- Current MVP contract: <none | section and required update>
- Target Architecture: <none | dependency/placement rule>
- Phase 2 boundary: <not Phase 2 | explicitly approved enhancement>

## Out of scope

- <Work deliberately excluded from this Issue>

## Deferral rationale

<Why this work can safely be completed separately from the source PR. For runtime-verification Issues, state why the missing environment—not a known defect—prevents completion in the PR.>

<!-- codex-review-finding:PR-<PR_NUMBER>:<AREA>:<NORMALIZED_ROOT_CAUSE> -->
```

## Title examples

```text
[P2][Code Review][PR #123] Verify Canvas pointer and save/reload behavior in Chromium
```

```text
[P2][Code Review][PR #123] Preserve date-only values across the notes API boundary
```

```text
[Enhancement][PR #123] Plan Phase 2 autosave and optimistic locking
```

Avoid titles such as:

```text
Fix review comments
Improve code
Refactor things
Add tests
```

## Acceptance-criteria examples

Good:

```md
- [ ] Resizing a 640x480 Canvas to 1920x1080 changes only `page.width` and `page.height`.
- [ ] Existing element position, dimensions, points, style, text, rotation, and z-order are unchanged after save and reload.
- [ ] The browser evidence is recorded for 375px, 768px, and 1440px viewports.
```

Weak:

```md
- [ ] Canvas works correctly.
- [ ] Add sufficient tests.
```

## Runtime-verification body additions

For browser QA, include:

- browser and version;
- viewport/device sizes;
- initial fixture and cleanup policy;
- exact pointer, keyboard, wheel, or touch sequence;
- expected state before and after save/reload;
- screenshot/video/log evidence location;
- distinction between static, API runtime, and browser runtime evidence.

## Data-safety body additions

For Prisma, SQLite, backup, or delete work, include:

- disposable database/filesystem setup;
- rollback or failure injection scenario;
- confirmation that the developer's normal `dev.db` and `backup/` are untouched;
- compatibility with legacy Markdown and stored Canvas JSON when relevant.
