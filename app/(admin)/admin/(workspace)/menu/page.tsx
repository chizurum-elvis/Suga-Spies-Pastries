import Image from "next/image";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal } from "lucide-react";

import { CategoryForm } from "@/components/admin/category-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { StatePanel } from "@/components/ui/state-panel";
import { createCategory } from "@/lib/catalog/actions";
import {
  getAdminCategories,
  getAdminProductSummaries,
} from "@/lib/catalog/admin-data";
import { formatCents } from "@/lib/catalog/presentation";
import { cn } from "@/lib/utils/cn";

type MenuAdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    availability?: string;
  }>;
};

export default async function MenuAdminPage({
  searchParams,
}: MenuAdminPageProps) {
  const [products, categories, query] = await Promise.all([
    getAdminProductSummaries(),
    getAdminCategories(),
    searchParams,
  ]);
  const term = query.q?.trim().toLowerCase() ?? "";
  const filtered = products.filter(
    (product) =>
      (!term ||
        product.name.toLowerCase().includes(term) ||
        product.slug.includes(term)) &&
      (!query.status || product.status === query.status) &&
      (!query.category || product.categoryName === query.category) &&
      (!query.availability ||
        (query.availability === "available"
          ? product.isAvailable
          : !product.isAvailable)),
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="accent">Catalogue</Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            Menu management
          </h1>
          <p className="text-ink-soft mt-3 max-w-2xl text-sm leading-6">
            Manage the pastry details customers see. Publication and
            availability remain separate so a sold-out pastry can stay visible.
          </p>
        </div>
        <Link href="/admin/menu/new" className={buttonVariants({ size: "lg" })}>
          <Plus className="size-4" aria-hidden="true" />
          Create product
        </Link>
      </header>

      <Card tone="admin" padding="md">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,0.35fr))_auto]"
          action="/admin/menu"
        >
          <label className="relative">
            <span className="sr-only">Search products</span>
            <Search
              className="text-ink-faint pointer-events-none absolute top-3.5 left-3.5 size-4"
              aria-hidden="true"
            />
            <Input
              name="q"
              defaultValue={query.q}
              placeholder="Search name or slug"
              className="pl-10"
            />
          </label>
          <label>
            <span className="sr-only">Filter status</span>
            <Select name="status" defaultValue={query.status ?? ""}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Filter category</span>
            <Select name="category" defaultValue={query.category ?? ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id}>{category.name}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Filter availability</span>
            <Select name="availability" defaultValue={query.availability ?? ""}>
              <option value="">Any availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </Select>
          </label>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "secondary" }), "px-4")}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Apply
          </button>
        </form>
      </Card>

      {filtered.length ? (
        <section aria-labelledby="products-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="products-heading" className="text-lg font-extrabold">
              Products
            </h2>
            <p className="text-ink-faint text-sm">
              {filtered.length} of {products.length}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((product) => (
              <Link
                key={product.id}
                href={`/admin/menu/${product.id}`}
                className="border-border hover:border-brand/35 focus-visible:outline-brand group grid min-w-0 grid-cols-[5.5rem_1fr] overflow-hidden rounded-lg border bg-white transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 sm:grid-cols-[8rem_1fr]"
              >
                <div className="bg-canvas-strong relative min-h-28">
                  {product.primaryImage ? (
                    <Image
                      src={product.primaryImage.src}
                      alt={product.primaryImage.alt}
                      fill
                      sizes="128px"
                      style={{
                        objectPosition: product.primaryImage.objectPosition,
                      }}
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-ink-faint grid size-full place-items-center px-2 text-center text-xs font-bold">
                      No image
                    </div>
                  )}
                </div>
                <div className="min-w-0 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      tone={
                        product.status === "published"
                          ? "success"
                          : product.status === "draft"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {product.status}
                    </Badge>
                    <Badge tone={product.isAvailable ? "success" : "warning"}>
                      {product.isAvailable ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <h3 className="text-ink group-hover:text-brand mt-3 truncate font-extrabold">
                    {product.name}
                  </h3>
                  <p className="text-brand-strong mt-1 text-sm font-bold">
                    {formatCents(product.basePriceCents)}
                  </p>
                  <p className="text-ink-faint mt-2 truncate text-xs">
                    {product.categoryName} · /{product.slug}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <StatePanel
          tone="empty"
          title={
            products.length
              ? "No products match these filters"
              : "No products yet"
          }
          description={
            products.length
              ? "Clear or change the filters to see more menu items."
              : "Create the first draft product, add a photo, then preview and publish it."
          }
          action={
            <Link href="/admin/menu/new" className={buttonVariants()}>
              Create product
            </Link>
          }
        />
      )}

      <section aria-labelledby="categories-heading">
        <Card tone="admin" padding="lg">
          <h2 id="categories-heading" className="text-lg font-extrabold">
            Categories
          </h2>
          <p className="text-ink-soft mt-2 text-sm leading-6">
            Add a grouping before assigning products to it. Existing category
            slugs remain stable for navigation.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge key={category.id}>{category.name}</Badge>
            ))}
          </div>
          <div className="border-border mt-6 border-t pt-6">
            <CategoryForm action={createCategory} />
          </div>
        </Card>
      </section>
    </div>
  );
}
