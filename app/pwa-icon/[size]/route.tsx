import type { NextRequest } from "next/server";
import { renderIcon } from "@/lib/pwa/icon-image";

const ALLOWED = new Set([192, 512]);

// Manifest icons: /pwa-icon/192 and /pwa-icon/512
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/pwa-icon/[size]">,
) {
  const { size } = await ctx.params;
  const px = Number(size);
  if (!ALLOWED.has(px)) return new Response("Not found", { status: 404 });
  return renderIcon(px);
}
