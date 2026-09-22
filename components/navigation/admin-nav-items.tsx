"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CakeSlice,
  CalendarDays,
  LayoutDashboard,
  PackageOpen,
  Settings2,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";

export const adminNavigationItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Menu", icon: CakeSlice },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin#production", label: "Production", icon: PackageOpen },
  { href: "/admin/availability", label: "Availability", icon: CalendarDays },
  { href: "/admin/delivery", label: "Delivery pricing", icon: Truck },
  { href: "/admin#settings", label: "Business settings", icon: Settings2 },
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
            : pathname.startsWith(itemPath);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              title={compact ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors",
                compact && "justify-center px-0",
                isCurrent
                  ? "bg-brand-soft text-brand-strong"
                  : "text-ink-soft hover:bg-canvas-strong hover:text-ink",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {compact ? (
                <span className="sr-only">{item.label}</span>
              ) : (
                item.label
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
