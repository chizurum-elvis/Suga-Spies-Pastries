import "server-only";

import { unstable_cache } from "next/cache";

import { previewCatalogue } from "@/lib/catalog/preview-data";
import type {
  CatalogueCategory,
  CatalogueImage,
  CatalogueOptionGroup,
  CatalogueProduct,
  CatalogueVariant,
} from "@/lib/catalog/types";
import { getSupabaseConfigurationState } from "@/lib/supabase/config";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const CATALOGUE_CACHE_TAG = "catalogue";
const PRODUCT_IMAGES_BUCKET = "product-images";

type ProductRow = Awaited<
  ReturnType<typeof fetchPublishedRows>
>["products"][number];

function throwDataError(context: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function fetchPublishedRows(productIds?: readonly string[]) {
  const supabase = createPublicSupabaseClient();
  const categoryQuery = supabase
    .from("categories")
    .select("id, name, slug, description, display_order")
    .eq("status", "published")
    .order("display_order")
    .order("name");
  let productQuery = supabase
    .from("products")
    .select(
      "id, category_id, name, slug, short_description, description, base_price_cents, currency, is_starting_price, unit_label, minimum_quantity, quantity_step, maximum_quantity, is_available, ingredients, allergen_information, customer_instructions, display_order",
    )
    .eq("status", "published")
    .order("display_order")
    .order("name");
  if (productIds) {
    productQuery = productQuery.in("id", [...new Set(productIds)]);
  }

  const [categoryResult, productResult] = await Promise.all([
    categoryQuery,
    productQuery,
  ]);

  throwDataError("Could not load catalogue categories", categoryResult.error);
  throwDataError("Could not load catalogue products", productResult.error);

  const products = productResult.data ?? [];
  const visibleProductIds = products.map((product) => product.id);
  if (visibleProductIds.length === 0) {
    return {
      supabase,
      categories: categoryResult.data ?? [],
      products,
      images: [],
      variants: [],
      groups: [],
      values: [],
    };
  }

  const [imageResult, variantResult, groupResult] = await Promise.all([
    supabase
      .from("product_images")
      .select(
        "id, product_id, source_type, path, alt_text, object_position, is_primary, display_order",
      )
      .in("product_id", visibleProductIds)
      .order("is_primary", { ascending: false })
      .order("display_order"),
    supabase
      .from("product_variants")
      .select(
        "id, product_id, name, price_cents, minimum_quantity, quantity_step, maximum_quantity, is_available, is_default, display_order",
      )
      .eq("status", "published")
      .in("product_id", visibleProductIds)
      .order("display_order"),
    supabase
      .from("product_option_groups")
      .select(
        "id, product_id, name, selection_type, is_required, minimum_selections, maximum_selections, display_order",
      )
      .eq("status", "published")
      .in("product_id", visibleProductIds)
      .order("display_order"),
  ]);

  throwDataError("Could not load catalogue images", imageResult.error);
  throwDataError("Could not load catalogue variants", variantResult.error);
  throwDataError("Could not load catalogue option groups", groupResult.error);

  const groups = groupResult.data ?? [];
  const valueResult = groups.length
    ? await supabase
        .from("product_option_values")
        .select(
          "id, option_group_id, name, price_delta_cents, is_available, display_order",
        )
        .eq("status", "published")
        .in(
          "option_group_id",
          groups.map((group) => group.id),
        )
        .order("display_order")
    : { data: [], error: null };
  throwDataError("Could not load catalogue option values", valueResult.error);

  return {
    supabase,
    categories: categoryResult.data ?? [],
    products,
    images: imageResult.data ?? [],
    variants: variantResult.data ?? [],
    groups,
    values: valueResult.data ?? [],
  };
}

function resolveImage(
  row: Awaited<ReturnType<typeof fetchPublishedRows>>["images"][number],
  publicUrlFor: (path: string) => string,
): CatalogueImage {
  return {
    id: row.id,
    src: row.source_type === "local" ? row.path : publicUrlFor(row.path),
    storagePath: row.source_type === "storage" ? row.path : null,
    alt: row.alt_text,
    objectPosition: row.object_position,
    isPrimary: row.is_primary,
  };
}

function buildProduct(
  row: ProductRow,
  category: { id: string; name: string; slug: string },
  rows: Awaited<ReturnType<typeof fetchPublishedRows>>,
): CatalogueProduct {
  const publicUrlFor = (path: string) =>
    rows.supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data
      .publicUrl;
  const valuesByGroup = new Map<string, CatalogueOptionGroup["values"]>();

  for (const value of rows.values) {
    const values = valuesByGroup.get(value.option_group_id) ?? [];
    values.push({
      id: value.id,
      name: value.name,
      priceDeltaCents: value.price_delta_cents,
      isAvailable: value.is_available,
    });
    valuesByGroup.set(value.option_group_id, values);
  }

  const variants: CatalogueVariant[] = rows.variants
    .filter((variant) => variant.product_id === row.id)
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceCents: variant.price_cents,
      minimumQuantity: variant.minimum_quantity,
      quantityStep: variant.quantity_step,
      maximumQuantity: variant.maximum_quantity,
      isAvailable: variant.is_available,
      isDefault: variant.is_default,
    }));

  return {
    id: row.id,
    category,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    basePriceCents: row.base_price_cents,
    currency: row.currency,
    isStartingPrice: row.is_starting_price,
    unitLabel: row.unit_label,
    minimumQuantity: row.minimum_quantity,
    quantityStep: row.quantity_step,
    maximumQuantity: row.maximum_quantity,
    isAvailable: row.is_available,
    ingredients: row.ingredients,
    allergenInformation: row.allergen_information,
    customerInstructions: row.customer_instructions,
    images: rows.images
      .filter((image) => image.product_id === row.id)
      .map((image) => resolveImage(image, publicUrlFor)),
    variants,
    optionGroups: rows.groups
      .filter((group) => group.product_id === row.id)
      .map((group) => ({
        id: group.id,
        name: group.name,
        selectionType: group.selection_type,
        isRequired: group.is_required,
        minimumSelections: group.minimum_selections,
        maximumSelections: group.maximum_selections,
        values: valuesByGroup.get(group.id) ?? [],
      })),
  };
}

