"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import type {
  CatalogueActionState,
  CatalogueField,
} from "@/lib/catalog/action-state";
import { CATALOGUE_CACHE_TAG } from "@/lib/catalog/public-data";
import {
  catalogueStatusSchema,
  categoryFormSchema,
  formBoolean,
  optionGroupFormSchema,
  optionValueFormSchema,
  nestedCatalogueStateSchema,
  productFormSchema,
  variantFormSchema,
} from "@/lib/catalog/validation";
import { resolveOwnerAccess } from "@/lib/auth/owner-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function state(
  status: "error" | "success",
  message: string,
  errors?: Partial<Record<CatalogueField, string>>,
): CatalogueActionState {
  return { status, message, errors, submissionId: randomUUID() };
}

function firstErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([key, values]) =>
      values?.[0] ? [[key, values[0]]] : [],
    ),
  ) as Partial<Record<CatalogueField, string>>;
}

async function authorizedClient() {
  const supabase = await createServerSupabaseClient();
  const access = await resolveOwnerAccess(supabase);
  if (access.status !== "authorized") return null;
  return supabase;
}

function refreshCatalogue(productId?: string) {
  updateTag(CATALOGUE_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/admin/menu");
  if (productId) revalidatePath(`/admin/menu/${productId}`);
}

function productInput(formData: FormData) {
  return {
    id: formData.get("id") ?? undefined,
    version: formData.get("version") ?? undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    price: formData.get("price"),
    isStartingPrice: formBoolean(formData, "isStartingPrice"),
    unitLabel: formData.get("unitLabel"),
    minimumQuantity: formData.get("minimumQuantity"),
    quantityStep: formData.get("quantityStep"),
    maximumQuantity: formData.get("maximumQuantity"),
    ingredients: formData.get("ingredients"),
    allergenInformation: formData.get("allergenInformation"),
    customerInstructions: formData.get("customerInstructions"),
    displayOrder: formData.get("displayOrder"),
  };
}

function toDatabaseProduct(data: ReturnType<typeof productFormSchema.parse>) {
  return {
    category_id: data.categoryId,
    name: data.name,
    slug: data.slug,
    short_description: data.shortDescription,
    description: data.description,
    base_price_cents: data.price,
    is_starting_price: data.isStartingPrice,
    unit_label: data.unitLabel,
    minimum_quantity: data.minimumQuantity,
    quantity_step: data.quantityStep,
    maximum_quantity: data.maximumQuantity,
    ingredients: data.ingredients,
    allergen_information: data.allergenInformation,
    customer_instructions: data.customerInstructions,
    display_order: data.displayOrder,
  };
}

function safeDatabaseMessage(code: string | undefined) {
  if (code === "23505")
    return "That URL slug is already used by another product.";
  if (code === "23503") return "Choose an active category and try again.";
  if (code === "23514")
    return "One of the values is outside the allowed range.";
  return "The menu change could not be saved. Please try again.";
}

export async function createProduct(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = productFormSchema.safeParse(productInput(formData));
  if (!validation.success)
    return state(
      "error",
      "Check the highlighted product details.",
      firstErrors(validation.error.flatten().fieldErrors),
    );

  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const category = await supabase
    .from("categories")
    .select("id")
    .eq("id", validation.data.categoryId)
    .neq("status", "archived")
    .maybeSingle();
  if (category.error || !category.data) {
    return state("error", "Choose an active category and try again.");
  }
  const result = await supabase
    .from("products")
    .insert({
      ...toDatabaseProduct(validation.data),
      status: "draft",
      is_available: false,
    })
    .select("id")
    .single();
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  refreshCatalogue(result.data.id);
  redirect(`/admin/menu/${result.data.id}?created=1`);
}

export async function updateProduct(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = productFormSchema.safeParse(productInput(formData));
  if (!validation.success || !validation.data.id || !validation.data.version) {
    return state(
      "error",
      "Check the highlighted product details.",
      validation.success
        ? undefined
        : firstErrors(validation.error.flatten().fieldErrors),
    );
  }
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const category = await supabase
    .from("categories")
    .select("id")
    .eq("id", validation.data.categoryId)
    .neq("status", "archived")
    .maybeSingle();
  if (category.error || !category.data) {
    return state("error", "Choose an active category and try again.");
  }
  const result = await supabase
    .from("products")
    .update(toDatabaseProduct(validation.data))
    .eq("id", validation.data.id)
    .eq("version", validation.data.version)
    .select("id")
    .maybeSingle();
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  if (!result.data)
    return state(
      "error",
      "This product changed in another tab. Refresh the page before trying again.",
    );
  refreshCatalogue(validation.data.id);
  return state("success", "Product details saved.");
}

export async function changeProductState(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = catalogueStatusSchema.safeParse({
    productId: formData.get("productId"),
    version: formData.get("version"),
    intent: formData.get("intent"),
  });
  if (!validation.success)
    return state("error", "The requested product change is invalid.");
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );

  const { productId, version, intent } = validation.data;
  if (intent === "publish") {
    const productResult = await supabase
      .from("products")
      .select("category_id")
      .eq("id", productId)
      .maybeSingle();
    if (productResult.error || !productResult.data) {
      return state("error", "The product could not be verified.");
    }
    const categoryResult = await supabase
      .from("categories")
      .select("id")
      .eq("id", productResult.data.category_id)
      .eq("status", "published")
      .maybeSingle();
    if (categoryResult.error || !categoryResult.data) {
      return state(
        "error",
        "Publish the product category before publishing this product.",
      );
    }
    const imageResult = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (imageResult.error)
      return state("error", "The product images could not be verified.");
    if (!imageResult.count)
      return state(
        "error",
        "Add at least one product image before publishing.",
      );
  }
  const updates =
    intent === "publish"
      ? { status: "published" as const }
      : intent === "unpublish"
        ? { status: "draft" as const }
        : intent === "archive"
          ? { status: "archived" as const, is_available: false }
          : intent === "make_available"
            ? { is_available: true }
            : { is_available: false };

  let updateQuery = supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("version", version);
  if (intent === "make_available") {
    updateQuery = updateQuery.eq("status", "published");
  }
  const result = await updateQuery.select("id").maybeSingle();
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  if (!result.data)
    return state(
      "error",
      "This product changed in another tab. Refresh before trying again.",
    );
  refreshCatalogue(productId);
  return state(
    "success",
    intent === "archive" ? "Product archived." : "Product state updated.",
  );
}

