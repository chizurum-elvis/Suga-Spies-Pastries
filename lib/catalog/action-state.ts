export type CatalogueField =
  | "name"
  | "slug"
  | "categoryId"
  | "shortDescription"
  | "description"
  | "price"
  | "unitLabel"
  | "minimumQuantity"
  | "quantityStep"
  | "maximumQuantity"
  | "ingredients"
  | "allergenInformation"
  | "customerInstructions"
  | "displayOrder";

export type CatalogueActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Partial<Record<CatalogueField, string>>;
  submissionId?: string;
};

export const initialCatalogueActionState: CatalogueActionState = {
  status: "idle",
};
