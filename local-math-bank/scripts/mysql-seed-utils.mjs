import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const tableOrder = Object.freeze([
  "schema_metadata", "schema_migrations", "grades", "units", "questions",
  "question_thinking", "question_options", "option_asset_links", "question_assets",
  "concepts", "concept_blocks", "question_concepts", "lecture_assets", "lecture_projects",
  "lecture_project_revisions", "lecture_concept_usages", "lecture_question_usages", "lecture_asset_usages",
]);

export function quoted(name) {
  return `\`${String(name).replaceAll("`", "``")}\``;
}

export function readEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

export async function createMySqlConnection() {
  const env = { ...readEnv(await readFile(path.join(root, ".env.mysql"), "utf8")), ...process.env };
  return mysql.createConnection({
    host: "127.0.0.1",
    port: Number(env.MYSQL_PORT || 3307),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: true,
    charset: "utf8mb4",
  });
}
