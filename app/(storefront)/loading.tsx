import { Skeleton } from "@/components/ui/skeleton";

export default function StorefrontLoading() {
  return (
    <div
      className="mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="grid content-center gap-5">
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-16 w-full max-w-xl sm:h-24" />
        <Skeleton className="h-16 w-full max-w-lg" />
        <div className="grid gap-3 min-[28rem]:flex">
          <Skeleton className="h-12 w-full min-[28rem]:w-48" />
          <Skeleton className="h-12 w-full min-[28rem]:w-40" />
        </div>
      </div>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <span className="sr-only">Loading page content…</span>
    </div>
  );
}
