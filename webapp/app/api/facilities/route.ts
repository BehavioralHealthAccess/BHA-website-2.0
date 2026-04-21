import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const dataPath = join(
      process.cwd(),
      "..",
      "data",
      "facilities_clustered_runtime.json",
    );
    const raw = await readFile(dataPath, "utf-8");
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
