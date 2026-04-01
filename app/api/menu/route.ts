import { NextRequest, NextResponse } from "next/server";
import { webflowGet, webflowPatch, webflowPost } from "@/lib/webflow";

const MENU_COLLECTION_ID = "660e2dd948822e6aba616235";
const MENU_ITEM_ID = "660e2de9ca4a9923e1f0c916";

function checkAuth(req: NextRequest) {
  return req.cookies.get("auth")?.value === process.env.APP_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await webflowGet(`/collections/${MENU_COLLECTION_ID}/items/${MENU_ITEM_ID}`);
    return NextResponse.json({
      flavor: data.fieldData["special-custard-flavor-all-stores"] ?? "",
      textColor: data.fieldData["special-custard-flavor-all-stores---text-color"] ?? "",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Failed to fetch menu: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { flavor, textColor } = await req.json();

  try {
    await webflowPatch(`/collections/${MENU_COLLECTION_ID}/items/${MENU_ITEM_ID}`, {
      fieldData: {
        "special-custard-flavor-all-stores": flavor,
        "special-custard-flavor-all-stores---text-color": textColor,
      },
    });

    await webflowPost(`/collections/${MENU_COLLECTION_ID}/items/publish`, {
      itemIds: [MENU_ITEM_ID],
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: `Failed to update menu: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
