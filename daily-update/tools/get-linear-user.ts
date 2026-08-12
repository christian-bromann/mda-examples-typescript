import { tool } from "langchain";
import { z } from "zod";

import { jsonResult, linearGraphql } from "./clients/linear.js";

type ViewerData = {
  viewer: {
    id: string;
    name: string;
    displayName: string;
    email: string;
  };
};

/** Resolve the authenticated Linear account for the deployment API key. */
export const getLinearUser = tool(
  async () => {
    const result = await linearGraphql<ViewerData>(`
      query GetLinearViewer {
        viewer {
          id
          name
          displayName
          email
        }
      }
    `);
    if ("error" in result) {
      return jsonResult({ error: result.error });
    }

    const { viewer } = result.data;
    return jsonResult({
      id: viewer.id,
      name: viewer.name,
      displayName: viewer.displayName,
      email: viewer.email,
    });
  },
  {
    name: "get_linear_user",
    description:
      "Return the Linear user for the deployment LINEAR_API_KEY. Call this before gathering Linear activity.",
    schema: z.object({}),
  }
);
