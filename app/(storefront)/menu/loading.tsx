import { Skeleton } from "@/components/ui/skeleton";

export default function MenuLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[78rem] px-4 py-14 sm:px-6 lg:px-8"
      role="status"
      aria-label="Loading pastry menu"
    >
      <Skeleton className="h-14 max-w-lg" />
      <Skeleton className="mt-5 h-14 max-w-2xl" />
      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-7">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton
            key={index}
            className="aspect-[0.72] rounded-lg sm:aspect-[0.82]"
          />
        ))}
      </div>
      <span className="sr-only">Loading pastries…</span>
    </div>
  );
}
