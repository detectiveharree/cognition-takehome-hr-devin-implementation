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
    // Messages are part of the session data, not a separate endpoint
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
        { error: "Failed to get session messages", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract messages from the session data (API returns 'messages' array)
    const rawMessages = data.messages || [];
    
    // Log raw message structure for debugging
    if (rawMessages.length > 0) {
      console.log("Raw message sample:", JSON.stringify(rawMessages[rawMessages.length - 1], null, 2));
    }
    
    const messages = rawMessages.map((msg: Record<string, unknown>) => ({
      role: msg.role || msg.type || "unknown",
      text: msg.message || msg.text || msg.content || "",
      message: msg.message || msg.text || msg.content || "",
      content: msg.message || msg.text || msg.content || "",
      // Include raw for debugging
      _raw: msg,
    }));

    console.log("Devin messages for session:", data.session_id, "count:", messages.length, "roles:", messages.map((m: { role: string }) => m.role));

    return NextResponse.json({
      messages,
    });
  } catch (error) {
    console.error("Error fetching session messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
