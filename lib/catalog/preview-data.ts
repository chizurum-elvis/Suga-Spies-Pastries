import type { CatalogueCategory, CatalogueProduct } from "@/lib/catalog/types";

type PreviewDefinition = Omit<
  CatalogueProduct,
  "id" | "category" | "currency" | "images" | "variants" | "optionGroups"
> & {
  image: string;
  alt: string;
  objectPosition: string;
  categorySlug: "sweet-bakes" | "savoury-bakes";
};

const definitions: PreviewDefinition[] = [
  {
    slug: "nine-inch-cheesecake",
    name: '9" Cheesecake',
    shortDescription:
      "A rich, creamy nine-inch cheesecake made for celebrations and sharing.",
    description:
      "Smooth and indulgent in a full-size nine-inch format—a beautiful centrepiece for birthdays, gatherings, gifts, and dessert tables.",
    basePriceCents: 4000,
    isStartingPrice: true,
    unitLabel: "each",
    minimumQuantity: 1,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/cheesecake.jpg",
    alt: "Berry-topped cheesecake",
    objectPosition: "54% 68%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "mini-cheesecakes",
    name: '2" Mini Cheesecake',
    shortDescription:
      "Creamy two-inch cheesecakes, perfectly portioned for sharing boxes and dessert tables.",
    description:
      "Small in size and generous in flavour, these individual two-inch cheesecakes make an elegant addition to parties, gifts, and dessert spreads.",
    basePriceCents: 450,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/mini-cheesecakes.jpg",
    alt: "Three berry-topped mini cheesecakes",
    objectPosition: "50% 52%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "chocolate-chunk-cookies",
    name: "Chocolate Chip/Chunk Cookie",
    shortDescription:
      "Golden-edged cookies with soft centres and generous chocolate chips and chunks.",
    description:
      "A bakery favourite with buttery, golden edges, soft centres, and plenty of chocolate in every bite.",
    basePriceCents: 250,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/chocolate-chunk-cookies.jpg",
    alt: "Freshly baked chocolate chunk cookies",
    objectPosition: "50% 50%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "red-velvet-cookies",
    name: "Red Velvet Cookie",
    shortDescription:
      "Soft red velvet cookies with a cocoa-kissed crumb and tender centre.",
    description:
      "A soft-baked cookie with the familiar colour, gentle cocoa character, and rich finish of red velvet.",
    basePriceCents: 300,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/red-velvet-cookies.jpg",
    alt: "Red velvet cookies with white chocolate chips",
    objectPosition: "50% 50%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "scones",
    name: "Scone",
    shortDescription:
      "Golden scones with a tender middle and a delicate, bakery-fresh crumb.",
    description:
      "Tender and freshly baked with lightly golden edges, these scones belong at breakfast tables, gatherings, and relaxed afternoon treats.",
    basePriceCents: 350,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/scones.jpg",
    alt: "Freshly baked fruit scones",
    objectPosition: "62% 50%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "muffins",
    name: "Muffin",
    shortDescription:
      "Soft bakery-style muffins with tall golden tops and a tender crumb.",
    description:
      "A soft, satisfying bakery-style muffin with a generous top—made for breakfast spreads, meetings, gifts, and everyday cravings.",
    basePriceCents: 400,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/muffins.jpg",
    alt: "Freshly baked blueberry muffins",
    objectPosition: "50% 50%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "nine-inch-tart",
    name: '9" Tart',
    shortDescription:
      "A full-size nine-inch tart with crisp pastry and a beautifully finished top.",
    description:
      "An elegant nine-inch tart with a crisp pastry base, sized to make a bright centrepiece for celebrations and shared dessert tables.",
    basePriceCents: 2000,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/fruit-tart.jpg",
    alt: "Colourful fresh fruit tart",
    objectPosition: "50% 36%",
    categorySlug: "sweet-bakes",
  },
  {
    slug: "meat-pies",
    name: "Meat Pie",
    shortDescription:
      "Golden pastry wrapped around a rich, well-seasoned meat filling.",
    description:
      "A hearty savoury bake with a rich, well-seasoned meat filling tucked inside a golden pastry shell.",
    basePriceCents: 350,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/meat-pie.jpg",
    alt: "Crisp meat-filled pastry",
    objectPosition: "49% 39%",
    categorySlug: "savoury-bakes",
  },
  {
    slug: "chicken-pies",
    name: "Chicken Pie",
    shortDescription:
      "Golden pastry filled with tender, well-seasoned chicken.",
    description:
      "A comforting savoury pastry with a tender, well-seasoned chicken filling enclosed in a beautifully golden shell.",
    basePriceCents: 400,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/chicken-pie.jpg",
    alt: "Golden chicken pie",
    objectPosition: "50% 55%",
    categorySlug: "savoury-bakes",
  },
  {
    slug: "sausage-rolls",
    name: "Sausage Roll",
    shortDescription:
      "Seasoned sausage wrapped in crisp, flaky pastry and baked until golden.",
    description:
      "A classic savoury favourite pairing a seasoned sausage centre with crisp, flaky pastry baked to a deep golden finish.",
    basePriceCents: 375,
    isStartingPrice: false,
    unitLabel: "each",
    minimumQuantity: 4,
    quantityStep: 1,
    maximumQuantity: null,
    isAvailable: true,
    ingredients: null,
    allergenInformation: null,
    customerInstructions: null,
    image: "/images/storefront/sausage-rolls.jpg",
    alt: "Freshly baked sausage rolls",
    objectPosition: "50% 50%",
    categorySlug: "savoury-bakes",
  },
];

const categoryDefinitions = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "sweet-bakes",
    name: "Sweet bakes",
    description:
      "Cheesecakes, cookies, tarts, muffins, and other sweet pastries.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "savoury-bakes",
    name: "Savoury bakes",
    description: "Golden pies and savoury pastry favourites.",
  },
] as const;

export const previewCatalogue: CatalogueCategory[] = categoryDefinitions.map(
  (category) => ({
    ...category,
    products: definitions
      .filter((item) => item.categorySlug === category.slug)
      .map(({ image, alt, objectPosition, ...product }, index) => ({
        ...product,
        id: `20000000-0000-4000-8000-${String(index + (category.slug === "sweet-bakes" ? 1 : 8)).padStart(12, "0")}`,
        currency: "CAD" as const,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
        },
        images: [
          {
            id: `${product.slug}-preview`,
            src: image,
            storagePath: null,
            alt,
            objectPosition,
            isPrimary: true,
          },
        ],
        variants: [],
        optionGroups: [],
      })),
  }),
);

export const previewProducts = previewCatalogue.flatMap(
  (category) => category.products,
);
