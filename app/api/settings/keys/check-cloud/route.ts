import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Check if cloud keys (env vars) are available
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasOpenrouter = !!process.env.OPENROUTER_API_KEY;
    const hasTavily = !!process.env.TAVILY_API_KEY;

    return NextResponse.json({
      success: true,
      hasCloudKeys: hasGroq && hasOpenrouter,
      hasGroq,
      hasOpenrouter,
      hasTavily,
    });
  } catch (error) {
    console.error("Check cloud keys error:", error);
    return NextResponse.json(
      { success: false, hasCloudKeys: false },
      { status: 500 }
    );
  }
}

