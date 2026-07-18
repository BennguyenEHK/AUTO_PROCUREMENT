import "server-only";

import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRANDING_ASSETS = {
  logo: "C:\\Users\\LENOVO\\.codex\\skills\\report-generator\\assets\\logos\\logo.png",
  signature: "C:\\Users\\LENOVO\\.codex\\skills\\report-generator\\assets\\signatures\\signature.png"
} as const;

type BrandingAsset = keyof typeof BRANDING_ASSETS;

function placeholderResponse(asset: BrandingAsset): Response {
  const label = asset === "logo" ? "Company letterhead unavailable" : "Signature unavailable";
  const width = asset === "logo" ? 1200 : 420;
  const height = asset === "logo" ? 155 : 240;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><rect width="100%" height="100%" fill="#fff"/><rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#a43f3f" stroke-width="4" stroke-dasharray="12 8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#752727" font-family="Arial, sans-serif" font-size="28">${label}</text></svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-QuoteFlow-Asset-State": "unavailable"
    }
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> }
): Promise<Response> {
  const { asset } = await context.params;
  if (asset !== "logo" && asset !== "signature") {
    return new Response("Branding asset not found.", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  try {
    const image = await readFile(BRANDING_ASSETS[asset]);
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
        "X-QuoteFlow-Asset-State": "available"
      }
    });
  } catch {
    return placeholderResponse(asset);
  }
}
