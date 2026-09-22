-- Owner identities are deliberately not seeded. Create the owner in Supabase
-- Auth, then provision the matching user_id by following
-- docs/admin-authentication.md.

insert into public.categories (
  id,
  name,
  slug,
  description,
  status,
  display_order
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Sweet bakes',
    'sweet-bakes',
    'Cheesecakes, cookies, tarts, muffins, and other sweet pastries.',
    'published',
    10
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Savoury bakes',
    'savoury-bakes',
    'Golden pies and savoury pastry favourites.',
    'published',
    20
  );

insert into public.products (
  id,
  category_id,
  name,
  slug,
  short_description,
  description,
  base_price_cents,
  is_starting_price,
  unit_label,
  minimum_quantity,
  quantity_step,
  status,
  is_available,
  display_order
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '9" Cheesecake',
    'nine-inch-cheesecake',
    'A rich, creamy nine-inch cheesecake made for celebrations and sharing.',
    'Smooth and indulgent in a full-size nine-inch format—a beautiful centrepiece for birthdays, gatherings, gifts, and dessert tables.',
    4000,
    true,
    'each',
    1,
    1,
    'published',
    true,
    10
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '2" Mini Cheesecake',
    'mini-cheesecakes',
    'Creamy two-inch cheesecakes, perfectly portioned for sharing boxes and dessert tables.',
    'Small in size and generous in flavour, these individual two-inch cheesecakes make an elegant addition to parties, gifts, and dessert spreads.',
    450,
    false,
    'each',
    4,
    1,
    'published',
    true,
    20
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Chocolate Chip/Chunk Cookie',
    'chocolate-chunk-cookies',
    'Golden-edged cookies with soft centres and generous chocolate chips and chunks.',
    'A bakery favourite with buttery, golden edges, soft centres, and plenty of chocolate in every bite.',
    250,
    false,
    'each',
    4,
    1,
    'published',
    true,
    30
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'Red Velvet Cookie',
    'red-velvet-cookies',
    'Soft red velvet cookies with a cocoa-kissed crumb and tender centre.',
    'A soft-baked cookie with the familiar colour, gentle cocoa character, and rich finish of red velvet.',
    300,
    false,
    'each',
    4,
    1,
    'published',
    true,
    40
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'Scone',
    'scones',
    'Golden scones with a tender middle and a delicate, bakery-fresh crumb.',
    'Tender and freshly baked with lightly golden edges, these scones belong at breakfast tables, gatherings, and relaxed afternoon treats.',
    350,
    false,
    'each',
    4,
    1,
    'published',
    true,
    50
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'Muffin',
    'muffins',
    'Soft bakery-style muffins with tall golden tops and a tender crumb.',
    'A soft, satisfying bakery-style muffin with a generous top—made for breakfast spreads, meetings, gifts, and everyday cravings.',
    400,
    false,
    'each',
    4,
    1,
    'published',
    true,
    60
  ),
  (
    '20000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '9" Tart',
    'nine-inch-tart',
    'A full-size nine-inch tart with crisp pastry and a beautifully finished top.',
    'An elegant nine-inch tart with a crisp pastry base, sized to make a bright centrepiece for celebrations and shared dessert tables.',
    2000,
    false,
    'each',
    4,
    1,
    'published',
    true,
    70
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000002',
    'Meat Pie',
    'meat-pies',
    'Golden pastry wrapped around a rich, well-seasoned meat filling.',
    'A hearty savoury bake with a rich, well-seasoned meat filling tucked inside a golden pastry shell.',
    350,
    false,
    'each',
    4,
    1,
    'published',
    true,
    10
  ),
  (
    '20000000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000002',
    'Chicken Pie',
    'chicken-pies',
    'Golden pastry filled with tender, well-seasoned chicken.',
    'A comforting savoury pastry with a tender, well-seasoned chicken filling enclosed in a beautifully golden shell.',
    400,
    false,
    'each',
    4,
    1,
    'published',
    true,
    20
  ),
  (
    '20000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000002',
    'Sausage Roll',
    'sausage-rolls',
    'Seasoned sausage wrapped in crisp, flaky pastry and baked until golden.',
    'A classic savoury favourite pairing a seasoned sausage centre with crisp, flaky pastry baked to a deep golden finish.',
    375,
    false,
    'each',
    4,
    1,
    'published',
    true,
    30
  );

insert into public.product_images (
  product_id,
  source_type,
  path,
  alt_text,
  object_position,
  is_primary,
  display_order
)
values
  ('20000000-0000-4000-8000-000000000001', 'local', '/images/storefront/cheesecake.jpg', 'Berry-topped cheesecake', '54% 68%', true, 10),
  ('20000000-0000-4000-8000-000000000002', 'local', '/images/storefront/mini-cheesecakes.jpg', 'Three berry-topped mini cheesecakes', '50% 52%', true, 10),
  ('20000000-0000-4000-8000-000000000003', 'local', '/images/storefront/chocolate-chunk-cookies.jpg', 'Freshly baked chocolate chunk cookies', '50% 50%', true, 10),
  ('20000000-0000-4000-8000-000000000004', 'local', '/images/storefront/red-velvet-cookies.jpg', 'Red velvet cookies with white chocolate chips', '50% 50%', true, 10),
  ('20000000-0000-4000-8000-000000000005', 'local', '/images/storefront/scones.jpg', 'Freshly baked fruit scones', '62% 50%', true, 10),
  ('20000000-0000-4000-8000-000000000006', 'local', '/images/storefront/muffins.jpg', 'Freshly baked blueberry muffins', '50% 50%', true, 10),
  ('20000000-0000-4000-8000-000000000007', 'local', '/images/storefront/fruit-tart.jpg', 'Colourful fresh fruit tart', '50% 36%', true, 10),
  ('20000000-0000-4000-8000-000000000008', 'local', '/images/storefront/meat-pie.jpg', 'Crisp meat-filled pastry', '49% 39%', true, 10),
  ('20000000-0000-4000-8000-000000000009', 'local', '/images/storefront/chicken-pie.jpg', 'Golden chicken pie', '50% 55%', true, 10),
  ('20000000-0000-4000-8000-000000000010', 'local', '/images/storefront/sausage-rolls.jpg', 'Freshly baked sausage rolls', '50% 50%', true, 10);
