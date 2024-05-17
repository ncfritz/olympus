/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "eslint",
        releaseRules: [
          { type: "Docs", release: "patch" },
          { type: "Fix", release: "minor" },
          { type: "New", release: "minor" },
          { type: "Feature", release: "minor" },
          { type: "Update", release: "patch" },
          { type: "Breaking", release: "minor" },
          { type: "Build", release: "patch" },
          { type: "Upgrade", release: "patch" },
          { type: "Chore", release: "patch" },
          { scope: "no-release", release: false },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "eslint",
        presetConfig: {
          types: [
            {
              type: "Docs",
              section: ":memo: Documentation",
              hidden: false,
            },
            {
              type: "Fix",
              section: ":bug: Fixes",
              hidden: false,
            },
            {
              type: "New",
              section: ":sparkles: New Components",
              hidden: false,
            },
            {
              type: "Feature",
              section: ":fire: New Features",
              hidden: false,
            },
            {
              type: "Update",
              section: ":wrench: Updates",
              hidden: false,
            },
            {
              type: "Breaking",
              section: ":boom: Breaking Changes",
              hidden: false,
            },
            {
              type: "Build",
              section: ":rocket: Build Changes",
              hidden: false,
            },
            {
              type: "Upgrade",
              section: ":package: Package Upgrades",
              hidden: false,
            },
            {
              type: "Chore",
              hidden: true,
            },
          ],
        },
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
        tarballDir: "dist",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist/*.tgz"],
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json"],
        message:
          "Chore: ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
