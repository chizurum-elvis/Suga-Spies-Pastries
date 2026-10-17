/** A deliberately small search alphabet keeps PostgREST filter syntax out of input. */
export function orderSearchText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length > 0 &&
    text.length <= 120 &&
    /^[\p{L}\p{N} @+._'()\-]+$/u.test(text)
    ? text
    : undefined;
}
export function orderSearchFilter(text: string) {
  if (!orderSearchText(text)) throw new Error("Invalid order search.");
  const pattern = JSON.stringify(`%${text.replaceAll("_", "\\_")}%`);
  const phone = text.replace(/[^0-9+]/g, "");
  return [
    `order_number.ilike.${pattern}`,
    `contact_name.ilike.${pattern}`,
    `contact_email.ilike.${pattern}`,
    ...(phone.length >= 3 ? [`contact_phone.ilike."%${phone}%"`] : []),
  ].join(",");
}
