import { NextRequest, NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;
const DEVIN_API_URL = "https://api.devin.ai/v1/sessions";

interface FixAction {
  endpoint: string;
  action: "update" | "delete" | "create";
  docsPath?: string;
  apiPath?: string;
  reason?: string;
}

// JSON Schema for structured output
const structuredOutputSchema = {
  type: "object",
  properties: {
    pr_url: {
      type: "string",
      description: "The URL of the created pull request",
    },
    files_changed: {
      type: "array",
      items: { type: "string" },
      description: "List of files that were modified",
    },
    summary: {
      type: "string",
      description: "Brief summary of the changes made",
    },
    needs_clarification: {
      type: "boolean",
      description: "Set to true if you need clarification from the user before proceeding with documentation creation/updates",
    },
    clarification_questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            description: "The API endpoint this question is about",
          },
          question: {
            type: "string",
            description: "A specific question about the endpoint's intended behavior",
          },
        },
        required: ["endpoint", "question"],
      },
      maxItems: 2,
      description: "Exactly 2 questions to ask the user about endpoints that need clarification",
    },
  },
  required: ["summary"],
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
    const { actions, repoOwner, repoName } = body as {
      actions: FixAction[];
      repoOwner: string;
      repoName: string;
    };

    if (!actions || actions.length === 0) {
      return NextResponse.json(
        { error: "No actions to perform" },
        { status: 400 }
      );
    }

    // Separate update, delete, and create actions
    const updateActions = actions.filter((a) => a.action === "update");
    const deleteActions = actions.filter((a) => a.action === "delete");
    const createActions = actions.filter((a) => a.action === "create");

    // Build the prompt for Devin
    let prompt = `Clone the repository at https://github.com/${repoOwner}/${repoName}.

You are updating API documentation to match the actual implementation. This is a demonstration codebase built for a technical take-home project.

**CRITICAL RULES:**
- ONLY modify files in the /docs/ folder
- Do NOT modify any API route files or implementation code
- Do NOT add implementation details that don't exist - only document what IS implemented
- When in doubt about behavior, read the actual code to verify

`;

    if (updateActions.length > 0) {
      prompt += `\n## Documentation to UPDATE\n\nFor each of these, read the actual API implementation code and update the documentation to accurately reflect what the code does:\n\n`;
      
      for (const action of updateActions) {
        prompt += `### ${action.endpoint}\n`;
        prompt += `- Documentation file: /${action.docsPath}\n`;
        if (action.apiPath) {
          prompt += `- API implementation: /${action.apiPath}\n`;
        }
        if (action.reason) {
          prompt += `- Issue identified: ${action.reason}\n`;
        }
        prompt += `\n`;
      }
    }

    if (deleteActions.length > 0) {
      prompt += `\n## Documentation to DELETE\n\nThese documentation files have no corresponding API route and should be removed:\n\n`;
      
      for (const action of deleteActions) {
        prompt += `- /${action.docsPath} (documents ${action.endpoint} which does not exist)\n`;
      }
    }

    if (createActions.length > 0) {
      prompt += `\n## Documentation to CREATE\n\nThese API routes exist but have no documentation. You MUST ask clarifying questions before creating documentation:\n\n`;
      
      for (const action of createActions) {
        prompt += `### ${action.endpoint}\n`;
        prompt += `- Create documentation at: /docs/endpoints/${action.endpoint.replace('/api/', '')}.md\n`;
        if (action.apiPath) {
          prompt += `- API implementation: /${action.apiPath}\n`;
        }
        prompt += `\n`;
      }
      
      prompt += `**IMPORTANT CONTEXT:** This is a demonstration for a technical take-home assessment. Treat this as a real production API product and ask questions as if you're a technical writer documenting a real API for external developers. Do NOT break the fourth wall by asking meta questions about "is this implemented correctly" or "should we document what's implemented vs intended" - assume the implementation IS the product.

Before creating documentation for undocumented endpoints:
1. Set needs_clarification to true
2. Add EXACTLY 2 questions total to clarification_questions (no more, no less) - ask product-focused questions that a technical writer would ask, such as:
   - "What data sources or providers does this endpoint use?" (e.g., for crypto: Coinbase, Binance, etc.)
   - "Is this endpoint available on the free tier, or is it restricted to paid API plans?"
   - "What rate limits apply to this endpoint?"
   - "Are there any authentication requirements or API key scopes needed?"
   - "What regions or markets does this endpoint cover?"

Ask questions that help you write better documentation for external developers, NOT questions about whether to document the current implementation.

Wait for user answers before proceeding with documentation creation.\n\n`;
    }

    prompt += `\n## Instructions

1. For UPDATE actions: Read the actual API code carefully and update the markdown documentation to match exactly what the implementation does.

2. For DELETE actions: Remove the orphaned documentation files entirely.

3. For CREATE actions: STOP and ask 2 product-focused clarifying questions first by setting needs_clarification: true. Ask questions a technical writer would ask (data sources, pricing tiers, rate limits, etc.) - NOT meta questions about implementation vs intent.

4. After completing all changes (or if needs_clarification is true), open a pull request with your changes titled "docs: sync documentation with implementation".

Return your results as structured JSON output.`;

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
        title: `Documentation Fix: ${repoName}`,
        tags: ["doc-fix", "automated", "pr"],
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
    console.error("Error creating Devin fix session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
