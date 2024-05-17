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
    [
      "@semantic-release/changelog",
      {
        changelogFile: "./CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "ember",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
        tarballDir: "dist",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist/*.tgz"],
      },
    ],
  ],
};
