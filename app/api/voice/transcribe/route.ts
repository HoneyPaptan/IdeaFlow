import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/ai";

export const runtime = "nodejs"; // avoid edge for multipart/form-data

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const language = form.get("language") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "File is required" }, { status: 400 });
    }

    const text = await transcribeAudio(file, { language: language ?? undefined });
    return NextResponse.json({ success: true, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

