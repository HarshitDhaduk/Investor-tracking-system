import { POOL } from "../config/database.js";

// Base Repository — generic database operations for PostgreSQL.
class BaseRepository {
    constructor() {
        this.db = POOL;
    }

    // Helper to convert MySQL "?" placeholders to PostgreSQL "$1, $2" format.
    _formatQuery(query) {
        let index = 1;
        return query.replace(/\?/g, () => `$${index++}`);
    }

    // Execute an INSERT query and return the insertId (requires RETURNING id).
    async insert(query, params = []) {
        try {
            const pgQuery = this._formatQuery(query);
            // Append RETURNING id if not present for inserts
            const finalQuery = pgQuery.toLowerCase().includes("returning") ? pgQuery : `${pgQuery} RETURNING id`;
            const { rows } = await this.db.query(finalQuery, params);
            return rows[0]?.id;
        } catch (err) {
            console.error("DB Insert Error:", err.message);
            throw err;
        }
    }

    // Execute a SELECT query and return the first row.
    async selectOne(query, params = []) {
        try {
            const pgQuery = this._formatQuery(query);
            const { rows } = await this.db.query(pgQuery, params);
            return rows[0] || null;
        } catch (err) {
            console.error("DB SelectOne Error:", err.message);
            throw err;
        }
    }

    // Execute a SELECT query and return all rows.
    async select(query, params = []) {
        try {
            const pgQuery = this._formatQuery(query);
            const { rows } = await this.db.query(pgQuery, params);
            return rows || [];
        } catch (err) {
            console.error("DB Select Error:", err.message);
            throw err;
        }
    }

    // Execute an UPDATE query.
    async update(query, params = []) {
        try {
            const pgQuery = this._formatQuery(query);
            const { rowCount } = await this.db.query(pgQuery, params);
            return rowCount >= 0;
        } catch (err) {
            console.error("DB Update Error:", err.message);
            throw err;
        }
    }

    // Execute a DELETE query.
    async delete(query, params = []) {
        try {
            const pgQuery = this._formatQuery(query);
            const { rowCount } = await this.db.query(pgQuery, params);
            return rowCount >= 0;
        } catch (err) {
            console.error("DB Delete Error:", err.message);
            throw err;
        }
    }

    // PostgreSQL transactions
    async beginTransaction() {
        await this.db.query("BEGIN");
    }

    async commit() {
        await this.db.query("COMMIT");
    }

    async rollback() {
        await this.db.query("ROLLBACK");
    }
}

export { BaseRepository };
