import { readFile } from "node:fs/promises";
import path from "node:path";
import { createMySqlConnection, root, tableOrder, quoted } from "./mysql-seed-utils.mjs";

const seedPath = path.join(root, "seeds", "local-question-bank-mysql-v1.json");
const schemaPath = path.join(root, "mysql", "schema.sql");
const seed = JSON.parse(await readFile(seedPath, "utf8"));
if (seed.format !== "local_question_bank_mysql_seed_v1") throw new Error("不支援的 MySQL seed 格式。");
const connection = await createMySqlConnection();
try {
  await connection.query(await readFile(schemaPath, "utf8"));
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of [...tableOrder].reverse()) await connection.query(`DELETE FROM ${quoted(table)}`);
  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  await connection.beginTransaction();
  for (const table of tableOrder) {
    const rows = Array.isArray(seed.tables?.[table]) ? seed.tables[table] : [];
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const sql = `INSERT INTO ${quoted(table)} (${columns.map(quoted).join(", ")}) VALUES ?`;
    for (let index = 0; index < rows.length; index += 200) {
      await connection.query(sql, [rows.slice(index, index + 200).map((row) => columns.map((column) => row[column]))]);
    }
  }
  await connection.commit();
  console.log(JSON.stringify({ status: "imported", source: path.relative(root, seedPath).replaceAll("\\", "/") }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
