import { NextRequest, NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;
const DEVIN_API_URL = "https://api.devin.ai/v1/sessions";

interface EndpointToAnalyze {
  endpoint: string;
  apiPath: string;
  docsPath: string;
}

// JSON Schema for structured output
const structuredOutputSchema = {
  type: "object",
  properties: {
    analyses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            description: "The API endpoint path",
          },
          status: {
            type: "string",
            enum: ["IN_SYNC", "NEEDS_UPDATE"],
            description: "Whether the documentation is in sync with the code",
          },
          reason: {
            type: "string",
            description:
              "Brief explanation of why the documentation needs updating, or confirmation that it is in sync",
          },
        },
        required: ["endpoint", "status", "reason"],
      },
    },
  },
  required: ["analyses"],
};

export async function POST(request: NextRequest) {
  if (!DEVIN_API_KEY) {
    return NextResponse.json(
      { error: "DEVIN_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { endpoints, repoOwner, repoName } = body as {
      endpoints: EndpointToAnalyze[];
      repoOwner: string;
      repoName: string;
    };

    if (!endpoints || endpoints.length === 0) {
      return NextResponse.json(
        { error: "No endpoints to analyze" },
        { status: 400 }
      );
    }

    // Build the prompt for Devin
    const endpointList = endpoints
      .map(
        (e) =>
          `- Endpoint: ${e.endpoint}\n  API Code: https://github.com/${repoOwner}/${repoName}/tree/main/${e.apiPath}\n  Documentation: https://github.com/${repoOwner}/${repoName}/blob/main/${e.docsPath}`
      )
      .join("\n\n");

    const prompt = `You are analyzing API documentation for the ${repoName} repository.

**IMPORTANT CONTEXT**: This is a demonstration codebase built for a technical take-home project. The API routes are intentional mocks — do not flag issues where the implementation is simplified, incomplete, or uses hardcoded data. Do not critique the API implementation itself.

Your only job is to identify DRIFT between what the documentation claims and what the code actually does.

**Only flag something as NEEDS_UPDATE if:**
- The documentation describes an endpoint that does not exist in the code
- The documentation describes a parameter or query option that the code does not accept
- The documentation describes a response field that the code never returns
- The code returns a field or accepts a parameter that is not documented

**Do NOT flag:**
- Missing error handling or simplified error responses
- Simplified business logic or mock implementations
- Hardcoded/mock data instead of real data sources
- Rate limiting described in docs but not enforced in code
- Missing validation that docs describe
- Limited data sets (e.g., docs list many currency pairs but code only has a subset)
- Any quality concerns about the implementation itself

Here are the endpoints to analyze:

${endpointList}

For each endpoint, provide a status of either "IN_SYNC" (documentation accurately describes the API contract) or "NEEDS_UPDATE" (documentation claims something that the code does not support, or code does something undocumented), along with a brief reason explaining your assessment.

Return your analysis as structured JSON output.`;

    // Create a Devin session
    const response = await fetch(DEVIN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEVIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        structured_output_schema: structuredOutputSchema,
        title: `Documentation Audit: ${repoName}`,
        tags: ["doc-sync", "automated"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Devin API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create Devin session", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      sessionId: data.session_id,
      url: data.url,
    });
  } catch (error) {
    console.error("Error creating Devin session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
