const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("prices.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      gold22 REAL,
      gold24 REAL,
      silver REAL
    )
  `);
});

module.exports = db;