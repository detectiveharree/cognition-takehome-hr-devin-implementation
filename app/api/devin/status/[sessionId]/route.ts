import { NextRequest, NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!DEVIN_API_KEY) {
    return NextResponse.json(
      { error: "DEVIN_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { sessionId } = await params;

  try {
    const response = await fetch(
      `https://api.devin.ai/v1/sessions/${sessionId}`,
      {
        headers: {
          Authorization: `Bearer ${DEVIN_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to get session status", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Pull the latest Devin-authored status line so the UI can show an
    // up-to-date "what am I doing right now" indicator.
    //
    // `structured_output.current_action` only updates when Devin explicitly
    // rewrites its structured output, so it gets "stuck" on the first value
    // while the session is actually progressing. The `messages` array is
    // the source of truth, but it contains several entry types:
    //   - `user_message`         – messages from us/the user (skip)
    //   - `devin_message`        – prose replies from Devin
    //   - `devin_action` / other – short status lines like
    //                              "Updating Angular core and CLI" that show
    //                              up in the Devin UI under the activity feed
    //
    // We want the most recent non-user entry with any text, because that's
    // what the Devin UI shows as the current activity.
    const rawMessages: Array<Record<string, unknown>> = Array.isArray(
      data.messages,
    )
      ? data.messages
      : [];

    const isUserMessage = (m: Record<string, unknown>) => {
      const t = ((m.type as string | undefined) ?? "").toLowerCase();
      const r = ((m.role as string | undefined) ?? "").toLowerCase();
      return (
        t === "user_message" ||
        t === "user" ||
        r === "user" ||
        r === "human"
      );
    };

    const extractText = (m: Record<string, unknown>) => {
      const candidates = [
        m.message,
        m.text,
        m.content,
        m.title,
        m.summary,
        m.description,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c;
      }
      return "";
    };

    let latestDevinMessage: string | null = null;
    // First pass: prefer the most recent `Status: ...` prefixed message —
    // the playbook instructs Devin to emit these as a dedicated progress feed.
    for (let i = rawMessages.length - 1; i >= 0; i--) {
      const m = rawMessages[i];
      if (isUserMessage(m)) continue;
      const text = extractText(m).trim();
      if (!text) continue;
      const match = text.match(/^\s*status\s*:\s*(.+)$/im);
      if (match) {
        latestDevinMessage = match[1].trim();
        break;
      }
    }
    // Fallback: any recent non-user message with text.
    if (!latestDevinMessage) {
      for (let i = rawMessages.length - 1; i >= 0; i--) {
        const m = rawMessages[i];
        if (isUserMessage(m)) continue;
        const text = extractText(m).trim();
        if (text) {
          latestDevinMessage = text;
          break;
        }
      }
    }

    // Lightweight debug so we can see what types Devin is emitting.
    if (rawMessages.length > 0) {
      console.log(
        "Devin session",
        data.session_id,
        "message types:",
        rawMessages.map(
          (m) => (m.type as string | undefined) ?? (m.role as string | undefined) ?? "?",
        ),
        "latest:",
        latestDevinMessage?.slice(0, 120),
      );
    }

    return NextResponse.json({
      sessionId: data.session_id,
      status: data.status_enum,
      structuredOutput: data.structured_output,
      latestDevinMessage,
      // Only surface a URL if the API actually returned one — don't
      // fabricate a /sessions/{id} path (that format 404s for some orgs).
      url: data.url ?? null,
      title: data.title,
      pullRequest: data.pull_request || null,
    });
  } catch (error) {
    console.error("Error fetching session status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
