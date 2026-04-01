import { NextRequest, NextResponse } from "next/server";
import { webflowGet } from "@/lib/webflow";
import { FlavorItem } from "@/lib/types";

function checkAuth(req: NextRequest) {
  return req.cookies.get("auth")?.value === process.env.APP_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collectionId = process.env.COLLECTION_ID!;
  const allItems: FlavorItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await webflowGet(
      `/collections/${collectionId}/items?limit=${limit}&offset=${offset}`
    );

    for (const item of data.items) {
      allItems.push({
        id: item.id,
        name: item.fieldData.name,
        slug: item.fieldData.slug,
        locationId: item.fieldData["store-location"] || "",
        startDate: item.fieldData["start-date"] || "",
        endDate: item.fieldData["end-date"] || "",
        className: item.fieldData["class-name"] || "",
        allDay: item.fieldData["all-day"] ?? true,
        isDraft: item.isDraft,
        isArchived: item.isArchived,
        lastPublished: item.lastPublished,
      });
    }

    if (offset + limit >= data.pagination.total) break;
    offset += limit;
  }

  return NextResponse.json({ items: allItems, total: allItems.length });
}
