// backend/server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve os arquivos do frontend

// Configuração simplificada de Banco de Dados na Memória/Arquivo
const db = new sqlite3.Database('./conteiner_beer.db');

// Criação da tabela de log para controle antifraude
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS plays (
        ip TEXT,
        play_date DATE,
        prize TEXT
    )`);
});

// Configuração de Probabilidades (Pode vir do Admin depois)
const PROBABILITIES = [
    { prize: 'Cerveja Grátis', chance: 5 },
    { prize: '50% Desconto', chance: 10 },
    { prize: 'Porção de Petisco', chance: 5 },
    { prize: 'Dose', chance: 10 },
    { prize: 'Tente Novamente', chance: 70 }
];

// Função de Sorteio Baseada em Pesos
function drawPrize() {
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of PROBABILITIES) {
        sum += item.chance;
        if (random <= sum) return item.prize;
    }
    return 'Tente Novamente';
}

// ROTA PRINCIPAL: Jogar
app.post('/api/play', (req, res) => {
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const today = new Date().toISOString().split('T')[0];

    // 1. Controle Antifraude: Checar se já jogou hoje
    db.get(`SELECT * FROM plays WHERE ip = ? AND play_date = ?`, [userIP, today], (err, row) => {
        if (row) {
            return res.status(403).json({ error: 'Você já jogou hoje! Volte amanhã.' });
        }

        // 2. Sortear Prêmio
        const wonPrize = drawPrize();

        // 3. Registrar Jogada
        db.run(`INSERT INTO plays (ip, play_date, prize) VALUES (?, ?, ?)`, [userIP, today, wonPrize]);

        // 4. Retornar prêmio para o Canvas revelar
        res.json({ success: true, prize: wonPrize });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor do Conteiner Beer rodando na porta ${PORT}`));
