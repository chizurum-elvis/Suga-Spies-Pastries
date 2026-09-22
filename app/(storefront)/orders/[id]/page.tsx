import type { Metadata } from "next";
import { GuestOrder } from "@/components/checkout/order-confirmation";
export const metadata: Metadata = {
  title: "Your pastry order",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[72rem] px-4 py-8 sm:px-6 lg:py-12">
      <GuestOrder id={id} />
    </div>
  );
}
