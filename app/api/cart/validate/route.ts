import { rawCartSchema } from "@/lib/cart/schema";
import { validateCartAgainstCatalogue } from "@/lib/cart/server-validation";

const MAX_REQUEST_BYTES = 128 * 1024;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: RESPONSE_HEADERS });
}

export async function POST(request: Request) {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return json(
      {
        error: {
          code: "unsupported_media_type",
          message: "Send the cart as JSON and try again.",
        },
      },
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(
      {
        error: {
          code: "cart_too_large",
          message: "This cart is too large to validate safely.",
        },
      },
      413,
    );
  }

  let input: unknown;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return json(
        {
          error: {
            code: "cart_too_large",
            message: "This cart is too large to validate safely.",
          },
        },
        413,
      );
    }
    input = JSON.parse(body);
  } catch {
    return json(
      {
        error: {
          code: "invalid_json",
          message: "The cart could not be read. Refresh and try again.",
        },
      },
      400,
    );
  }

  const parsed = rawCartSchema.safeParse(input);
  if (!parsed.success) {
    return json(
      {
        error: {
          code: "invalid_cart",
          message: "The cart contains invalid or unsupported selections.",
        },
      },
      400,
    );
  }

  try {
    return json(await validateCartAgainstCatalogue(parsed.data));
  } catch {
    return json(
      {
        error: {
          code: "catalogue_unavailable",
          message:
            "We could not confirm the current menu. Your cart is safe—please retry.",
        },
      },
      503,
    );
  }
}
