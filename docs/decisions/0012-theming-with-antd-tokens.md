# 0012. Theming through AntD design tokens and a theme package

- **Status:** Proposed
- **Date:** 2026-09-18

## Context

The site (Next.js Pages Router, AntD 6) has about 1,700 inline `style={{…}}`
objects across about 225 files, six global CSS files, and per-component
`ConfigProvider` overrides. There is no central theme.

## Decision

- `packages/theme` owns the AntD `ThemeConfig`: global design tokens,
  component tokens, light/dark algorithms, and any spacing or layout
  constants not covered by AntD tokens.
- The site wraps the app in one `ConfigProvider` fed by the theme package.
- Inline styles are migrated to token-aware styles (`antd-style`
  `createStyles` or CSS modules; the choice is made in the first migration
  PR) as files are touched.
- A lint rule flags inline style objects: a warning in `apps/site`, an error
  in `packages/ui` and `packages/theme`. A ratchet keeps the count from
  rising.

## Consequences

- Visual changes come from the theme, not from edits to many files.
- Migration is incremental; no big-bang restyle.
