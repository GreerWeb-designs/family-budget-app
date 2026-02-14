DELETE FROM users;

INSERT INTO users (id, email, password_hash, created_at)
VALUES
  ('u_bobby',  'robert.g.ducharme@gmail.com',  '67e312fa819e6d20b6bf8e247b324cfbbc5d0d0dff9994b597fafe882dd0b5fa', datetime('now')),
  ('u_rosie', 'rosemarybrooks01@gmail.com', 'bdf88550ec92a44fe7ec830fd212e364c06077dfdcfbbb477052a2c1254ad4ca', datetime('now'));
