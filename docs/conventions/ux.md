# UX conventions (`apps/site`, `packages/ui`, `packages/theme`)

The site is a Next.js application using the **Pages Router** with React 18
and **Ant Design 6** (plus `@ant-design/pro-components`). Pages fetch data
in the browser through the SDK; there is no `getServerSideProps` today.

This document covers both how the site is written today and where it is
heading (theme package, shared UI package). Rules marked _target_ apply to
new code now and to existing code as it is touched.

## Layout

```
src/
  pages/<domain>/...          routes (dionysus/, minerva/, tools/, auth/, docs/)
  pages/api/                  Next.js API routes (auth, ping)
  components/<feature>/       feature components (notes/, minerva/meetings/, dionysus/media/)
  components/common/          app-wide building blocks (ErrorBlock, Loader, LoadingWrapper)
  components/layout/          page chrome (AuthWrapper, layouts)
  api/                        clients from @ncfritz/olympus-client (ADR 0017)
  hooks/                      useFetch, useDrag
  redux/                      store.ts, hooks.ts, slices/
  utils/                      formatting and helper functions
  styles/                     global CSS (to be retired, see Styling)
```

Components used by more than one app (site, Minerva web, desktop) move to
`packages/ui`.

## Components

- Function components, one per file, file named after the component
  (PascalCase `.tsx`).
- Props are an exported interface `<Component>Props`.
- Declare as `React.FunctionComponent<Props>`, destructure props with
  defaults in the signature, and `export default` the component:

```tsx
export interface ErrorBlockProps {
  title?: string;
  message?: string;
  error?: Error;
}

const ErrorBlock: React.FunctionComponent<ErrorBlockProps> = ({
  title = "An unexpected error occurred",
  message,
  error,
}: ErrorBlockProps) => {
  return <Result status="error" title={title} subTitle={message} />;
};

export default ErrorBlock;
```

- Use AntD components before writing custom ones. Use `ProTable`,
  `ProForm` and the other pro-components for data-heavy screens.
- Use `ErrorBlock` for error states and `Loader` / `LoadingWrapper` for
  loading states rather than one-off versions.

## Data fetching

- Calls go through `src/api/<area>Api.ts`: classes that configure the SDK
  client (`baseURL: "/api/v1"`) and wrap SDK functions, exported as default
  singletons. Components never call `fetch` or axios directly.
- Components load data with `useFetch({ params, fetchFunction, ... })`,
  which handles loading, errors and notification on failure.
- _Target:_ the site's data-fetching approach (keep `useFetch`, adopt a
  query library, or move some pages to server rendering) is reviewed in the
  React best-practices pass. Until then, use `useFetch`.

## State

- Local UI state: `useState` / `useReducer`.
- Cross-page UI state (layout, notifications, overlays): Redux Toolkit
  slices in `src/redux/slices/`, accessed through the typed hooks in
  `redux/hooks.ts`.
- Server data is not copied into Redux.
- Real-time notifications arrive over Socket.IO (`socket.io-react-hook`).

## Styling

Current state: about 1,700 inline `style={{…}}` objects in about 225 files,
six global CSS files, `antd-css-utilities` classes, and per-component
`ConfigProvider` overrides. ADR 0012 sets the direction.

_Target_ rules:

1. **Theme first.** Colors, spacing, radii, font sizes and shadows come from
   AntD design tokens defined in `packages/theme`. Read them with
   `theme.useToken()` where a value is needed in code.
2. **No new inline style objects.** Use a styles hook (`createStyles` from
   `antd-style`) or a CSS module. The lint rule in
   `@ncfritz/olympus-config/eslint/react` warns in the site and errors in
   `packages/ui` and `packages/theme`. **[checked]**
3. **No per-component `ConfigProvider`** to restyle a component. Add a
   component token to the theme instead.
4. **Layout with AntD primitives** (`Flex`, `Space`, `Row`/`Col`) and their
   props (`gap`, `align`, `justify`) rather than style objects.
5. Global CSS is limited to resets and third-party overrides. Feature
   styles live with the feature.
6. Every visual constant has one definition. A magic number in two places
   becomes a token.

## Accessibility

- Icon-only buttons carry `aria-label` (or AntD `title`).
- Don't rely on color alone for status; pair it with an icon or text.
- Interactive elements are real buttons or links, not clickable `div`s.

## Configuration and secrets

- Browser-visible config uses `NEXT_PUBLIC_*` env vars. No keys in source.

## Testing

- Components: React Testing Library + Vitest, with MSW mocking the SDK's
  HTTP calls.
- Critical flows: a small Playwright smoke suite.
