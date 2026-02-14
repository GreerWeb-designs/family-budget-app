import crypto from "crypto";

const secret = process.env.SESSION_SECRET;
if (!secret) {
  console.error("Missing SESSION_SECRET env var");
  process.exit(1);
}

const password = process.argv[2];
if (!password) {
  console.error("Usage: node hash.mjs <password>");
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(password + secret).digest("hex");
console.log(hash);
