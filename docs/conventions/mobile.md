# Mobile (Expo / React Native)

`tools/auth-tester-mobile`, and the iOS app when it comes. The Expo parts of
this are not general React knowledge; the rules below are the ones that cost
time when they are not followed.

## Do not write Expo code from memory

Expo ships breaking changes every SDK release, so an API you are confident
about is as likely renamed, moved or removed as still there. Before touching
an Expo, EAS or React Native API:

1. Read the `expo` major version in the package's `package.json`.
2. Read the matching versioned docs:
   `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For anything else, `https://docs.expo.dev/llms.txt` indexes the
   documentation and lists corrections to the mistakes language models make
   about it. Follow it to the page; do not answer from training.

This applies to reviews as much as to writing: "that is not the current API"
is a finding.

## Dependencies

- `npx expo install <package>`, never `pnpm add`. It resolves the version
  that matches the installed SDK, and a version that does not match fails at
  runtime on a device rather than at install.
- It shells out to pnpm inside the workspace, which relinks `node_modules`
  under the running CLI; a `Cannot find module` from `@expo/cli` itself after
  `Done in …` is that, not a broken install. Check what landed in
  `package.json` before re-running anything.
- `npx expo-doctor` reports version drift and config faults. Run it after
  adding anything native.
- Everything else follows the workspace: internal dependencies are
  `workspace:*`, shared third-party versions are `catalog:`, and the Turbo
  task names (`build`, `typecheck`, `lint`, `test`) are what the scripts must
  be called, whatever they run underneath.

## Native code

- There are no `ios/` or `android/` directories, and there should not be:
  they are generated (Continuous Native Generation). Native behaviour is
  configured in `app.json` and in config plugins. A hand-edited `ios/` is
  lost at the next prebuild.
- Expo Go only carries its own bundled native modules. A package with native
  code — or a local Expo module of ours — needs a development build:
  `npx expo run:ios` with Xcode, or `eas build --profile development`, which
  builds in the cloud and needs no local Xcode at all. Anything hosted is a
  decision rather than a default here (ADR 0019 and the local-only rule), so
  ask before reaching for EAS.
- A local Expo module lives beside the app and is written in Swift for iOS.
  It exists when React Native cannot do the thing at all — presenting a
  client certificate, for instance — and not to wrap something JavaScript
  already reaches.

## Layout and tests

- Tests in `test/`, as everywhere else in this repository. Unit tests for the
  pure parts; anything that needs a device is a sign-off step in the plan, not
  a test.
- Flow logic that is not about the screen belongs in
  `packages/auth-flow` — platform-free, shared with the CLI tester and the
  site. The app's own code is screens, storage and the native module.
- Expo Router is worth it for an app with several screens; a single-screen
  tester is not one. Do not add it for the sake of the convention.
