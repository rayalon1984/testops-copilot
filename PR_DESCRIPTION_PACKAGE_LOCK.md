# Fix: Update backend package-lock.json to version 2.6.0

## Summary

This PR updates the `backend/package-lock.json` version field from `2.5.6` to `2.6.0` to match all other package.json files in the project.

## Background

After merging PR #325 (MCP Server v2.6.0), we discovered that `backend/package-lock.json` still contained version `2.5.6` in two places while all other files were correctly updated to `2.6.0`.

## Changes

- Updated `backend/package-lock.json` line 3: `"version": "2.5.6"` → `"version": "2.6.0"`
- Updated `backend/package-lock.json` line 8: `"version": "2.5.6"` → `"version": "2.6.0"`

## Verification

After this merge, all version references will be consistent:

```bash
✅ package.json (root)          → 2.6.0
✅ backend/package.json         → 2.6.0
✅ frontend/package.json        → 2.6.0
✅ mcp-server/package.json      → 1.0.0 (MCP-specific)
✅ backend/package-lock.json    → 2.6.0 (this PR)
✅ README.md                    → v2.6.0
✅ CLAUDE.md                    → 2.6.0
```

## Testing

- [x] Version numbers verified in all files
- [x] No functional changes (lock file version only)
- [x] Build passes

## Related

- Closes the version inconsistency from PR #325
- Part of v2.6.0 release cleanup

---

**This is a minor housekeeping PR to ensure version consistency across all project files.**
