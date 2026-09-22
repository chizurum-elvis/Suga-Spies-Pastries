export type CatalogueStatus = "draft" | "published" | "archived";

export type CatalogueImage = {
  id: string;
  src: string;
  storagePath: string | null;
  alt: string;
  objectPosition: string;
  isPrimary: boolean;
};

export type CatalogueVariant = {
  id: string;
  name: string;
  priceCents: number | null;
  minimumQuantity: number | null;
  quantityStep: number | null;
  maximumQuantity: number | null;
  isAvailable: boolean;
  isDefault: boolean;
  status?: CatalogueStatus;
};

export type CatalogueOptionValue = {
  id: string;
  name: string;
  priceDeltaCents: number;
  isAvailable: boolean;
  status?: CatalogueStatus;
};

export type CatalogueOptionGroup = {
  id: string;
  name: string;
  selectionType: "single" | "multiple" | "quantity";
  isRequired: boolean;
  minimumSelections: number;
  maximumSelections: number | null;
  values: CatalogueOptionValue[];
  status?: CatalogueStatus;
};

export type CatalogueProduct = {
  id: string;
  category: { id: string; name: string; slug: string };
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePriceCents: number;
  currency: "CAD";
  isStartingPrice: boolean;
  unitLabel: string | null;
  minimumQuantity: number;
  quantityStep: number;
  maximumQuantity: number | null;
  isAvailable: boolean;
  ingredients: string | null;
  allergenInformation: string | null;
  customerInstructions: string | null;
  images: CatalogueImage[];
  variants: CatalogueVariant[];
  optionGroups: CatalogueOptionGroup[];
};

export type CatalogueCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  products: CatalogueProduct[];
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  status: CatalogueStatus;
  displayOrder: number;
};

export type AdminProductSummary = {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  basePriceCents: number;
  status: CatalogueStatus;
  isAvailable: boolean;
  displayOrder: number;
  version: number;
  primaryImage: CatalogueImage | null;
};

export type AdminProduct = AdminProductSummary & {
  categoryId: string;
  shortDescription: string | null;
  description: string | null;
  isStartingPrice: boolean;
  unitLabel: string | null;
  minimumQuantity: number;
  quantityStep: number;
  maximumQuantity: number | null;
  ingredients: string | null;
  allergenInformation: string | null;
  customerInstructions: string | null;
  publishedAt: string | null;
  images: CatalogueImage[];
  variants: CatalogueVariant[];
  optionGroups: CatalogueOptionGroup[];
};
