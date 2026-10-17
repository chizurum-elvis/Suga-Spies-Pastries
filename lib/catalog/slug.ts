/** Suggest a readable address; the server still validates and enforces uniqueness. */
export function suggestCatalogueSlug(name: string, maximum = 120) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximum)
    .replace(/-+$/g, "");
}
