---
name: tag-commit-push
description: Automate version tagging, committing, and pushing for the Zen Launcher Chrome extension. Use when the user says "tcp", "tag/commit/push", "tag commit push", "release", "cp", "commit push", or asks to bump the version and push. "cp" means commit and push without tagging.
---

# Tag / Commit / Push

Automates the release workflow. Two modes:

- **tcp** (tag/commit/push): bump manifest version, commit, tag, and push
- **cp** (commit/push): commit and push only — no version bump, no tag

## TCP Workflow (tag/commit/push)

1. **Check state**
   - Run `git status` to confirm the working tree
   - Run `git tag --sort=-v:refname | head -1` to get the latest tag (format: `vX.Y.Z`)
   - Read `manifest.json` to get the current version

2. **Determine next version**
   - Parse the latest git tag (e.g., `v0.0.18` -> `0.0.19`)
   - Increment the **patch** number by 1
   - If the user specifies a version, use that instead

3. **Update manifest.json**
   - Set the `"version"` field to the new version (without the `v` prefix)
   - Example: if next tag is `v0.0.19`, set `"version": "0.0.19"`

4. **Commit**
   - Stage all changes: `git add .`
   - Commit with message: `Release vX.Y.Z`
   - CRITICAL: Do NOT add `Co-authored-by` or any trailer. Use only `-m` for the message.

5. **Tag**
   - Create tag: `git tag vX.Y.Z`

6. **Push**
   - Push commit and tag: `git push && git push origin vX.Y.Z`
   - If the tag already exists on remote, force-update: `git push origin vX.Y.Z --force`

## CP Workflow (commit/push)

1. **Check state**
   - Run `git status` to see changes

2. **Commit**
   - Stage all changes: `git add .`
   - Write a concise commit message summarizing the changes (do NOT use `Release` prefix)
   - CRITICAL: Do NOT add `Co-authored-by` or any trailer. Use only `-m` for the message.

3. **Push**
   - Push: `git push`

## Important Notes

- The version in `manifest.json` does **not** have the `v` prefix; git tags **do**
- If push fails due to SSH key issues, inform the user to plug in their hardware key and retry
- Do **NOT** add `Co-authored-by` trailers or any co-author attribution to the commit message
- Do **NOT** use `--trailer` flag in any `git commit` command
- The `git commit` command must ONLY use `-m "message"` — no other message-related flags
