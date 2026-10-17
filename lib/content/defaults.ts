import type {
  ContactContent,
  FaqContent,
  HomeContent,
} from "@/lib/content/schema";

// Kept only as a local-development / pre-migration fallback. The database is authoritative.
export const defaultHomeContent: HomeContent = {
  announcement: "",
  heroTitle: "Welcome to Suga & Spies Pastries.",
  heroDescription:
    "Cheesecakes, cookies, tarts, muffins, and golden savouries made in Toronto for scheduled delivery across Toronto, Markham, and Mississauga.",
  storyTitle: "Thoughtful details belong on the menu.",
  storyBody:
    "Some pastries offer flavours or decorations. Choose from the options shown on each product page and see any added cost before checkout. For a request that is not listed, contact us before ordering.",
};

export const defaultContactContent: ContactContent = {
  phone: "+1 (437) 332-7263",
  email: "",
};

export const defaultFaqContent: FaqContent = {
  items: [
    {
      question: "How far ahead should I order?",
      answer:
        "Choose a delivery date at least four Toronto calendar days ahead, and no more than two calendar months ahead. Available dates are shown during checkout.",
    },
    {
      question: "Where do you deliver?",
      answer:
        "We deliver to eligible addresses in Toronto, Markham, and Mississauga. Enter your address at checkout to confirm eligibility and see the delivery fee before paying. Pickup is not available.",
    },
    {
      question: "How many pastries do I need to order?",
      answer:
        "Most items start at four pieces per box, and you can add one piece at a time after that. A regular cheesecake can be ordered on its own. Each product page shows its exact minimum.",
    },
    {
      question: "When is delivery free?",
      answer:
        "Delivery is free when your pastries and paid customizations total at least $100 before the delivery fee. Your address must still be within the delivery area.",
    },
    {
      question: "How can I pay?",
      answer:
        "Pay securely by credit or debit card. Apple Pay and Google Pay are available on supported devices and browsers.",
    },
    {
      question: "Can I cancel my order?",
      answer:
        "You can cancel for a full refund before the deadline shown at checkout, provided preparation has not started. The deadline is midnight Toronto time on the day before delivery. Check your order page for eligibility and refund progress.",
    },
  ],
};
