import { NextRequest, NextResponse } from "next/server";

const DEVIN_API_KEY = process.env.DEVIN_API_KEY;

export async function POST(
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
    const body = await request.json();
    const { message } = body as { message: string };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Send message to the Devin session (singular 'message' endpoint per API docs)
    const response = await fetch(
      `https://api.devin.ai/v1/sessions/${sessionId}/message`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEVIN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to send message", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      messageId: data.message_id,
    });
  } catch (error) {
    console.error("Error sending message to session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get conversation/messages for a session
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
        { error: "Failed to get session", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract messages from the session (API returns 'messages' array)
    return NextResponse.json({
      sessionId: data.session_id,
      status: data.status_enum,
      structuredOutput: data.structured_output,
      pullRequest: data.pull_request,
      conversation: data.messages || [],
    });
  } catch (error) {
    console.error("Error fetching session conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
