-- Cover-Bilder für die 8 Küsten-Roadtrips: stabile Wikimedia-Commons-Fotos der
-- tatsächlichen Orte (Direkt-URLs auf upload.wikimedia.org, per HTTP verifiziert).
-- Idempotent: setzt nur, wo cover_image_url noch null ist.

begin;

update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Positano-Amalfi_Coast-Italy.jpg/1920px-Positano-Amalfi_Coast-Italy.jpg', updated_at = now()
  where slug = 'italien-amalfi-cilento-kueste' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/View_of_Kotor_bay_and_old_town.jpg/1920px-View_of_Kotor_bay_and_old_town.jpg', updated_at = now()
  where slug = 'adria-istrien-kotor' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Gaztelugatxe_-_Bermeo%2C_Spain_-_July_20%2C_2024.jpg/1920px-Gaztelugatxe_-_Bermeo%2C_Spain_-_July_20%2C_2024.jpg', updated_at = now()
  where slug = 'spanien-gruener-norden-atlantik' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cima_de_la_duna%2C_Playa_de_Bolonia%2C_C%C3%A1diz%2C_Espa%C3%B1a%2C_2015.JPG/1920px-Cima_de_la_duna%2C_Playa_de_Bolonia%2C_C%C3%A1diz%2C_Espa%C3%B1a%2C_2015.JPG', updated_at = now()
  where slug = 'spanien-andalusien-costa-de-la-luz' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/133F_Lac_de_Sainte-Croix_%2816018157991%29.jpg/1920px-133F_Lac_de_Sainte-Croix_%2816018157991%29.jpg', updated_at = now()
  where slug = 'frankreich-provence-cote-dazur' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Praia_da_Marinha_%282012-09-27%29%2C_by_Klugschnacker_in_Wikipedia_%2812%29.JPG/1920px-Praia_da_Marinha_%282012-09-27%29%2C_by_Klugschnacker_in_Wikipedia_%2812%29.JPG', updated_at = now()
  where slug = 'portugal-lissabon-algarve' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Kreidefelsen_R%C3%BCgen_in_spring.jpg/1920px-Kreidefelsen_R%C3%BCgen_in_spring.jpg', updated_at = now()
  where slug = 'ostsee-ruegen-usedom' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Wydma_Lancka%2C_Slowi%C5%84ski_Park_Narodowy_01.jpg/1920px-Wydma_Lancka%2C_Slowi%C5%84ski_Park_Narodowy_01.jpg', updated_at = now()
  where slug = 'polnische-ostsee-wanderduenen' and cover_image_url is null;

commit;
