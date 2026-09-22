import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductForm } from "@/components/admin/product-form";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import { ProductOptionsManager } from "@/components/admin/product-options-manager";
import { ProductStateControls } from "@/components/admin/product-state-controls";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  changeProductState,
  changeNestedCatalogueState,
  createOptionGroup,
  createOptionValue,
  createVariant,
  updateProduct,
} from "@/lib/catalog/actions";
import { getAdminCategories, getAdminProduct } from "@/lib/catalog/admin-data";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    getAdminCategories(),
  ]);
  if (!product) notFound();
  return (
    <div className="grid gap-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/menu"
            className="text-ink-soft hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to menu
          </Link>
          <div className="mt-3 flex flex-wrap gap-2">
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
            {query.created === "1" ? (
              <Badge tone="success">Draft created</Badge>
            ) : null}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
            {product.name}
          </h1>
          <p className="text-ink-faint mt-2 text-xs">
            Version {product.version} · /menu/{product.slug}
          </p>
        </div>
        {product.status === "published" ? (
          <Link
            href={`/menu/${product.slug}`}
            target="_blank"
            className={buttonVariants({ variant: "secondary" })}
          >
            Preview public page
            <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ProductForm
          action={updateProduct}
          categories={categories}
          product={product}
        />
        <aside className="grid content-start gap-6 xl:sticky xl:top-24">
          <Card tone="admin" padding="md">
            <h2 className="mb-4 text-lg font-extrabold">
              Publication & availability
            </h2>
            <ProductStateControls
              action={changeProductState}
              productId={product.id}
              status={product.status}
              isAvailable={product.isAvailable}
              version={product.version}
            />
          </Card>
          <Card tone="admin" padding="md">
            <h2 className="text-lg font-extrabold">Before publishing</h2>
            <ul className="text-ink-soft mt-3 grid gap-2 text-sm leading-6">
              <li>• Confirm the price and quantity rule.</li>
              <li>• Add crisp photography and useful alt text.</li>
              <li>• Add only approved flavours and customizations.</li>
              <li>• Confirm allergen wording before launch.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-extrabold">Product photography</h2>
        <p className="text-ink-soft mt-2 text-sm leading-6">
          The first image is used as the primary catalogue image. Uploads are
          owner-only and validated by file size, declared type, and file
          signature.
        </p>
        <div className="mt-6">
          <ProductImagesManager
            images={product.images}
            productId={product.id}
          />
        </div>
      </Card>
      <Card tone="admin" padding="lg">
        <h2 className="text-lg font-extrabold">Purchasable choices</h2>
        <p className="text-ink-soft mt-2 text-sm leading-6">
          These choices appear on the product page now and will become validated
          cart selections in the next slice.
        </p>
        <div className="mt-6">
          <ProductOptionsManager
            productId={product.id}
            variants={product.variants}
            groups={product.optionGroups}
            createVariantAction={createVariant}
            createGroupAction={createOptionGroup}
            createValueAction={createOptionValue}
            changeStateAction={changeNestedCatalogueState}
          />
        </div>
      </Card>
    </div>
  );
}
