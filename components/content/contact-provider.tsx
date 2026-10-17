"use client";

import { createContext, useContext, type ReactNode } from "react";

import { defaultContactContent } from "@/lib/content/defaults";
import type { ContactContent } from "@/lib/content/schema";

type PublicContact = ContactContent & { phoneHref: string };
const ContactContext = createContext<PublicContact>({
  ...defaultContactContent,
  phoneHref: `tel:${defaultContactContent.phone.replace(/[^+\d]/g, "")}`,
});

export function ContactProvider({
  contact,
  children,
}: {
  contact: PublicContact;
  children: ReactNode;
}) {
  return <ContactContext value={contact}>{children}</ContactContext>;
}

export function usePublicContact() {
  return useContext(ContactContext);
}
