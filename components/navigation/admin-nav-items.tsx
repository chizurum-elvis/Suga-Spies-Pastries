"use client";

import { AdminLink as Link } from "@/components/navigation/admin-link";
import { usePathname } from "next/navigation";
import {
  CakeSlice,
  CalendarDays,
  LayoutDashboard,
  PackageOpen,
  Settings2,
  ShoppingBag,
  FilePenLine,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

export const adminNavigationItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/production", label: "Kitchen plan", icon: PackageOpen },
  { href: "/admin/menu", label: "Menu", icon: CakeSlice },
  {
    href: "/admin/availability",
    label: "Delivery calendar",
    icon: CalendarDays,
  },
  { href: "/admin/content", label: "Website content", icon: FilePenLine },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
] as const;

type AdminNavItemsProps = {
  compact?: boolean;
};

export function AdminNavItems({ compact = false }: AdminNavItemsProps) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1.5">
      {adminNavigationItems.map((item) => {
        const Icon = item.icon;
        const itemPath = item.href.split("#")[0];
        const isCurrent =
          itemPath === "/admin"
            ? pathname === "/admin"
            : pathname === itemPath ||
              pathname.startsWith(`${itemPath}/`) ||
              (itemPath === "/admin/orders" &&
                (pathname === "/admin/external-orders" ||
                  pathname.startsWith("/admin/external-orders/"))) ||
              (itemPath === "/admin/settings" &&
                pathname === "/admin/delivery");

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              title={compact ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors",
                compact &&
                  "min-h-14 flex-col justify-center gap-1 px-1 py-2 text-center text-[0.6875rem] leading-4",
                isCurrent
                  ? "bg-brand-soft text-brand-strong"
                  : "text-ink-soft hover:bg-canvas-strong hover:text-ink",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className={compact ? "max-w-full break-words" : undefined}>
                {item.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
