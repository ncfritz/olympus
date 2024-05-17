/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "ember",
        releaseRules: [
          { type: "Feature", scope: "README", release: "patch" },
          { type: "Update", release: "patch" },
          { type: "New", release: "minor" },
          { type: "Breaking", release: "minor" },
          { type: "New", release: "minor" },
          { type: "Build", release: "patch" },
          { type: "Upgrade", release: "minor" },
          { type: "Chore", release: "patch" },
          { scope: "no-release", release: false },
        ],
      },
    ],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/github",
      {
        assets: ["/build/dist/**/*.js", "/build/dist/**/*.d.ts"],
      },
    ],
  ],
};
