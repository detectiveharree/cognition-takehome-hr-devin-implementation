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

    return NextResponse.json({
      sessionId: data.session_id,
      status: data.status_enum,
      structuredOutput: data.structured_output,
      url: `https://app.devin.ai/sessions/${data.session_id}`,
      title: data.title,
    });
  } catch (error) {
    console.error("Error fetching session status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
