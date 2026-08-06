import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, octokitFromEnv } from "./github-client.js";

/** Resolve the authenticated GitHub account for the deployment token. */
export const getGithubUser = tool(
  async () => {
    const client = octokitFromEnv();
    if ("error" in client) {
      return jsonResult({ error: client.error });
    }

    const { data } = await client.rest.users.getAuthenticated();
    return jsonResult({
      login: data.login,
      name: data.name,
      url: data.html_url,
    });
  },
  {
    name: "get_github_user",
    description:
      "Return the GitHub login/name for the deployment GITHUB_TOKEN. Call this before gathering activity.",
    schema: z.object({}),
  }
);
