import node from "@ncfritz/olympus-config/vitest/node";

// Only the parts with no React Native in them are unit-tested: the status
// words and the theme. Anything that needs a device is a sign-off step in the
// plan (docs/plans/onair-ios/signoff.md), not a test.
// `test/unit/boundary.spec.ts` keeps that line where it is.
export default node;
