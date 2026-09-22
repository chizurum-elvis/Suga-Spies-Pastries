import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatMinimumOrderPrice,
  formatUnitPrice,
} from "@/lib/catalog/presentation";
import type { CatalogueProduct } from "@/lib/catalog/types";
import { cn } from "@/lib/utils/cn";

type ProductCardProps = {
  product: CatalogueProduct;
  presentation?: "standard" | "homepage";
  eagerImage?: boolean;
};

export function ProductCard({
  product,
  presentation = "standard",
  eagerImage = false,
}: ProductCardProps) {
  const image = product.images[0];
  const isHomepage = presentation === "homepage";

  return (
    <Link
      href={`/menu/${product.slug}`}
      className={cn(
        "border-border bg-surface-raised focus-visible:outline-brand group hover:border-brand/35 relative flex min-w-0 flex-col overflow-hidden border transition-[transform,box-shadow,border-color] duration-300 focus-visible:outline-3 focus-visible:outline-offset-3 motion-reduce:transform-none",
        isHomepage
          ? "rounded-[0.25rem] shadow-[0_10px_30px_rgb(46_32_41_/_5%)] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgb(46_32_41_/_10%)]"
          : "rounded-[0.7rem] shadow-[0_12px_35px_rgb(46_32_41_/_6%)] hover:-translate-y-1 hover:shadow-[0_20px_45px_rgb(46_32_41_/_11%)] sm:rounded-[0.9rem]",
      )}
      data-product-slug={product.slug}
      aria-label={`View ${product.name}`}
    >
      <div className="bg-canvas-strong relative aspect-square overflow-hidden lg:aspect-[4/3]">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            loading={eagerImage ? "eager" : "lazy"}
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 33vw"
            style={{ objectPosition: image.objectPosition }}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transform-none"
          />
        ) : (
          <div className="from-brand-soft to-butter-soft grid size-full place-items-center bg-gradient-to-br px-4 text-center">
            <span className="text-brand-strong text-xs font-semibold tracking-[0.08em] uppercase">
              Photo coming soon
            </span>
          </div>
        )}
        {!product.isAvailable ? (
          <Badge
            tone="warning"
            className="absolute top-2 left-2 sm:top-3 sm:left-3"
          >
            Temporarily unavailable
          </Badge>
        ) : null}
        {isHomepage ? (
          <span
            className="bg-brand absolute right-3 bottom-3 grid size-11 place-items-center rounded-full text-white shadow-[0_8px_22px_rgb(46_32_41_/_18%)] transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          >
            <ArrowRight className="size-5" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col items-center px-2.5 py-4 text-center sm:px-5 sm:py-5 lg:px-7 lg:py-6">
        <h3
          className={cn(
            "text-ink flex items-center justify-center",
            isHomepage
              ? "font-display min-h-12 text-sm sm:min-h-14 sm:text-base lg:text-lg"
              : "min-h-[3.25rem] text-[0.76rem] leading-[1.4] font-semibold tracking-[0.015em] sm:min-h-14 sm:text-[0.95rem] lg:min-h-15 lg:text-base",
          )}
        >
          {product.name}
        </h3>
        <p
          className={cn(
            isHomepage
              ? "mt-2 text-xs leading-5 font-normal sm:text-sm"
              : "mt-2 text-[0.72rem] leading-5 font-semibold sm:mt-3 sm:text-sm lg:text-[0.95rem]",
            product.isAvailable ? "text-brand-strong" : "text-ink-faint",
          )}
        >
          {formatMinimumOrderPrice(product)}
        </p>
        {product.minimumQuantity > 1 ? (
          <p className="text-ink-soft mt-0.5 text-[0.64rem] leading-4 font-semibold sm:mt-1 sm:text-xs">
            {formatUnitPrice(product)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
