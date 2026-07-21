-- Cover-Bilder für die 24 neuen Europa-Roadtrips + JGA-Wochenendtrips:
-- stabile Wikimedia-Commons-Fotos (Direkt-URLs, per HTTP HEAD verifiziert).
-- Idempotent: setzt nur, wo cover_image_url noch null ist.

begin;

update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Cliffs-Of-Moher-OBriens-From-South.JPG/1920px-Cliffs-Of-Moher-OBriens-From-South.JPG', updated_at = now()
  where slug = 'irland-wild-atlantic-way' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/1_lauterbrunnen_valley_wengen_2022.jpg/1920px-1_lauterbrunnen_valley_wengen_2022.jpg', updated_at = now()
  where slug = 'schweiz-alpenpaesse-grand-tour' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/The_walls_of_the_fortress_and_View_of_the_old_city._panorama.jpg/1920px-The_walls_of_the_fortress_and_View_of_the_old_city._panorama.jpg', updated_at = now()
  where slug = 'kroatien-dalmatien-zadar-dubrovnik' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/I_cipressi_della_Val_D%27Orcia.jpg/1920px-I_cipressi_della_Val_D%27Orcia.jpg', updated_at = now()
  where slug = 'toskana-chianti-val-dorcia' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/%CE%9A%CE%B1%CF%83%CF%84%CF%81%CE%BF%CF%80%CE%BF%CE%BB%CE%B9%CF%84%CE%B5%CE%B9%CE%B1_%CE%BC%CE%BF%CE%BD%CE%B5%CE%BC%CE%B2%CE%B1%CF%83%CE%B9%CE%B1%CF%82.jpg/1920px-%CE%9A%CE%B1%CF%83%CF%84%CF%81%CE%BF%CF%80%CE%BF%CE%BB%CE%B9%CF%84%CE%B5%CE%B9%CE%B1_%CE%BC%CE%BF%CE%BD%CE%B5%CE%BC%CE%B2%CE%B1%CF%83%CE%B9%CE%B1%CF%82.jpg', updated_at = now()
  where slug = 'griechenland-peloponnes-antike-meer' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Bileato.jpg/1920px-Bileato.jpg', updated_at = now()
  where slug = 'rumaenien-transfagarasan-siebenbuergen' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Vue_d%27%C3%89tretat.jpg/1920px-Vue_d%27%C3%89tretat.jpg', updated_at = now()
  where slug = 'frankreich-normandie-bretagne' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/14-08-05-barcelona-RalfR-001.jpg/1920px-14-08-05-barcelona-RalfR-001.jpg', updated_at = now()
  where slug = 'barcelona-jga-girls-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/25_De_Abril_Bridge_%28226290561%29.jpeg/1920px-25_De_Abril_Bridge_%28226290561%29.jpeg', updated_at = now()
  where slug = 'lissabon-jga-girls-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/1920px-Tour_Eiffel_Wikimedia_Commons.jpg', updated_at = now()
  where slug = 'paris-jga-girls-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Wien_-_Graben_%283%29.JPG/1920px-Wien_-_Graben_%283%29.JPG', updated_at = now()
  where slug = 'wien-jga-girls-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Altstadt_Z%C3%BCrich_2015.jpg/1920px-Altstadt_Z%C3%BCrich_2015.jpg', updated_at = now()
  where slug = 'zuerich-jga-girls-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Tremezzina_-_Villa_del_Balbianello_-_2024-09-08_16-26-39_007.jpg/1920px-Tremezzina_-_Villa_del_Balbianello_-_2024-09-08_16-26-39_007.jpg', updated_at = now()
  where slug = 'mailand-comersee-jga-girls' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg/1920px-Prague_07-2016_view_from_Lesser_Town_Tower_of_Charles_Bridge_img3.jpg', updated_at = now()
  where slug = 'prag-jga-maenner-klassiker' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Budapest_Sz%C3%A9chenyi_Baths_R02.jpg/1920px-Budapest_Sz%C3%A9chenyi_Baths_R02.jpg', updated_at = now()
  where slug = 'budapest-jga-sparty-ruinbars' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/20200516_Sukiennice_w_Krakowie_0909_9963.jpg/1920px-20200516_Sukiennice_w_Krakowie_0909_9963.jpg', updated_at = now()
  where slug = 'krakau-jga-action-kazimierz' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/KeizersgrachtReguliersgrachtAmsterdam.jpg/1920px-KeizersgrachtReguliersgrachtAmsterdam.jpg', updated_at = now()
  where slug = 'amsterdam-jga-grachten-bier' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/House_of_Blackheads_at_Dusk_3%2C_Riga%2C_Latvia_-_Diliff.jpg/1920px-House_of_Blackheads_at_Dusk_3%2C_Riga%2C_Latvia_-_Diliff.jpg', updated_at = now()
  where slug = 'riga-jga-bobbahn-altstadt' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Kathedrale_von_Palma_II.jpg/1920px-Kathedrale_von_Palma_II.jpg', updated_at = now()
  where slug = 'mallorca-jga-playa-bootsparty' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/%C3%96tztal%2C_Tirol.jpg/1920px-%C3%96tztal%2C_Tirol.jpg', updated_at = now()
  where slug = 'oetztal-area47-jga-action' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Goldswil-Viadukt_Panorama_mit_Interlaken_im_Hintergrund_2.jpg/1920px-Goldswil-Viadukt_Panorama_mit_Interlaken_im_Hintergrund_2.jpg', updated_at = now()
  where slug = 'interlaken-jga-adventure' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Aerial_view_of_the_dunes_and_beach_of_Maspalomas%2C_Canary_Islands_%2852757630746%29.jpg/1920px-Aerial_view_of_the_dunes_and_beach_of_Maspalomas%2C_Canary_Islands_%2852757630746%29.jpg', updated_at = now()
  where slug = 'gran-canaria-jga-pride-maspalomas' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Sitges_-_Ansicht_4.jpg/1920px-Sitges_-_Ansicht_4.jpg', updated_at = now()
  where slug = 'sitges-jga-pride-weekend' and cover_image_url is null;
update public.roadtrip_routes set cover_image_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Windmills_of_Mykonos.jpg/1920px-Windmills_of_Mykonos.jpg', updated_at = now()
  where slug = 'mykonos-jga-pride-weekend' and cover_image_url is null;

commit;
