import node from "@ncfritz/olympus-config/eslint/node";

export default [
  ...node,
  {
    // HandBrake, NZBGet and scraped page data are untyped (`any`) until the
    // restructure onto the agent conventions types them.
    files: ["src/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
