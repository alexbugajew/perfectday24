alter table public.vendor_quotes
  alter column token set default replace(
    replace(
      replace(encode(gen_random_bytes(18), 'base64'), '+', '-'),
      '/',
      '_'
    ),
    '=',
    ''
  );
