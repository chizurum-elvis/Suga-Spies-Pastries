export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-[82rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-border animate-pulse border-b pb-8 motion-reduce:animate-none">
        <div className="bg-canvas-strong h-3 w-28" />
        <div className="bg-canvas-strong mt-4 h-12 w-full max-w-md" />
        <div className="bg-canvas-strong mt-4 h-4 w-full max-w-lg" />
      </div>
      <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          {[1, 2].map((item) => (
            <div key={item} className="border-border border-b pb-8">
              <div className="bg-canvas-strong h-8 w-48" />
              <div className="bg-canvas-strong mt-5 h-64 w-full" />
            </div>
          ))}
        </div>
        <div className="border-border bg-surface hidden h-96 border lg:block" />
      </div>
      <p className="sr-only" role="status">
        Loading checkout…
      </p>
    </div>
  );
}
