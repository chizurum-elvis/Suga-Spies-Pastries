export default function FulfillmentLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-border animate-pulse border-b pb-8 motion-reduce:animate-none">
        <div className="bg-canvas-strong h-3 w-20" />
        <div className="bg-canvas-strong mt-4 h-12 w-full max-w-lg" />
        <div className="bg-canvas-strong mt-4 h-4 w-full max-w-md" />
      </div>
      <div className="border-border bg-surface mt-9 h-[34rem] animate-pulse border motion-reduce:animate-none" />
      <p className="sr-only" role="status">
        Loading delivery dates…
      </p>
    </div>
  );
}
