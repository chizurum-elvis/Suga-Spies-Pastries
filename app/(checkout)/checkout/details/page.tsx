import { redirect } from "next/navigation";

export default function LegacyDetailsPage() {
  redirect("/checkout#contact");
}
