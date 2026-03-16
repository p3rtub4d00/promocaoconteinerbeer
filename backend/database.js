const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../conteiner_beer.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
    }
});

function ensurePlayerIdColumn(callback) {
    db.all('PRAGMA table_info(plays)', [], (err, rows) => {
        if (err) {
            return callback(err);
        }

        const hasPlayerId = rows.some((r) => r.name === 'player_id');
        if (hasPlayerId) {
            return callback();
        }

        return db.run('ALTER TABLE plays ADD COLUMN player_id TEXT', (alterErr) => callback(alterErr));
    });
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        player_id TEXT,
        play_date DATE NOT NULL,
        prize TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (createErr) => {
        if (createErr) {
            console.error('Erro ao criar tabela plays:', createErr.message);
            return;
        }

        ensurePlayerIdColumn((columnErr) => {
            if (columnErr) {
                console.error('Erro ao garantir coluna player_id:', columnErr.message);
                return;
            }

            db.run('DROP INDEX IF EXISTS idx_unique_ip_play_date');
            db.run('CREATE INDEX IF NOT EXISTS idx_play_date ON plays(play_date)');
            db.run('CREATE INDEX IF NOT EXISTS idx_prize ON plays(prize)');
            db.run('CREATE INDEX IF NOT EXISTS idx_player_date ON plays(player_id, play_date)');
            db.run('CREATE INDEX IF NOT EXISTS idx_player_created_at ON plays(player_id, created_at)');
        });
    });
});

module.exports = db;
