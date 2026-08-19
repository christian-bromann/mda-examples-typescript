import { fetchRepoContributors } from "./fetch-repo-contributors.js";
import { fetchRepoIssues } from "./fetch-repo-issues.js";
import { fetchRepoOverview } from "./fetch-repo-overview.js";
import { fetchRepoPullRequests } from "./fetch-repo-pull-requests.js";

export const repoPulseTools = [
  fetchRepoOverview,
  fetchRepoPullRequests,
  fetchRepoContributors,
  fetchRepoIssues,
];
