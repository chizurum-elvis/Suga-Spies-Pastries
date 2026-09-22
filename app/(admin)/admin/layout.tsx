import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner workspace",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