async function fetchPublishedCatalogue(): Promise<CatalogueCategory[]> {
  const rows = await fetchPublishedRows();
  return rows.categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    products: rows.products
      .filter((product) => product.category_id === category.id)
      .map((product) =>
        buildProduct(
          product,
          { id: category.id, name: category.name, slug: category.slug },
          rows,
        ),
      ),
  }));
}

const getCachedPublishedCatalogue = unstable_cache(
  fetchPublishedCatalogue,
  ["published-catalogue-v1"],
  { revalidate: 3600, tags: [CATALOGUE_CACHE_TAG] },
);

export async function getPublishedCatalogue() {
  const state = getSupabaseConfigurationState();
  if (state.status === "missing") return previewCatalogue;
  if (state.status === "invalid")
    throw new Error("The Supabase public configuration is invalid.");
  return getCachedPublishedCatalogue();
}

export async function getPublishedProduct(slug: string) {
  const catalogue = await getPublishedCatalogue();
  return (
    catalogue
      .flatMap((category) => category.products)
      .find((product) => product.slug === slug) ?? null
  );
}

export async function getFreshPublishedProducts(productIds: readonly string[]) {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return [];

  const state = getSupabaseConfigurationState();
  if (state.status === "missing") {
    return previewCatalogue
      .flatMap((category) => category.products)
      .filter((product) => uniqueIds.includes(product.id));
  }
  if (state.status === "invalid") {
    throw new Error("The Supabase public configuration is invalid.");
  }

  const rows = await fetchPublishedRows(uniqueIds);
  const categoriesById = new Map(
    rows.categories.map((category) => [category.id, category]),
  );

  return rows.products.flatMap((product) => {
    const category = categoriesById.get(product.category_id);
    return category
      ? [
          buildProduct(
            product,
            { id: category.id, name: category.name, slug: category.slug },
            rows,
          ),
        ]
      : [];
  });
}
