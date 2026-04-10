export const config = {
  github_url: "https://github.com/detectiveharree/cognition-takehome-hr-datastack-repo",
  github_owner: "detectiveharree",
  github_repo: "cognition-takehome-hr-datastack-repo",
  // API routes to ignore from documentation audits
  ignoredEndpoints: [
    "search",
    "docs-structure",
  ],
};

export type Config = typeof config;
