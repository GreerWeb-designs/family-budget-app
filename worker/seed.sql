DELETE FROM users;

INSERT INTO users (id, email, password_hash, created_at)
VALUES
  ('u_bobby',  'robert.g.ducharme@gmail.com',  'ed7d030f3488e33e3a6354c1155607c5337662afc0e09c9f44056e9f91125f00', datetime('now')),
  ('u_rosie', 'rosemarybrooks01@gmail.com', 'bdf88550ec92a44fe7ec830fd212e364c06077dfdcfbbb477052a2c1254ad4ca', datetime('now'));
