const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../conteiner_beer.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        play_date DATE NOT NULL,
        prize TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ip_play_date ON plays(ip, play_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_play_date ON plays(play_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_prize ON plays(prize)`);
});

module.exports = db;
