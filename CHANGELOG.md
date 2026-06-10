# Changelog

## 3.6.0

- Added declaration value-level caching so repeated CSS values can skip repeated value parsing.
- Fixed `excludeSelectors` behavior for CSS nesting: when a selector is excluded, declarations inside its nested rule and at-rule subtree are now skipped as well.
- Fixed `vw&rem` fallback declarations to preserve PostCSS source and raw formatting metadata.
- Converted direct declarations inside at-rules such as `@font-face` and `@page`.
- Added type declaration usage checks to CI and switched CI installs to the committed `pnpm-lock.yaml`.

### Behavior note

This release changes behavior for projects using CSS nesting. Previously, declarations inside nested child rules under an excluded selector could still be converted. They are now left unchanged, matching the documented `excludeSelectors` subtree semantics.
