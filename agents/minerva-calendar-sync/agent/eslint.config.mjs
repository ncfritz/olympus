import node from "@ncfritz/olympus-config/eslint/node";

export default [
  ...node,
  {
    // Carried over from the source repo until the conventions restructure.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
