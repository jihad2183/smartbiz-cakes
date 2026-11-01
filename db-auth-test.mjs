import postgres from "postgres";

const sql = postgres({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  username: "postgres.ccsokgjfrjrslqouhwcz",
  password: process.env.DB_PASSWORD,
  ssl: "require",
});

try {
  const result = await sql`
    SELECT current_database() AS database,
           current_user AS db_user
  `;

  console.log("SUCCESS:", result);
} catch (error) {
  console.log("DATABASE ERROR:", error.message);
} finally {
  await sql.end();
}