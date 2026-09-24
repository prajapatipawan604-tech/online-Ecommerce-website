const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT)
});

pool.on("connect", () => {
    console.log("Connected to PostgreSQL");
});

pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
});

async function testDatabase() {
    try {
        const result = await pool.query("SELECT NOW()");
        console.log("Database connected:", result.rows[0]);
    } catch (error) {
        console.error("Database connection failed:");
        console.error(error.message);
    }
}

testDatabase();

module.exports = pool;