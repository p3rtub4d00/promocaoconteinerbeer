// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cria o arquivo do banco na raiz do projeto
const dbPath = path.resolve(__dirname, '../conteiner_beer.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Inicialização das Tabelas
db.serialize(() => {
    // Tabela de Jogadas (Antifraude e Analytics)
    db.run(`CREATE TABLE IF NOT EXISTS plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        play_date DATE NOT NULL,
        prize TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de Configurações de Prêmios (Para o Admin alterar)
    db.run(`CREATE TABLE IF NOT EXISTS prizes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        chance INTEGER NOT NULL,
        active BOOLEAN DEFAULT 1
    )`);
});

module.exports = db;
