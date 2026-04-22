export const config = {
  github_url: "https://github.com/detectiveharree/outdated-angular-14-example",
  github_owner: "detectiveharree",
  github_repo: "outdated-angular-14-example",
  // API routes to ignore from documentation audits
  ignoredEndpoints: [
    "search",
    "docs-structure",
  ],
};

export type Config = typeof config;
