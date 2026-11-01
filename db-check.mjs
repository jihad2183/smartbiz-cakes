import "dotenv/config";
import postgres from "postgres";

const sql = postgres(
  process.env.LOVABLE_DB_MIGRATION_URL,
  { ssl: "require" }
);

try {
  const connection = await sql.unsafe(
    "SELECT current_database() AS database, current_user AS db_user, current_schema() AS schema"
  );

  console.log("CONNECTION:", connection);

  const tables = await sql.unsafe(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema IN ('public', 'drizzle') ORDER BY table_schema, table_name"
  );

  console.log("TABLES:", tables);

} catch (error) {
  console.log("ERROR:", error.message);
} finally {
  await sql.end();
}