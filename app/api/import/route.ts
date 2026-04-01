import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LOCATIONS } from "@/lib/locations";

function checkAuth(req: NextRequest) {
  return req.cookies.get("auth")?.value === process.env.APP_PASSWORD;
}

const LOCATION_MAP = LOCATIONS.map((l) => `"${l.name}" => ID: "${l.id}"`).join("\n");

const SYSTEM_PROMPT = `You are a data extraction assistant. You will receive a frozen custard flavor calendar document. The document contains a grid where:
- Rows represent days of the month
- Columns represent store locations
- Each cell contains a flavor name for that day at that location

Your job is to extract ALL flavor entries and consolidate consecutive days with the same flavor at the same location into date ranges.

Here are the store locations and their IDs:
${LOCATION_MAP}

The column headers in the document usually contain addresses or location names. Map them to the correct location using these rules:
- "Sheridan" or "Kenmore" => Sheridan Drive
- "Main Street" or "Williamsville" => Main Street
- "Union" or "Cheektowaga" => Union Road
- "Transit" or "Lancaster" or "Depew" => Lancaster
- "Delaware" or "Buffalo" => Delaware Ave
- "Niagara Falls" or "West Amherst" or "Amherst" => West Amherst
- "Grand Island" => Grand Island

IMPORTANT RULES:
- Skip any rows or cells marked "CLOSED" or empty
- Consolidate consecutive days with the same flavor at the same location into a single entry with start and end dates
- Use ISO date format: YYYY-MM-DD
- The month and year will be indicated in the document or provided separately
- Return ONLY a valid JSON array with no markdown, no code fences, no explanation

Each entry in the array must be:
{
  "name": "Flavor Name",
  "locationId": "the_location_id",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}`;

function detectMonthYear(text: string): { month: number; year: number } {
  const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const lower = text.toLowerCase();
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();
  for (let i = 0; i < monthNames.length; i++) {
    if (lower.includes(monthNames[i])) { month = i + 1; break; }
  }
  const yearMatch = text.match(/20\d{2}/);
  if (yearMatch) year = parseInt(yearMatch[0]);
  return { month, year };
}

function parseFlavorJson(raw: string) {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in AI response");
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });

  const client = new Anthropic({ apiKey });
  const contentType = req.headers.get("content-type") || "";

  // ── TEXT / JSON path (pasted text) ──────────────────────────────────────
  if (contentType.includes("application/json")) {
    const { text, month, year } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const detected = detectMonthYear(text);
    const m = month || detected.month;
    const y = year || detected.year;

    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Extract all flavor entries from this ${m}/${y} flavor calendar and return a JSON array:\n\n${text}`
        }],
      });

      const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
      const flavors = parseFlavorJson(raw);
      return NextResponse.json({ flavors, count: flavors.length });
    } catch (e: unknown) {
      return NextResponse.json({ error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }

  // ── FILE UPLOAD path (PDF / DOCX / TXT) ─────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = file.type;

    // PDF → send directly to Claude as a base64 document
    if (ext === "pdf" || mime === "application/pdf") {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const { month, year } = detectMonthYear(""); // will fall back to today; Claude reads it from doc

      try {
        const msg = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              } as Anthropic.DocumentBlockParam,
              {
                type: "text",
                text: `Extract all flavor entries from this flavor calendar PDF and return a JSON array. The month/year should be visible in the document itself.`,
              },
            ],
          }],
        });

        const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
        const flavors = parseFlavorJson(raw);
        return NextResponse.json({ flavors, count: flavors.length });
      } catch (e: unknown) {
        return NextResponse.json({ error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
      }
    }

    // DOCX → extract text with mammoth, then send as text
    if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const bytes = await file.arrayBuffer();
      // Dynamically import mammoth to avoid SSR issues
      const mammoth = (await import("mammoth")).default;
      const { value: text } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const { month, year } = detectMonthYear(text);

      try {
        const msg = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Extract all flavor entries from this ${month}/${year} flavor calendar and return a JSON array:\n\n${text}`
          }],
        });

        const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
        const flavors = parseFlavorJson(raw);
        return NextResponse.json({ flavors, count: flavors.length });
      } catch (e: unknown) {
        return NextResponse.json({ error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
      }
    }

    // TXT / CSV / TSV → read as plain text
    const text = await file.text();
    const { month, year } = detectMonthYear(text);

    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Extract all flavor entries from this ${month}/${year} flavor calendar and return a JSON array:\n\n${text}`
        }],
      });

      const raw = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("");
      const flavors = parseFlavorJson(raw);
      return NextResponse.json({ flavors, count: flavors.length });
    } catch (e: unknown) {
      return NextResponse.json({ error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
}
