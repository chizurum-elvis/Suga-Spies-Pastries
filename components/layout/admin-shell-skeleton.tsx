import { BrandMark } from "@/components/brand/brand-mark";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Verifying owner workspace"
      className="text-ink min-h-dvh bg-[#f7f4ef]"
    >
      <header className="border-border bg-surface-raised flex min-h-16 items-center justify-between border-b px-4 md:hidden">
        <div className="grid gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="size-11 rounded-md" />
      </header>

      <aside className="border-border bg-surface-raised fixed inset-y-0 left-0 hidden w-20 border-r px-3 py-5 md:block xl:w-72 xl:px-5">
        <BrandMark compact className="xl:hidden" />
        <div className="hidden xl:block">
          <BrandMark />
        </div>
        <div className="mt-10 grid gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full rounded-md" />
          ))}
        </div>
      </aside>

      <main className="min-w-0 md:pl-20 xl:pl-72">
        <div className="mx-auto grid w-full max-w-[100rem] gap-8 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
          <div className="grid gap-3">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-12 w-full max-w-2xl" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      </main>
      <span className="sr-only">Verifying owner session and workspace…</span>
    </div>
  );
}
