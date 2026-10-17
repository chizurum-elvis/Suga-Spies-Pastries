import type { ComponentProps } from "react";
import Link from "next/link";

/** Fetch private operational screens when requested, not speculatively for every visible order/menu link. */
export function AdminLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}
