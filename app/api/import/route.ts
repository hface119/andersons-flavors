import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { LOCATIONS } from "@/lib/locations";

function checkAuth(req: NextRequest) {
  return req.cookies.get("auth")?.value === process.env.APP_PASSWORD;
}

const LOCATION_MAP = LOCATIONS.map((l) => `"${l.name}" => ID: "${l.id}"`).join("\n");

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, month, year } = await req.json();

  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a data extraction assistant. You will receive text from a frozen custard flavor calendar document. The document contains a grid where:
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
- Skip any rows marked "CLOSED"
- Consolidate consecutive days with the same flavor at the same location into a single entry with start and end dates
- Use ISO date format: YYYY-MM-DD
- The month and year will be provided
- Return ONLY a JSON array, no other text

Each entry in the array should be:
{
  "name": "Flavor Name",
  "locationId": "the_location_id",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD"
}`;

  const userPrompt = `Here is the flavor calendar text for ${month}/${year}. Extract all flavor entries, consolidate consecutive same-flavor days per location into date ranges, and return as a JSON array:

${text}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: systemPrompt,
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    const flavors = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ flavors, count: flavors.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI parsing failed: ${msg}` }, { status: 500 });
  }
}
