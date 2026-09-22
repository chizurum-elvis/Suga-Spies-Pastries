import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import type { CatalogueCategory } from "@/lib/catalog/types";

type CatalogueSectionProps = {
  categories: CatalogueCategory[];
  condensed?: boolean;
  presentation?: "standard" | "homepage";
  eagerImageSources?: readonly string[];
};

export function CatalogueSection({
  categories,
  condensed = false,
  presentation = "standard",
  eagerImageSources = [],
}: CatalogueSectionProps) {
  const isHomepage = presentation === "homepage";
  const visibleCategories = categories.filter(
    (category) => category.products.length > 0,
  );
  const count = visibleCategories.reduce(
    (total, category) => total + category.products.length,
    0,
  );

  if (count === 0) {
    return (
      <StatePanel
        tone="empty"
        title="The pastry case is being refreshed"
        description="No pastries are published right now. Please check back soon or contact Suga & Spies for help."
        action={
          <a
            href="tel:+14373327263"
            className={buttonVariants({ variant: "secondary" })}
          >
            Contact us
          </a>
        }
      />
    );
  }

  return (
    <div id="full-menu">
      {!isHomepage ? (
        <nav aria-label="Menu categories">
          <p className="text-ink-faint mb-3 text-[0.68rem] font-semibold tracking-[0.1em] uppercase">
            Browse by category
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((category, index) => (
              <a
                key={category.id}
                href={`#${category.slug}`}
                className={
                  index === 0
                    ? "border-brand bg-brand text-surface inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold"
                    : "border-border bg-surface-raised text-ink hover:border-brand/35 hover:text-brand-strong inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
                }
              >
                {category.name}
                <span
                  className={
                    index === 0
                      ? "bg-surface/18 rounded-full px-2 py-0.5 text-xs"
                      : "bg-sage text-sage-ink rounded-full px-2 py-0.5 text-xs"
                  }
                >
                  {category.products.length}
                </span>
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {visibleCategories.map((category, index) => (
        <section
          key={category.id}
          id={category.slug}
          className={
            isHomepage
              ? index === 0
                ? "mt-6 sm:mt-8"
                : "mt-12 sm:mt-16"
              : index === 0
                ? "mt-10 sm:mt-12"
                : "mt-14 sm:mt-18"
          }
          aria-labelledby={`${category.slug}-heading`}
        >
          <div
            className={
              isHomepage
                ? "border-border mb-4 border-b pb-3 sm:mb-6"
                : "border-border mb-5 flex items-end justify-between gap-4 border-b pb-4 sm:mb-7"
            }
          >
            <h3
              id={`${category.slug}-heading`}
              className={
                isHomepage
                  ? "font-display text-ink text-xl sm:text-2xl"
                  : "text-ink flex items-center gap-3 text-sm font-semibold tracking-[0.12em] uppercase sm:text-base"
              }
            >
              {!isHomepage ? (
                <span
                  className={
                    index === 0
                      ? "bg-berry size-2 rounded-full"
                      : "bg-sage-ink size-2 rounded-full"
                  }
                  aria-hidden="true"
                />
              ) : null}
              {category.name}
            </h3>
            {!isHomepage ? (
              <p className="text-ink-faint text-xs font-bold">
                {category.products.length}{" "}
                {category.products.length === 1 ? "choice" : "choices"}
              </p>
            ) : null}
          </div>
          <div
            className={
              isHomepage
                ? "grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-6 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-11"
                : "grid grid-cols-2 gap-x-2.5 gap-y-5 min-[360px]:gap-x-3 sm:gap-5 lg:grid-cols-3 lg:gap-x-7 lg:gap-y-10"
            }
          >
            {category.products.map((product, productIndex) => (
              <ProductCard
                key={product.id}
                product={product}
                presentation={presentation}
                eagerImage={
                  (!isHomepage && index === 0 && productIndex === 0) ||
                  product.images.some((image) =>
                    eagerImageSources.includes(image.src),
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}

      {condensed ? (
        <div className="mt-10 flex justify-center">
          <Link
            href="/menu"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            See the complete menu
          </Link>
        </div>
      ) : null}
    </div>
  );
}
