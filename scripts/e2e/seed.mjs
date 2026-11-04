import { PGlite } from "@electric-sql/pglite";
const db = new PGlite(process.env.DATABASE_URL.slice("pglite://".length));
const users = [
  ["u-admin", "Ada Admin", "admin@acme.com", "admin", "active"],
  ["u-member", "Mo Member", "mo@acme.com", "member", "active"],
  ["u-pending", "Pat Pending", "pat@gmail.com", "member", "pending"],
];
for (const [id, name, email, role, status] of users) {
  await db.query(`insert into "user"(id,name,email,role,status) values($1,$2,$3,$4,$5) on conflict do nothing`, [id, name, email, role, status]);
  await db.query(`insert into session(id,token,user_id,expires_at) values($1,$2,$3, now() + interval '7 days') on conflict do nothing`, ["s-" + id, "tok-" + id, id]);
}
console.log((await db.query(`select email, role, status from "user"`)).rows);
await db.close();
