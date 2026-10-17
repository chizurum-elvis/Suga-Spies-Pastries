import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

export const contentKeySchema = z.enum([
  "home",
  "contact",
  "faq",
  "terms",
  "privacy",
  "refund",
]);
export type ContentKey = z.infer<typeof contentKeySchema>;
export type PolicyKey = Extract<ContentKey, "terms" | "privacy" | "refund">;

const prose = (maximum: number) =>
  z.string().trim().min(1, "This field cannot be empty.").max(maximum);

export const homeContentSchema = z.strictObject({
  announcement: z.string().trim().max(160).default(""),
  heroTitle: prose(100),
  heroDescription: prose(350),
  storyTitle: prose(100),
  storyBody: prose(700),
});

export const contactContentSchema = z.strictObject({
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => {
      const number = parsePhoneNumberFromString(value, "CA");
      return number?.country === "CA" && number.isValid();
    }, "Enter a valid Canadian support number."),
  email: z.union([z.email().max(254), z.literal("")]),
});

export const faqContentSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        question: prose(180),
        answer: prose(800),
      }),
    )
    .min(1)
    .max(12)
    .refine(
      (items) =>
        new Set(items.map((item) => item.question.toLocaleLowerCase("en-CA")))
          .size === items.length,
      "Each FAQ question must be different.",
    ),
});

export const policyDraftSchema = z.strictObject({
  title: prose(120),
  body: z.string().trim().max(20000),
});
export const publishablePolicySchema = policyDraftSchema.extend({
  body: prose(20000),
});

export type HomeContent = z.infer<typeof homeContentSchema>;
export type ContactContent = z.infer<typeof contactContentSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type PolicyContent = z.infer<typeof policyDraftSchema>;

export function contentSchemaFor(key: ContentKey) {
  if (key === "home") return homeContentSchema;
  if (key === "contact") return contactContentSchema;
  if (key === "faq") return faqContentSchema;
  return policyDraftSchema;
}

export function contactPhoneHref(phone: string) {
  const number = parsePhoneNumberFromString(phone, "CA");
  if (!number || number.country !== "CA" || !number.isValid())
    throw new Error("Published contact number is invalid.");
  return number.getURI();
}