export async function createCategory(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = categoryFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    displayOrder: formData.get("displayOrder"),
  });
  if (!validation.success)
    return state(
      "error",
      "Enter a category name, a lowercase URL slug, and a valid display order.",
    );
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await supabase.from("categories").insert({
    name: validation.data.name,
    slug: validation.data.slug,
    display_order: validation.data.displayOrder,
    status: "published",
  });
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  refreshCatalogue();
  return state("success", "Category added.");
}

export async function createVariant(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = variantFormSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    price: formData.get("price"),
    minimumQuantity: formData.get("minimumQuantity"),
    quantityStep: formData.get("quantityStep"),
    maximumQuantity: formData.get("maximumQuantity"),
  });
  if (!validation.success)
    return state("error", "Enter a variant name and an optional valid price.");
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await supabase.from("product_variants").insert({
    product_id: validation.data.productId,
    name: validation.data.name,
    price_cents: validation.data.price,
    minimum_quantity: validation.data.minimumQuantity,
    quantity_step: validation.data.quantityStep,
    maximum_quantity: validation.data.maximumQuantity,
    status: "published",
    is_available: true,
  });
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  refreshCatalogue(validation.data.productId);
  return state("success", "Variant added.");
}

export async function createOptionGroup(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = optionGroupFormSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    selectionType: formData.get("selectionType"),
    isRequired: formBoolean(formData, "isRequired"),
  });
  if (!validation.success)
    return state(
      "error",
      "Enter a valid option-group name and selection type.",
    );
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const result = await supabase.from("product_option_groups").insert({
    product_id: validation.data.productId,
    name: validation.data.name,
    selection_type: validation.data.selectionType,
    is_required: validation.data.isRequired,
    minimum_selections: validation.data.isRequired ? 1 : 0,
    maximum_selections: validation.data.selectionType === "single" ? 1 : null,
    status: "published",
  });
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  refreshCatalogue(validation.data.productId);
  return state("success", "Option group added.");
}

export async function createOptionValue(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = optionValueFormSchema.safeParse({
    optionGroupId: formData.get("optionGroupId"),
    name: formData.get("name"),
    price: formData.get("price"),
  });
  if (!validation.success)
    return state(
      "error",
      "Choose an option group and enter a valid choice and additional price.",
    );
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const group = await supabase
    .from("product_option_groups")
    .select("product_id")
    .eq("id", validation.data.optionGroupId)
    .maybeSingle();
  if (group.error || !group.data)
    return state("error", "The option group could not be verified.");
  const result = await supabase.from("product_option_values").insert({
    option_group_id: validation.data.optionGroupId,
    name: validation.data.name,
    price_delta_cents: validation.data.price,
    status: "published",
    is_available: true,
  });
  if (result.error)
    return state("error", safeDatabaseMessage(result.error.code));
  refreshCatalogue(group.data.product_id);
  return state("success", "Option choice added.");
}

export async function changeNestedCatalogueState(
  _previous: CatalogueActionState,
  formData: FormData,
): Promise<CatalogueActionState> {
  const validation = nestedCatalogueStateSchema.safeParse({
    productId: formData.get("productId"),
    itemId: formData.get("itemId"),
    itemType: formData.get("itemType"),
    intent: formData.get("intent"),
  });
  if (!validation.success)
    return state("error", "The requested choice change is invalid.");
  const supabase = await authorizedClient();
  if (!supabase)
    return state(
      "error",
      "Your owner session is no longer valid. Sign in again.",
    );
  const { itemId, itemType, intent, productId } = validation.data;

  if (itemType === "variant") {
    const result = await supabase
      .from("product_variants")
      .update(
        intent === "archive"
          ? { status: "archived", is_available: false }
          : { is_available: intent === "make_available" },
      )
      .eq("id", itemId)
      .eq("product_id", productId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      return state("error", "The variant could not be updated.");
  } else if (itemType === "option_group") {
    if (intent !== "archive")
      return state("error", "Option groups can only be archived.");
    const result = await supabase
      .from("product_option_groups")
      .update({ status: "archived" })
      .eq("id", itemId)
      .eq("product_id", productId)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      return state("error", "The option group could not be archived.");
  } else {
    const groupResult = await supabase
      .from("product_option_groups")
      .select("id")
      .eq("product_id", productId);
    if (groupResult.error)
      return state("error", "The option choice could not be verified.");
    const groupIds = (groupResult.data ?? []).map((group) => group.id);
    if (groupIds.length === 0)
      return state("error", "The option choice could not be verified.");
    const result = await supabase
      .from("product_option_values")
      .update(
        intent === "archive"
          ? { status: "archived", is_available: false }
          : { is_available: intent === "make_available" },
      )
      .eq("id", itemId)
      .in("option_group_id", groupIds)
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      return state("error", "The option choice could not be updated.");
  }
  refreshCatalogue(productId);
  return state(
    "success",
    intent === "archive" ? "Choice archived." : "Choice availability updated.",
  );
}
