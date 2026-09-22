alter table public.product_images
  drop constraint product_images_path_check;

alter table public.product_images
  add constraint product_images_path_check
  check (
    char_length(path) between 3 and 500
    and path !~ '\.\.'
    and (
      (
        source_type = 'local'
        and path ~ '^/images/[A-Za-z0-9/_-]+\.(?:avif|jpe?g|png|webp)$'
      )
      or
      (
        source_type = 'storage'
        and path ~ '^[A-Za-z0-9/_-]+\.(?:avif|jpe?g|png|webp)$'
      )
    )
  );

comment on constraint product_images_path_check on public.product_images is
  'Allows supported local or storage image paths and rejects path traversal.';
