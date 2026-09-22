import type { Metadata } from "next";

import { CatalogueSection } from "@/components/storefront/catalogue-section";
import { getPublishedCatalogue } from "@/lib/catalog/public-data";

export const metadata: Metadata = {
  title: "Pastry menu",
  description:
    "Browse Suga & Spies cheesecakes, cookies, tarts, muffins, pies, and sausage rolls in Canadian dollars.",
};

export default async function MenuPage() {
  const categories = await getPublishedCatalogue();

  return (
    <div className="bg-canvas min-h-full py-12 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="text-brand text-[0.7rem] font-semibold tracking-[0.15em] uppercase">
            Baked in Toronto
          </p>
          <h1 className="font-display text-ink mt-3 text-3xl text-balance sm:text-4xl">
            The pastry menu
          </h1>
          <p className="text-ink-soft mt-5 max-w-2xl text-base leading-7">
            Open a pastry to see its full details, quantity rules, availability,
            and any owner-approved options. Prices are shown in Canadian
            dollars.
          </p>
        </header>
        <div className="mt-10 sm:mt-14">
          <CatalogueSection categories={categories} />
        </div>
      </div>
    </div>
  );
}
