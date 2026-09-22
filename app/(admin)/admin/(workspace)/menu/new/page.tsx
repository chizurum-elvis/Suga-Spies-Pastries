import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/admin/product-form";
import { Badge } from "@/components/ui/badge";
import { createProduct } from "@/lib/catalog/actions";
import { getAdminCategories } from "@/lib/catalog/admin-data";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return (
    <div className="grid gap-7">
      <header>
        <Link
          href="/admin/menu"
          className="text-ink-soft hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to menu
        </Link>
        <div className="mt-3">
          <Badge tone="info">New draft</Badge>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Create a pastry
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6">
            Start with accurate essentials. After saving, add photography and
            options, preview the page, and publish it.
          </p>
        </div>
      </header>
      {categories.length ? (
        <ProductForm action={createProduct} categories={categories} />
      ) : (
        <div className="border-warning-ink/20 bg-warning text-warning-ink rounded-lg border p-6">
          <h2 className="font-extrabold">A category is required first</h2>
          <p className="mt-2 text-sm">
            Return to Menu management and add a category before creating a
            product.
          </p>
        </div>
      )}
    </div>
  );
}
