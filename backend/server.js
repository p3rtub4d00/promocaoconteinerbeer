const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const adminRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Matemática de Lucro e Segurança
const PROBABILITIES = [
    { prize: 'UMA CERVEJA LITRÃO', chance: 0.5 },
    { prize: 'UMA CERVEJA 600ML', chance: 1.0 },
    { prize: 'UMA CERVEJA LONG NECK', chance: 1.5 },
    { prize: 'UMA CERVEJA LATA', chance: 2.0 },
    { prize: 'UMA CERVEJA 350ML', chance: 2.0 },
    { prize: '5% DE DESCONTO', chance: 3.0 },
    { prize: 'Tente Novamente', chance: 90.0 }
];

function drawPrize() {
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of PROBABILITIES) {
        sum += item.chance;
        if (random <= sum) return item.prize;
    }
    return 'Tente Novamente';
}

function getLocalToday() {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Porto_Velho',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    return `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
}

app.post('/api/play', (req, res) => {
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const today = getLocalToday();

    db.get(`SELECT * FROM plays WHERE ip = ? AND play_date = ?`, [userIP, today], (err, row) => {
        if (row) return res.status(403).json({ error: 'Você já tentou a sorte hoje! Volte amanhã.' });
        
        const wonPrize = drawPrize();
        db.run(`INSERT INTO plays (ip, play_date, prize) VALUES (?, ?, ?)`, [userIP, today, wonPrize], () => {
            res.json({ success: true, prize: wonPrize });
        });
    });
});

app.get('/api/recent-winners', (req, res) => {
    db.all(`SELECT prize FROM plays WHERE prize != 'Tente Novamente' ORDER BY id DESC LIMIT 5`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar ganhadores' });
        res.json(rows.map(r => r.prize));
    });
});

app.use('/api', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
