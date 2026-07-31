import { NextResponse } from "next/server";
import { pollAllFormTriggers } from "@/lib/triggers/polling";

export async function GET() {
  try {
    const result = await pollAllFormTriggers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] poll-triggers failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
