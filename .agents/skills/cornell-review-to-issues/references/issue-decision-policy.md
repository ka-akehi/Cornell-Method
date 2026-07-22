# Review finding to Issue decision policy

Use this policy only after revalidating the finding against the current pull-request head.

## Core principle

A GitHub Issue is a scheduling mechanism, not a substitute for a safe pull request.

Classify the underlying work first. Then decide where it belongs.

## Decision table

| Classification | Default destination | Issue allowed? | Merge implication |
| --- | --- | --- | --- |
| P0 data loss, secret exposure, arbitrary execution, broad outage | Fix or revert in PR | Only as an additional tracker when explicitly requested | PR remains blocked |
| P1 core-flow regression, data corruption, XSS, destructive operation | Fix or revert in PR | Only with explicit human risk decision | PR remains blocked unless risk is explicitly accepted |
| P2 real edge-case bug or contract drift | Usually fix in PR | Yes when deferral is explicitly accepted and current PR stays safe | Normally request changes until decision is recorded |
| Browser/device/runtime verification gap | Separate Issue when implementation exists and no known regression is hidden | Yes | Non-blocking only when contract risk is acceptably bounded |
| Architecture migration larger than current scope | Separate Issue | Yes | Non-blocking if current dependency rules are still satisfied |
| Phase 2 roadmap work | Enhancement/design Issue | Yes when explicitly approved | Not an MVP bug |
| P3 maintainability suggestion | PR note or backlog only on request | Normally no | Non-blocking |
| Nit, formatting, naming preference | Formatter/linter or no action | No | Non-blocking |
| Fixed, outdated, duplicate, unsupported | No new work | No | None |

## Questions to answer in order

1. Does the problem still exist at the latest PR head?
2. Is it a defect under the current MVP contract or only a future-roadmap gap?
3. Was it introduced or materially worsened by this PR?
4. Can the PR be merged safely without completing it?
5. Has a human explicitly accepted deferral?
6. Can the follow-up be completed and verified independently?
7. Does an Issue with the same root cause already exist?

A `no` to question 1 means no Issue. A `no` to question 4 usually means fix the PR.

## Cornell Method examples

### Keep on the PR: non-atomic note save

Finding:

> Notebook updates outside the transaction while Canvas/Cue/Tag replacement remains inside it.

Why it stays on the PR:

- a failure can produce a partially saved note;
- the current MVP treats one explicit save as one operation;
- creating an Issue does not repair stored-data integrity.

Possible tracking Issue:

Only if a human explicitly accepts the risk and the PR remains visibly blocked or the unsafe change is reverted first.

### Keep on the PR: Markdown sanitize bypass

Finding:

> User-authored Markdown reaches raw HTML without the established sanitize policy.

Why it stays on the PR:

- this is a concrete XSS boundary regression;
- the fix belongs with the change that weakened the boundary.

### Issue candidate: Canvas browser runtime QA

Finding:

> Static and API checks pass, but changed pointer/wheel/touch behavior has no browser evidence.

Issueable when:

- the implementation exists;
- no known interaction defect is being hidden;
- the test requires a browser/device environment unavailable in the current task;
- the Issue names exact scenarios, viewports, and expected evidence.

### Issue candidate: behavior-preserving module migration

Finding:

> A broad UI module move would improve target-architecture alignment but is intentionally outside the current bug fix.

Issueable when:

- current code does not violate a blocking forbidden dependency;
- the migration has clear source/destination boundaries;
- behavior-preserving acceptance criteria and static checks are specified.

### Enhancement: Phase 2 autosave

Finding:

> The application lacks autosave and optimistic-lock behavior described in the product roadmap.

Classification:

- not a current-MVP bug;
- create only as an explicitly approved Phase 2 enhancement;
- do not cite its absence as a regression in an unrelated PR.

## Deferral record

When a P2 is converted to an Issue, record the deferral decision in the PR summary:

```text
Deferred to #123 after revalidation at <head-sha>.
The current PR remains safe because <specific reason>.
Acceptance criteria in #123 cover <specific follow-up>.
```

Do not use phrases such as `follow up later` without an Issue or explicit owner decision.

## Duplicate grouping

Group comments when they share one root cause, even if they appear in different files.

Examples:

- a DTO field omitted in mapper and UI failure caused by that omission: one Issue;
- three Canvas controls affected by one stale runtime ref: one Issue;
- unrelated date parsing and tag normalization bugs: separate Issues.

## Priority reassessment

The Issue priority may differ from the review comment when revalidation changes reach or impact.

Downgrade or upgrade only with evidence:

- trigger frequency;
- affected data/users;
- recoverability;
- current contract;
- available guards;
- whether the PR remains mergeable safely.

Explain the reassessment in the Issue body.
