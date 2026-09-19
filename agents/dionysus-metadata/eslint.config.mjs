import node from "@ncfritz/olympus-config/eslint/node";

export default [
  ...node,
  {
    // TMDB export lines are untyped (`any`) until the restructure onto the
    // agent conventions types them.
    files: ["src/handler/batch/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
