update public.event_source_configs
set
  city_slug = 'muenchen',
  updated_at = now()
where provider = 'muenchen_de'
  and city_slug = 'muenchen-muenchen';
