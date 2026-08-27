-- INSERT de todas las camisetas existentes para Camisa del 10
-- Ejecuta esto en la consola SQL de Supabase

INSERT INTO jerseys (team, category, price, image_url) VALUES
-- LIGAS - LA LIGA
('Real Madrid', 'ligas', 18900, 'img/madrid/primera real madridplayer.webp'),
('Real Madrid (Segunda)', 'ligas', 18900, 'img/madrid/segunda real madrid player.webp'),
('Barcelona', 'ligas', 18900, 'img/barcelona/primera barca player.webp'),
('Barcelona (Segunda)', 'ligas', 18900, 'img/barcelona/barcelona segunda player.webp'),

-- LIGAS - PREMIER LEAGUE
('Arsenal', 'ligas', 18900, 'img/arsenal/primera arsenal player .webp'),
('Arsenal (Segunda)', 'ligas', 18900, 'img/arsenal/segunda arsenal player .webp'),
('Chelsea', 'ligas', 18900, 'img/chelsea/primera chealsea player .webp'),
('Chelsea (Versión Fan)', 'ligas', 13900, 'img/chelsea/primera chealsea fan .webp'),
('Chelsea (Segunda)', 'ligas', 18900, 'img/chelsea/segunda chealsea fan.webp'),
('Liverpool', 'ligas', 18900, 'img/liverpool/primera liverpool player .webp'),
('Liverpool (Segunda)', 'ligas', 18900, 'img/liverpool/segunda liverpool player.webp'),
('Manchester City', 'ligas', 18900, 'img/city/manchester city primera player.webp'),
('Manchester City (Versión Fan)', 'ligas', 13900, 'img/city/manchester city primera fan.webp'),
('Manchester United', 'ligas', 18900, 'img/united/united primera player.webp'),
('Manchester United (Segunda)', 'ligas', 18900, 'img/united/united segunda player.webp'),
('Manchester United Segunda (Fan)', 'ligas', 13900, 'img/united/united segunda fan.webp'),

-- LIGAS - SERIE A
('Inter Milan', 'ligas', 18900, 'img/inter/primera inter player.webp'),
('Inter Milan (Segunda)', 'ligas', 18900, 'img/inter/segunda inter player .webp'),
('Juventus', 'ligas', 18900, 'img/juventus/primera juventus player.webp'),
('Juventus (Versión Fan)', 'ligas', 13900, 'img/juventus/primera juventus fan.webp'),
('Juventus (Segunda)', 'ligas', 18900, 'img/juventus/segunda juventus player.webp'),
('AC Milan', 'ligas', 13900, 'img/milan/primera milan fan .webp'),
('AC Milan (Segunda)', 'ligas', 18900, 'img/milan/segunda milan fan .webp'),

-- LIGAS - LIGUE 1
('Paris Saint-Germain', 'ligas', 18900, 'img/psg/primera paris player..webp'),
('Paris Saint-Germain (Segunda)', 'ligas', 18900, 'img/psg/segunda paris player.webp'),

-- SELECCIONES
('Argentina', 'selecciones', 18900, 'img/index/ArgIndex.jpeg'),
('Brasil', 'selecciones', 18900, 'img/index/BarIndex.jpeg'),
('Portugal', 'selecciones', 18900, 'img/uniformes/uniforme nino portugal.webp'),

-- RETRO
('Real Madrid Retro', 'retro', 21000, 'img/retro/RealMadridRetro.jpg'),
('Barcelona Retro', 'retro', 21000, 'img/retro/BarcelonaRetro.jpg'),
('Manchester United Retro', 'retro', 21000, 'img/retro/ManchesterUnitedRetro.jpg'),

-- UNIFORMES (Niños)
('Argentina', 'uniformes', 25000, 'img/uniformes/uniforme nino argentina.webp'),
('Barcelona', 'uniformes', 25000, 'img/uniformes/uniforme nino barca.webp'),
('Real Madrid', 'uniformes', 25000, 'img/uniformes/uniforme nino real madrid.webp'),
('Chelsea', 'uniformes', 25000, 'img/uniformes/uniforme nino chelsea.webp'),
('Manchester City', 'uniformes', 25000, 'img/uniformes/uniforme nino manchester city.webp'),
('Manchester United', 'uniformes', 25000, 'img/uniformes/uniforme nino manchester united.webp'),
('Inter Milan', 'uniformes', 25000, 'img/uniformes/uniforme nino inter.webp'),
('AC Milan', 'uniformes', 25000, 'img/uniformes/uniforme nino milan.webp'),
('Portugal', 'uniformes', 25000, 'img/uniformes/uniforme nino portugal.webp'),
('Bayern Munich', 'uniformes', 25000, 'img/uniformes/uniforme nino bayern.webp');
