# Changelog

## 1.1.0 — 2026-09-22

Catalogue polish. No change to what is installed.

- `description` and `version` moved from `metadata` to the top level of
  `marketplace.json`. Nested under `metadata`, neither field was ever read — and
  nothing said so.
- Every entry now carries `displayName`, `keywords`, `author`, `homepage`,
  `license`, `strict` and `defaultEnabled`.
- Plugin descriptions rewritten to say what the plugin covers rather than list
  endpoints — the description is what decides whether Claude reaches for it.
- Deliberately **no** `version` on the entries: the source repositories are
  remote and their own `plugin.json` is the authority.
- Added `scripts/valider.mjs` (manifest validation, optional reachability check
  on every source repository), a CI workflow running it on each push, a
  `LICENSE`, this changelog, `.gitignore` and `.gitattributes`.
- README rewritten for the audience this repository actually has: it is public.

## 1.0.0

Initial catalogue: `qonto-api-toolkit`, `payfit-api-toolkit`,
`pennylane-api-toolkit`.
