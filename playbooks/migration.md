# Angular Migration Playbook: 14 → 18

> One version step at a time. Do not proceed to the next step until explicitly instructed to do so.

---

## Context

You are migrating an Angular 14 digital banking application to Angular 18. The app uses Angular Material and is built with NgModule architecture. It includes a shared account-card component that simulates a shared component library consumed by downstream teams.

Migration must proceed one major version at a time:
- Step 1: 14 → 15
- Step 2: 15 → 16
- Step 3: 16 → 17
- Step 4: 17 → 18

Each version step gets its own branch and its own PR. Do not combine steps into a single PR under any circumstances.

---

## Progress Reporting (IMPORTANT)

The UI surfaces your most recent chat message as the live status line, so the
human operator can see what you are doing in real time. You MUST post a short
chat message (one sentence, present-tense, no markdown, no code blocks) every
time you transition between the numbered steps below AND whenever you start a
long-running command.

Rules:
- Prefix every status message with `Status:` so the UI can distinguish these
  from your longer narrative replies. Example: `Status: Running ng update for @angular/core and @angular/cli.`
- Keep each message under 120 characters.
- Post a new `Status:` message at the start of steps 1, 2, 3, 4, 5, 6, 7, 8, 9, and 10.
- Additionally post a `Status:` message whenever you:
  - start a potentially slow command (ng update, ng build, ng serve, git push)
  - begin fixing a specific compiler error
  - hit a blocker that needs human review
- Do NOT replace your structured_output updates — keep updating those as well.
  The `Status:` chat messages are purely for human visibility.

---

## Node Version Requirements

Switch Node version before each step using nvm:

| Target Angular Version | Required Node Version |
|------------------------|----------------------|
| 15                     | Node 16 (`nvm use 16`) |
| 16                     | Node 18 (`nvm use 18`) |
| 17                     | Node 18 or 20 (`nvm use 20`) |
| 18                     | Node 18, 20, or 22 (`nvm use 20`) |

Always run `node --version` to confirm the correct version is active before proceeding.

---

## Migration Guide URLs

Read the official Angular update guide for each step before running any commands:

| Step | URL |
|------|-----|
| 14 → 15 | https://update.angular.io/?l=3&f=14&t=15 |
| 15 → 16 | https://update.angular.io/?l=3&f=15&t=16 |
| 16 → 17 | https://update.angular.io/?l=3&f=16&t=17 |
| 17 → 18 | https://update.angular.io/?l=3&f=17&t=18 |

---

## Step-by-Step Instructions

Follow this exact sequence for each version step.

### 1. Read the Migration Guide

Open the URL for this version step (see table above) in the browser. Read it fully before running any commands. Note any breaking changes that apply to this codebase.

### 2. Create a Migration Branch

```bash
git checkout main
git pull origin main
git checkout -b migration/angular-{target-version}
```

### 3. Switch Node Version

```bash
nvm use {required-node-version}
node --version
```

Confirm the correct Node version is active. Do not proceed if the wrong version is running.

### 4. Run ng update

Run these commands in order:

```bash
ng update @angular/core@{target} @angular/cli@{target}
ng update @angular/cdk@{target}
ng update @angular/material@{target}
```

If you encounter peer dependency errors, retry with the `--force` flag:

```bash
ng update @angular/core@{target} @angular/cli@{target} --force
```

Keep a running list of every breaking change or warning the compiler flags during this step.

### 5. Run Angular Material MDC Migration (15 → 16 step ONLY)

This step applies only when upgrading to Angular 16. After running ng update, execute:

```bash
ng generate @angular/material:mdc-migration
```

Review every `// TODO (mdc-migration)` comment left by the migration tool. Resolve them manually — update CSS class names from the old pattern (e.g. `mat-form-field-flex`) to the new MDC pattern (e.g. `mat-mdc-form-field-flex`). Do not leave TODO comments unresolved.

### 6. Fix Compiler Errors

Read every TypeScript and template compiler error carefully. Fix them one by one, referencing the migration guide from Step 1.

Rules:
- Do not use `// @ts-ignore` to suppress errors
- Do not cast to `any` to suppress errors
- Fix errors properly using the documented migration path
- Pay particular attention to the account-card shared component — it must continue to function correctly after each step

Add every error encountered and its resolution to your report.

### 7. Run the Build

```bash
ng build
```

If the build fails, fix all errors and retry. Do not proceed to Step 8 until the build passes cleanly with zero errors.

### 8. Serve the Application and Run Browser QA

```bash
ng serve &
```

Wait for the dev server to start on localhost:4200. Then, in your own environment:

1. Navigate to `http://localhost:4200/login` — confirm the login form renders and check the browser console for errors
2. Navigate to `http://localhost:4200/dashboard` — confirm the transaction table, account balance card, and navigation render, and check the console
3. Navigate to `http://localhost:4200/notifications` — confirm the page renders and check the console

Report a single QA verdict (pass / fail) in the structured output along with a short note describing what you saw. Do NOT attempt to attach screenshots — they cannot be surfaced back to the UI.

### 9. Raise a Pull Request

Commit all changes:

```bash
git add .
git commit -m "chore: migrate Angular {source} → {target}"
git push origin migration/angular-{target-version}
```

Raise a PR with:
- **Title:** `chore: Angular {source} → {target} migration`
- **Description:** Include the following sections:
  - Summary of changes made
  - Complete list of breaking changes encountered and how each was resolved
  - Build status (pass/fail)
  - Browser QA results (list pages checked, confirm no console errors)
  - Any items that require human review before merging

### 10. Report Back

Stop and report back with:

- Migration success or failure status
- Complete list of breaking changes found and resolved
- Build status
- Browser QA verdict (pass/fail) with notes on what was observed
- PR link
- Any unresolved issues that require human review

Also populate the `summary` field in structured_output with a 2–4 sentence,
human-readable recap of the step: what changed, the most notable breaking
changes you resolved, and how the build + QA went. This is what the operator
sees when they expand the step row in the UI, so write it for a human
reviewer — no markdown headers, no bullet lists, just plain prose.

**Do not begin the next version step until you receive explicit instruction to proceed.**

---

## Guardrails

- Never skip a version step (e.g. do not jump from 14 to 16 directly)
- Never combine multiple version steps into a single PR
- Never suppress TypeScript errors with `@ts-ignore` or `any` casts
- Never proceed to the next step without explicit confirmation
- If you encounter an issue you cannot resolve, stop and report it clearly — do not work around it silently
- The shared account-card component must be tested specifically after each step
- If the build does not pass, do not raise a PR
- Answer "no" to any analytics or related popups as you build and run commands.
---

## What to Report After Each Step

Structure your report as follows:

```
## Migration Report: Angular {source} → {target}

### Status
[ ] Success  [ ] Partial  [ ] Failed

### Breaking Changes Encountered
1. {issue} — {how resolved}
2. {issue} — {how resolved}

### Build
Status: PASS / FAIL

### Browser QA
- Overall verdict: PASS / FAIL
- Login page: {pass/fail, notes}
- Dashboard page: {pass/fail, notes}
- Notifications page: {pass/fail, notes}
- Console errors: {none / list errors}

### PR
{link}

### Items Requiring Human Review
{list any issues that need human judgment before merging}
```