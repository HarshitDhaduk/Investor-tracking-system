import pg from "pg";
import { CONFIG } from "./flavour.js";

const { Pool } = pg;

const POOL = new Pool({
    host: CONFIG.DB.host,
    user: CONFIG.DB.user,
    password: CONFIG.DB.password,
    database: CONFIG.DB.database,
    port: process.env.DB_PORT || 5432,
    max: CONFIG.DB.connectionLimit,
});

export { POOL };

