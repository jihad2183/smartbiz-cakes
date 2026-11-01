import "dotenv/config";

const url = new URL(process.env.LOVABLE_DB_MIGRATION_URL);

console.log("Host:", url.hostname);
console.log("Username:", decodeURIComponent(url.username));
console.log("Port:", url.port);
console.log("Password exists:", !!url.password);
