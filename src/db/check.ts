import { pool } from "./client.js";

const res = await pool.query("select now()");
console.log(res.rows[0]);
await pool.end();
