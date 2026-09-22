import { Skeleton } from "@/components/ui/skeleton";

export default function AdminMenuLoading() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-label="Loading menu management"
    >
      <Skeleton className="h-24 max-w-2xl" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-lg" />
        ))}
      </div>
      <span className="sr-only">Loading menu management…</span>
    </div>
  );
}
