import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;
const DEVIN_SESSIONS_URL = "https://api.devin.ai/v1/sessions";
const DEVIN_PLAYBOOKS_URL = "https://api.devin.ai/v1/playbooks";

// Cheap on-disk cache so we don't recreate the playbook every run.
const PLAYBOOK_CACHE_PATH = path.join(
  process.cwd(),
  "public",
  "devin-playbook.json",
);
const PLAYBOOK_MARKDOWN_PATH = path.join(
  process.cwd(),
  "playbooks",
  "migration.md",
);

interface PlaybookCache {
  playbook_id: string;
  created_at: string;
}

async function getOrCreatePlaybookId(): Promise<string> {
  // 1. Check cache on disk.
  if (fs.existsSync(PLAYBOOK_CACHE_PATH)) {
    try {
      const cached = JSON.parse(
        fs.readFileSync(PLAYBOOK_CACHE_PATH, "utf-8"),
      ) as PlaybookCache;
      if (cached.playbook_id) {
        return cached.playbook_id;
      }
    } catch {
      // fall through to recreate
    }
  }

  // 2. Create playbook in Devin.
  const playbookMarkdown = fs.readFileSync(PLAYBOOK_MARKDOWN_PATH, "utf-8");

  const response = await fetch(DEVIN_PLAYBOOKS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEVIN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Angular Migration Playbook: 14 → 18",
      body: playbookMarkdown,
      macro: "!angular-migration",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create playbook: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const playbook_id: string | undefined = data.playbook_id || data.id;
  if (!playbook_id) {
    throw new Error(`Playbook API returned no id: ${JSON.stringify(data)}`);
  }

  // 3. Cache to disk.
  const cache: PlaybookCache = {
    playbook_id,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(PLAYBOOK_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");

  return playbook_id;
}

const structuredOutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["in_progress", "blocked", "complete", "failed"],
    },
    current_action: { type: "string" },
    breaking_changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          description: { type: "string" },
          resolved: { type: "boolean" },
        },
      },
    },
    build_status: {
      type: "string",
      enum: ["pending", "pass", "fail"],
    },
    qa_status: {
      type: "string",
      enum: ["pending", "pass", "fail"],
      description:
        "Result of Devin's self-QA after the build: does the app render and behave correctly?",
    },
    qa_notes: {
      type: "string",
      description:
        "Short summary of what Devin observed during QA — pages checked, console errors, issues found.",
    },
    pr_url: { type: ["string", "null"] },
    notes: { type: "string" },
    summary: {
      type: "string",
      description:
        "2–4 sentence human-readable summary of what was done in this migration step: key changes, notable breaking changes resolved, build/QA outcome. Shown to the operator in the UI.",
    },
    files_changed: { type: "number" },
    lines_changed: { type: "number" },
  },
  required: ["status"],
};

export async function POST(request: NextRequest) {
  if (!DEVIN_API_KEY) {
    return NextResponse.json(
      { error: "DEVIN_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { fromVersion, toVersion, repoOwner, repoName } = body as {
      fromVersion: number;
      toVersion: number;
      repoOwner: string;
      repoName: string;
    };

    if (!fromVersion || !toVersion || !repoOwner || !repoName) {
      return NextResponse.json(
        { error: "fromVersion, toVersion, repoOwner, repoName are required" },
        { status: 400 },
      );
    }

    const playbook_id = await getOrCreatePlaybookId();

    const prompt = `Execute the Angular migration playbook for step: Angular ${fromVersion} → ${toVersion}.
Repository: https://github.com/${repoOwner}/${repoName}

Only perform this single version step. Do NOT continue to the next major version.

After ng update completes and the build passes, QA the application in your own environment:
- Run \`ng serve\` and navigate to http://localhost:4200/login, /dashboard, and /notifications
- For each page, check that it renders, and read the browser console
- Report a QA verdict (pass/fail) based on whether the app runs cleanly with no console errors and the key pages render

Do NOT attempt to capture or attach screenshots — just report your QA verdict and notes in structured output.

Please update structured output continuously as you:
- Start each sub-step (update current_action)
- Encounter any breaking changes (append to breaking_changes)
- Complete the build (set build_status)
- Finish in-environment QA (set qa_status + qa_notes)
- Raise a PR (set pr_url)

Final structured_output must include status, build_status, qa_status, qa_notes, breaking_changes, pr_url, files_changed, lines_changed, notes, and a \`summary\` field (2–4 sentences, human-readable) describing what you did, what broke, and how QA went.`;

    const response = await fetch(DEVIN_SESSIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DEVIN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        playbook_id,
        title: `Angular ${fromVersion} → ${toVersion} Migration`,
        tags: ["angular-migration", `v${fromVersion}-to-v${toVersion}`],
        structured_output_schema: structuredOutputSchema,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Devin session create error:", errorText);
      return NextResponse.json(
        { error: "Failed to create Devin session", details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      sessionId: data.session_id,
      url: data.url,
      playbookId: playbook_id,
    });
  } catch (error) {
    console.error("Error starting migration session:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
