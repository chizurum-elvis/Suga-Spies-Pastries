import { DeliveryError } from "@/lib/delivery/errors";
import { isSameOriginMutation } from "@/lib/security/request";

export async function readCheckoutJson(
  request: Request,
  maximumBytes = 128 * 1024,
): Promise<unknown> {
  if (!isSameOriginMutation(request))
    throw new DeliveryError(
      "invalid_origin",
      "Refresh this page before trying again.",
      403,
    );
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  )
    throw new DeliveryError(
      "invalid_media_type",
      "Send checkout details as JSON.",
      415,
    );
  if (Number(request.headers.get("content-length")) > maximumBytes)
    throw new DeliveryError(
      "request_too_large",
      "These details are too long.",
      413,
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new DeliveryError(
      "invalid_json",
      "Checkout details could not be read.",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new DeliveryError(
          "request_too_large",
          "These details are too long.",
          413,
        );
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    if (error instanceof DeliveryError) throw error;
    throw new DeliveryError(
      "invalid_json",
      "Checkout details could not be read.",
    );
  } finally {
    reader.releaseLock();
  }
}
