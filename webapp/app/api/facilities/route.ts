import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const candidatePaths = [
      // Preferred: packaged with webapp for Vercel deployments.
      join(process.cwd(), "data", "facilities_clustered_runtime.json"),
      // Local fallback for older repo layouts.
      join(process.cwd(), "..", "data", "facilities_clustered_runtime.json"),
    ];

    let raw = "";
    let lastError: unknown = null;
    for (const dataPath of candidatePaths) {
      try {
        raw = await readFile(dataPath, "utf-8");
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!raw) throw lastError;
    const json = JSON.parse(raw);
    return NextResponse.json(json, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load facilities runtime data.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
