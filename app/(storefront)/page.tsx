import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  PackageCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { CatalogueSection } from "@/components/storefront/catalogue-section";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedCatalogue } from "@/lib/catalog/public-data";
import { BUSINESS_TIME_ZONE } from "@/lib/config/business";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Toronto-made pastries for every sweet plan",
  description:
    "Browse Suga & Spies cheesecakes, cookies, tarts, muffins, pies, and sausage rolls for scheduled delivery in Toronto, Markham, and Mississauga.",
};

const orderingSteps = [
  {
    icon: Sparkles,
    title: "Pick your pastries",
    copy: "Choose from the approved menu, mix eligible flavours, and add decoration or customization details where offered.",
  },
  {
    icon: CalendarDays,
    title: "Choose a delivery date",
    copy: `Select delivery in ${BUSINESS_TIME_ZONE}. Availability follows the notice, closure, and four-order capacity rules.`,
  },
  {
    icon: WalletCards,
    title: "Review and pay",
    copy: "See the full item total and delivery fee before paying securely with Apple Pay or Google Pay.",
  },
] as const;

export default async function HomePage() {
  const categories = await getPublishedCatalogue();
  return (
    <>
      <section className="border-border overflow-hidden border-b">
        <div className="grid w-full lg:grid-cols-2">
          <div className="bg-butter-soft flex min-h-[31rem] items-center justify-center px-5 py-14 text-center sm:min-h-[34rem] sm:px-10 lg:min-h-[clamp(36rem,42vw,43rem)] lg:px-14">
            <div className="mx-auto max-w-[39rem]">
              <p className="text-brand-strong text-[0.68rem] font-bold tracking-[0.16em] uppercase sm:text-xs">
                Toronto-made · local delivery
              </p>
              <h1 className="font-display text-ink mt-5 text-[clamp(2rem,3.5vw,3.25rem)] text-balance">
                Welcome to Suga &amp; Spies Pastries.
              </h1>
              <p className="text-ink-soft mx-auto mt-5 max-w-[30rem] text-base leading-7 text-pretty">
                Cheesecakes, cookies, tarts, muffins, and golden savouries made
                in Toronto for scheduled delivery across Toronto, Markham, and
                Mississauga.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="#menu"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "group rounded-full px-8 text-sm tracking-[0.1em] uppercase",
                  )}
                >
                  Explore the menu
                  <ChevronDown
                    className="size-4 transition-transform group-hover:translate-y-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
              <p className="text-ink-soft mx-auto mt-5 max-w-lg text-xs leading-5 sm:text-sm sm:leading-6">
                Online checkout is not accepting orders yet. The menu and
                ordering experience shown here are being prepared for launch.
              </p>
            </div>
          </div>

          <figure className="bg-canvas-strong relative min-h-[32rem] sm:min-h-[38rem] lg:min-h-[clamp(36rem,42vw,43rem)]">
            <Image
              src="/images/storefront/red-velvet-cookies.jpg"
              alt="Red velvet cookies"
              fill
              loading="eager"
              sizes="(max-width: 1023px) 100vw, 50vw"
              className="object-cover object-center"
            />
            <figcaption className="bg-surface/94 absolute right-5 bottom-5 left-5 px-6 py-7 text-center shadow-[0_18px_50px_rgb(46_32_41_/_14%)] sm:right-10 sm:bottom-10 sm:left-auto sm:w-[min(78%,31rem)] sm:px-10 sm:py-9 lg:right-[8%] lg:bottom-[10%] lg:left-[8%] lg:w-auto">
              <p className="text-brand text-[0.68rem] font-bold tracking-[0.16em] uppercase">
                From the pastry case
              </p>
              <h2 className="font-display text-ink mt-3 text-2xl sm:text-3xl">
                Red velvet cookie
              </h2>
              <p className="text-ink-soft mt-3 text-sm font-semibold sm:text-base">
                $12.00 for 4 · $3.00 each
              </p>
              <Link
                href="/menu/red-velvet-cookies"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-6 rounded-full px-8 text-sm tracking-[0.1em] uppercase",
                )}
              >
                View cookie
              </Link>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="menu" className="bg-canvas py-12 sm:py-16 lg:py-18">
        <div className="mx-auto w-full max-w-[78rem] px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-ink text-2xl text-balance sm:text-3xl">
            Our pastry menu
          </h2>

          <div className="mt-7 sm:mt-9">
            <CatalogueSection
              categories={categories}
              presentation="homepage"
              eagerImageSources={["/images/storefront/red-velvet-cookies.jpg"]}
            />
          </div>
        </div>
      </section>

      <section className="bg-canvas-strong border-border overflow-hidden border-y">
        <div className="mx-auto grid w-full max-w-[86rem] lg:grid-cols-2">
          <div className="border-border grid h-[34rem] grid-cols-2 grid-rows-[1.2fr_0.8fr] overflow-hidden border-b lg:h-auto lg:min-h-[38rem] lg:border-r lg:border-b-0">
            <div className="border-border relative col-span-2 overflow-hidden border-b">
              <Image
                src="/images/storefront/fruit-tart.jpg"
                alt="Colourful fresh fruit tart"
                fill
                sizes="(max-width: 1023px) 100vw, 50vw"
                className="object-cover object-[50%_34%]"
              />
            </div>
            <div className="border-border relative overflow-hidden border-r">
              <Image
                src="/images/storefront/chicken-pie.jpg"
                alt="Golden chicken pie"
                fill
                sizes="(max-width: 1023px) 50vw, 25vw"
                className="object-cover object-[50%_55%]"
              />
              <span className="bg-surface/92 text-ink-soft absolute bottom-3 left-3 rounded-full px-3 py-2 text-[0.65rem] font-bold backdrop-blur">
                Chicken pie
              </span>
            </div>
            <div className="relative overflow-hidden">
              <Image
                src="/images/storefront/sausage-rolls.jpg"
                alt="Freshly baked sausage rolls"
                fill
                sizes="(max-width: 1023px) 50vw, 25vw"
                className="object-cover object-center"
              />
              <span className="bg-surface/92 text-ink-soft absolute right-3 bottom-3 rounded-full px-3 py-2 text-[0.65rem] font-bold backdrop-blur">
                Sausage rolls
              </span>
            </div>
          </div>
          <div className="flex items-center px-4 py-14 sm:px-10 sm:py-18 lg:px-16">
            <div className="max-w-xl">
              <p className="text-brand text-[0.7rem] font-semibold tracking-[0.15em] uppercase">
                Your order, your occasion
              </p>
              <h2 className="font-display text-ink mt-4 text-2xl text-balance sm:text-3xl">
                Thoughtful details belong on the menu.
              </h2>
              <p className="text-ink-soft mt-5 text-base leading-7">
                Cakes, cookies, cupcakes, and non-plain cheesecakes can support
                owner-approved decoration requests. The final product page will
                show exactly what can be changed, any extra cost, and where a
                custom request needs approval.
              </p>
              <div className="border-brand/20 mt-8 grid gap-4 border-t pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-ink text-sm font-semibold">
                    Made for the moment
                  </p>
                  <p className="text-ink-soft mt-1 text-xs leading-5">
                    Birthdays, gatherings, gifts, and everyday cravings.
                  </p>
                </div>
                <div>
                  <p className="text-ink text-sm font-semibold">
                    Approved before payment
                  </p>
                  <p className="text-ink-soft mt-1 text-xs leading-5">
                    Special details stay clear before checkout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ordering" className="border-border bg-surface border-b">
        <div className="mx-auto w-full max-w-[86rem] px-4 py-16 sm:px-6 sm:py-22 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
            <div className="max-w-xl">
              <p className="text-brand text-[0.7rem] font-semibold tracking-[0.15em] uppercase">
                How ordering will work
              </p>
              <h2 className="font-display text-ink mt-4 text-2xl text-balance sm:text-3xl">
                Easy to plan. Clear at every step.
              </h2>
              <p className="text-ink-soft mt-5 text-sm leading-7 sm:text-base">
                Your pastries, delivery address, and charges are reviewed before
                payment and confirmed by email.
              </p>
            </div>

            <ol className="border-border divide-border divide-y border-y">
              {orderingSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="grid gap-4 py-6 sm:grid-cols-[3rem_1fr] sm:gap-6 sm:py-7"
                  >
                    <div className="flex items-center gap-3 sm:block">
                      <span className="bg-brand grid size-10 place-items-center rounded-full text-white">
                        <Icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <span className="text-brand text-xs font-semibold sm:mt-3 sm:block sm:text-center">
                        0{index + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-ink text-lg font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-ink-soft mt-2 max-w-2xl text-sm leading-6">
                        {step.copy}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section id="service" className="bg-canvas py-16 sm:py-22">
        <div className="mx-auto grid w-full max-w-[86rem] gap-6 px-4 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:px-8">
          <article className="bg-brand-soft rounded-[1.75rem] px-6 py-9 sm:px-10 sm:py-12">
            <div className="max-w-xl">
              <MapPin className="text-brand size-6" aria-hidden="true" />
              <p className="text-brand mt-7 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
                Scheduled delivery
              </p>
              <h2 className="font-display mt-3 text-2xl sm:text-3xl">
                Toronto, Markham & Mississauga
              </h2>
              <p className="text-ink-soft mt-4 text-sm leading-7 sm:text-base">
                Delivery will be available within the approved distance from the
                business. The delivery-pricing formula is still provisional, so
                it is not displayed as a final promise on this page.
              </p>
            </div>
          </article>

          <article className="bg-canvas-strong rounded-[1.75rem] px-6 py-9 sm:px-10 sm:py-12">
            <PackageCheck className="text-brand size-6" aria-hidden="true" />
            <p className="text-brand mt-7 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
              From our oven to your door
            </p>
            <h2 className="font-display mt-3 text-2xl sm:text-3xl">
              Your pastries, delivered with care
            </h2>
            <p className="text-ink-soft mt-4 text-sm leading-7 sm:text-base">
              Choose your delivery date. Add your address at checkout to check
              availability and see your delivery fee.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
