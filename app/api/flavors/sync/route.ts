import { NextRequest, NextResponse } from "next/server";
import { webflowPost, webflowPatch, webflowDelete } from "@/lib/webflow";
import { SyncPayload, SyncResult } from "@/lib/types";
import { getClassName } from "@/lib/locations";

function checkAuth(req: NextRequest) {
  return req.cookies.get("auth")?.value === process.env.APP_PASSWORD;
}

function generateSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload: SyncPayload = await req.json();
  const collectionId = process.env.COLLECTION_ID!;
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, published: 0, errors: [] };
  const idsToPublish: string[] = [];

  // Process creates
  if (payload.creates.length > 0) {
    for (const item of payload.creates) {
      try {
        const fieldData: Record<string, unknown> = {
          name: item.name,
          slug: generateSlug(item.name),
          "store-location": item.locationId,
          "start-date": item.startDate,
          "end-date": item.endDate,
          "class-name": getClassName(item.locationId),
          "all-day": true,
        };

        const res = await webflowPost(`/collections/${collectionId}/items`, {
          fieldData,
          isDraft: false,
          isArchived: false,
        });
        idsToPublish.push(res.id);
        result.created++;
      } catch (e: unknown) {
        result.errors.push(`Create "${item.name}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Process updates in batches of up to 25 (Webflow limit)
  if (payload.updates.length > 0) {
    const batches = [];
    for (let i = 0; i < payload.updates.length; i += 25) {
      batches.push(payload.updates.slice(i, i + 25));
    }

    for (const batch of batches) {
      try {
        const items = batch.map((item) => ({
          id: item.id,
          fieldData: {
            name: item.name,
            slug: item.slug,
            "store-location": item.locationId,
            "start-date": item.startDate,
            "end-date": item.endDate,
            "class-name": getClassName(item.locationId),
            "all-day": true,
          },
          isDraft: false,
          isArchived: false,
        }));

        await webflowPatch(`/collections/${collectionId}/items`, { items });
        result.updated += batch.length;
        idsToPublish.push(...batch.map((i) => i.id));
      } catch (e: unknown) {
        result.errors.push(`Update batch: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Process deletes
  if (payload.deletes.length > 0) {
    const batches = [];
    for (let i = 0; i < payload.deletes.length; i += 25) {
      batches.push(payload.deletes.slice(i, i + 25));
    }

    for (const batch of batches) {
      try {
        await webflowDelete(`/collections/${collectionId}/items`, {
          items: batch.map((id) => ({ id })),
        });
        result.deleted += batch.length;
      } catch (e: unknown) {
        result.errors.push(`Delete batch: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Publish all created/updated items
  if (idsToPublish.length > 0) {
    const pubBatches = [];
    for (let i = 0; i < idsToPublish.length; i += 100) {
      pubBatches.push(idsToPublish.slice(i, i + 100));
    }

    for (const batch of pubBatches) {
      try {
        await webflowPost(`/collections/${collectionId}/items/publish`, {
          itemIds: batch,
        });
        result.published += batch.length;
      } catch (e: unknown) {
        result.errors.push(`Publish: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return NextResponse.json(result);
}
