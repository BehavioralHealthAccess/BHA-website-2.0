import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getGeminiKey(): string {
  const fromEnv = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (fromEnv) return fromEnv;

  // Fallback: allow using repo-root .env when running Next from webapp/.
  const rootEnvPath = join(process.cwd(), "..", ".env");
  if (!existsSync(rootEnvPath)) return "";
  const raw = readFileSync(rootEnvPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if ((key === "GEMINI_API_KEY" || key === "GOOGLE_API_KEY") && value) return value;
  }
  return "";
}

function candidateModels(preferred: string): string[] {
  const configured = (process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const defaults = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  const ordered = [preferred, ...configured, ...defaults].filter(Boolean);
  return Array.from(new Set(ordered));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  const key = getGeminiKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY is not set. Add it to webapp/.env.local (or root env for your process).",
      },
      { status: 503 },
    );
  }

  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const system = String(payload.system || "");
  const userContent = String(payload.user_content || "");
  if (!userContent.trim()) {
    return NextResponse.json({ error: "user_content required" }, { status: 400 });
  }

  const defaultModel = "gemini-2.5-flash";
  const requested = String(payload.model || process.env.GEMINI_MODEL || defaultModel).trim();
  const preferred = requested.startsWith("gemini-") ? requested : defaultModel;
  const models = candidateModels(preferred);
  const maxTokens = Number(payload.max_tokens || 800);

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      maxOutputTokens: Number.isFinite(maxTokens) ? maxTokens : 800,
      temperature: 0.3,
    },
  };
  if (system.trim()) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  let lastError = "Gemini request failed.";
  let lastStatus: number | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok || !data) {
          const err = (data?.error as { message?: string } | undefined)?.message;
          lastError = err || `Gemini failed with status ${res.status}`;
          lastStatus = res.status;
          if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 2) {
            await delay(800 * (attempt + 1));
            continue;
          }
          break;
        }

        const candidates = (data.candidates as Array<Record<string, unknown>> | undefined) || [];
        const parts =
          ((candidates[0]?.content as { parts?: Array<{ text?: string }> } | undefined)?.parts ||
            []) as Array<{ text?: string }>;
        const text = parts.map((p) => p.text || "").join("");

        if (!text.trim()) {
          lastError = "Gemini returned empty text.";
          lastStatus = 502;
          break;
        }

        return NextResponse.json(
          {
            content: [{ type: "text", text }],
            id: "gemini",
            model,
          },
          { status: 200 },
        );
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        lastStatus = 502;
        break;
      }
    }
  }

  return NextResponse.json({ error: lastError, gemini_status: lastStatus }, { status: 502 });
}
