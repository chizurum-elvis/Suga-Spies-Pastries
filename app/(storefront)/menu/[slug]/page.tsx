import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Info, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { ProductConfigurator } from "@/components/storefront/product-configurator";
import { Badge } from "@/components/ui/badge";
import {
  formatMinimumOrderPrice,
  formatQuantityRule,
  formatUnitPrice,
} from "@/lib/catalog/presentation";
import { getPublishedProduct } from "@/lib/catalog/public-data";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "Pastry not found" };
  return {
    title: product.name,
    description:
      product.shortDescription ??
      product.description ??
      `View ${product.name} from Suga & Spies.`,
    openGraph: product.images[0]
      ? { images: [{ url: product.images[0].src, alt: product.images[0].alt }] }
      : undefined,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) notFound();
  const image = product.images[0];

  return (
    <div className="bg-canvas min-h-full">
      <div className="mx-auto w-full max-w-[86rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <Link
          href="/menu"
          className="text-ink-soft hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to menu
        </Link>
        <div className="mt-4 grid gap-9 lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)] lg:gap-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div
              data-product-hero
              className="bg-butter-soft relative aspect-square overflow-hidden rounded-[1.5rem] sm:rounded-[2rem]"
            >
              {image ? (
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  loading="eager"
                  sizes="(max-width: 1023px) 100vw, 55vw"
                  style={{ objectPosition: image.objectPosition }}
                  className="object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center">
                  <span className="text-brand-strong font-semibold">
                    Photo coming soon
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="lg:py-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{product.category.name}</Badge>
              {product.isAvailable ? (
                <Badge tone="success">Available</Badge>
              ) : (
                <Badge tone="warning">Temporarily unavailable</Badge>
              )}
            </div>
            <h1 className="font-display text-ink mt-5 text-3xl text-balance sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-brand-strong mt-5 text-lg font-semibold">
              {formatMinimumOrderPrice(product)}
            </p>
            <p className="text-ink-soft mt-1 text-sm font-semibold">
              {formatUnitPrice(product)}
            </p>
            <p className="text-ink-soft mt-2 text-sm font-bold">
              {formatQuantityRule(product)}
            </p>
            {product.description ? (
              <p className="text-ink-soft mt-7 text-base leading-8">
                {product.description}
              </p>
            ) : null}

            <div className="mt-8">
              <ProductConfigurator product={product} />
            </div>

            <div className="border-border mt-8 grid gap-6 border-t pt-7">
              <div className="flex gap-3">
                <MapPin
                  className="text-brand mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold">Scheduled delivery</h2>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    The complete checkout will ask for a delivery date and an
                    eligible Toronto-area delivery address.
                  </p>
                </div>
              </div>
              {product.ingredients ? (
                <div>
                  <h2 className="font-semibold">Ingredients</h2>
                  <p className="text-ink-soft mt-2 text-sm leading-6">
                    {product.ingredients}
                  </p>
                </div>
              ) : null}
              <div className="flex gap-3">
                <AlertTriangle
                  className="text-warning-ink mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold">Allergen information</h2>
                  <p className="text-ink-soft mt-1 text-sm leading-6">
                    {product.allergenInformation ??
                      "Final ingredient, allergen, and cross-contact information has not yet been approved for this item. Contact the business before ordering if you have an allergy."}
                  </p>
                </div>
              </div>
              {product.customerInstructions ? (
                <div className="flex gap-3">
                  <Info
                    className="text-info-ink mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h2 className="font-semibold">Good to know</h2>
                    <p className="text-ink-soft mt-1 text-sm leading-6">
                      {product.customerInstructions}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
