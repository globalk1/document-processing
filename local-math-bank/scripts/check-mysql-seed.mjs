import { createMySqlConnection, tableOrder, quoted } from "./mysql-seed-utils.mjs";

const expected = Object.freeze({
  questions: 502,
  concepts: 72,
  lecture_projects: 2,
  lecture_project_revisions: 29,
  lecture_assets: 66,
});
const connection = await createMySqlConnection();
try {
  const counts = {};
  for (const table of tableOrder) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS value FROM ${quoted(table)}`);
    counts[table] = Number(rows[0].value);
  }
  for (const [table, value] of Object.entries(expected)) {
    if (counts[table] !== value) throw new Error(`${table} count must be ${value}, got ${counts[table]}`);
  }
  console.log(JSON.stringify({ status: "passed", counts }, null, 2));
} finally {
  await connection.end();
}
