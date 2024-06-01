/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: ["main"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "Docs", release: "patch" },
          { type: "Fix", release: "patch" },
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
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            {
              type: "docs",
              section: ":memo: Documentation",
              hidden: false,
            },
            {
              type: "fix",
              section: ":bug: Bug Fixes",
              hidden: false,
            },
            {
              type: "new",
              section: ":sparkles: New Components",
              hidden: false,
            },
            {
              type: "feature",
              section: ":fire: New Features",
              hidden: false,
            },
            {
              type: "update",
              section: ":wrench: Updates",
              hidden: false,
            },
            {
              type: "breaking",
              section: ":boom: Breaking Changes",
              hidden: false,
            },
            {
              type: "build",
              section: ":rocket: Build Changes",
              hidden: false,
            },
            {
              type: "upgrade",
              section: ":package: Package Upgrades",
              hidden: false,
            },
            {
              type: "chore",
              hidden: true,
            },
          ],
        },
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
