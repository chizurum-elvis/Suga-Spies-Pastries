import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminCategory,
  AdminProduct,
  AdminProductSummary,
  CatalogueImage,
  CatalogueOptionGroup,
  CatalogueVariant,
} from "@/lib/catalog/types";
import type { Database } from "@/lib/supabase/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PRODUCT_IMAGES_BUCKET = "product-images";

function requireData<T>(
  data: T | null,
  error: { message: string } | null,
  context: string,
): T {
  if (error) throw new Error(`${context}: ${error.message}`);
  if (data === null) throw new Error(`${context}: no data returned.`);
  return data;
}

function mapImage(
  supabase: SupabaseClient<Database>,
  image: Database["public"]["Tables"]["product_images"]["Row"],
): CatalogueImage {
  return {
    id: image.id,
    src:
      image.source_type === "local"
        ? image.path
        : supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(image.path)
            .data.publicUrl,
    storagePath: image.source_type === "storage" ? image.path : null,
    alt: image.alt_text,
    objectPosition: image.object_position,
    isPrimary: image.is_primary,
  };
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("categories")
    .select("id, name, slug, status, display_order")
    .neq("status", "archived")
    .order("display_order")
    .order("name");
  return requireData(
    result.data,
    result.error,
    "Could not load categories",
  ).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    status: category.status,
    displayOrder: category.display_order,
  }));
}

export async function getAdminProductSummaries(): Promise<
  AdminProductSummary[]
> {
  const supabase = await createServerSupabaseClient();
  const [productResult, categoryResult, imageResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, category_id, name, slug, base_price_cents, status, is_available, display_order, version",
      )
      .order("display_order")
      .order("name"),
    supabase.from("categories").select("id, name"),
    supabase
      .from("product_images")
      .select(
        "id, product_id, source_type, path, alt_text, object_position, width, height, is_primary, display_order, created_at, updated_at",
      )
      .eq("is_primary", true),
  ]);
  const products = requireData(
    productResult.data,
    productResult.error,
    "Could not load products",
  );
  const categories = requireData(
    categoryResult.data,
    categoryResult.error,
    "Could not load product categories",
  );
  const images = requireData(
    imageResult.data,
    imageResult.error,
    "Could not load product images",
  );
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return products.map((product) => {
    const image = images.find(
      (candidate) => candidate.product_id === product.id,
    );
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryName: categoryNames.get(product.category_id) ?? "Uncategorised",
      basePriceCents: product.base_price_cents,
      status: product.status,
      isAvailable: product.is_available,
      displayOrder: product.display_order,
      version: product.version,
      primaryImage: image ? mapImage(supabase, image) : null,
    };
  });
}

export async function getAdminProduct(
  id: string,
): Promise<AdminProduct | null> {
  const supabase = await createServerSupabaseClient();
  const [
    productResult,
    categoryResult,
    imageResult,
    variantResult,
    groupResult,
    valueResult,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name"),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("is_primary", { ascending: false })
      .order("display_order"),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("display_order"),
    supabase
      .from("product_option_groups")
      .select("*")
      .eq("product_id", id)
      .order("display_order"),
    supabase.from("product_option_values").select("*").order("display_order"),
  ]);
  if (productResult.error)
    throw new Error(`Could not load product: ${productResult.error.message}`);
  if (!productResult.data) return null;
  const product = productResult.data;
  const categories = requireData(
    categoryResult.data,
    categoryResult.error,
    "Could not load categories",
  );
  const images = requireData(
    imageResult.data,
    imageResult.error,
    "Could not load images",
  );
  const variants = requireData(
    variantResult.data,
    variantResult.error,
    "Could not load variants",
  );
  const groups = requireData(
    groupResult.data,
    groupResult.error,
    "Could not load option groups",
  );
  const values = requireData(
    valueResult.data,
    valueResult.error,
    "Could not load option values",
  );
  const categoryName =
    categories.find((category) => category.id === product.category_id)?.name ??
    "Uncategorised";

  const mappedVariants: CatalogueVariant[] = variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    priceCents: variant.price_cents,
    minimumQuantity: variant.minimum_quantity,
    quantityStep: variant.quantity_step,
    maximumQuantity: variant.maximum_quantity,
    isAvailable: variant.is_available,
    isDefault: variant.is_default,
    status: variant.status,
  }));
  const mappedGroups: CatalogueOptionGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    selectionType: group.selection_type,
    isRequired: group.is_required,
    minimumSelections: group.minimum_selections,
    maximumSelections: group.maximum_selections,
    status: group.status,
    values: values
      .filter((value) => value.option_group_id === group.id)
      .map((value) => ({
        id: value.id,
        name: value.name,
        priceDeltaCents: value.price_delta_cents,
        isAvailable: value.is_available,
        status: value.status,
      })),
  }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    categoryId: product.category_id,
    categoryName,
    shortDescription: product.short_description,
    description: product.description,
    basePriceCents: product.base_price_cents,
    isStartingPrice: product.is_starting_price,
    unitLabel: product.unit_label,
    minimumQuantity: product.minimum_quantity,
    quantityStep: product.quantity_step,
    maximumQuantity: product.maximum_quantity,
    status: product.status,
    isAvailable: product.is_available,
    ingredients: product.ingredients,
    allergenInformation: product.allergen_information,
    customerInstructions: product.customer_instructions,
    displayOrder: product.display_order,
    version: product.version,
    publishedAt: product.published_at,
    primaryImage: images[0] ? mapImage(supabase, images[0]) : null,
    images: images.map((image) => mapImage(supabase, image)),
    variants: mappedVariants,
    optionGroups: mappedGroups,
  };
}
