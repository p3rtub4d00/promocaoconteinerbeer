// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importa o banco de dados e as rotas do painel admin que criamos nos arquivos separados
const db = require('./database');
const adminRoutes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

// Serve a interface visual do jogo (pasta public)
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 1. CONFIGURAÇÃO DE PROBABILIDADES (MODO LUCRO)
// ==========================================
// Total: 100%. Deixamos o Litrão super raro e a maioria absoluta cai no Tente Novamente.
const PROBABILITIES = [
    { prize: 'UMA CERVEJA LITRÃO', chance: 0.5 },
    { prize: 'UMA CERVEJA 600ML', chance: 1.0 },
    { prize: 'UMA CERVEJA LONG NECK', chance: 1.5 },
    { prize: 'UMA CERVEJA LATA', chance: 2.0 },
    { prize: 'UMA CERVEJA 350ML', chance: 2.0 },
    { prize: '5% DE DESCONTO', chance: 3.0 },
    { prize: 'Tente Novamente', chance: 90.0 }
];

// Motor do sorteio baseado nos pesos definidos acima
function drawPrize() {
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of PROBABILITIES) {
        sum += item.chance;
        if (random <= sum) return item.prize;
    }
    return 'Tente Novamente';
}

// ==========================================
// 2. CONTROLE DE DATA E FUSO HORÁRIO
// ==========================================
// Ajuste fundamental: O Render usa o relógio global (UTC), o que faria o limite de "1 jogada 
// por dia" resetar no meio do expediente noturno. Garantimos aqui que o sistema obedeça o 
// fuso horário de America/Porto_Velho para virar o dia apenas à meia-noite real local.
function getLocalToday() {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Porto_Velho',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    
    return `${year}-${month}-${day}`; // Formato YYYY-MM-DD para o banco de dados
}

// ==========================================
// 3. ROTA PRINCIPAL: JOGAR
// ==========================================
app.post('/api/play', (req, res) => {
    // Captura o IP do usuário (O Render exige acessar o header x-forwarded-for)
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const today = getLocalToday();

    // Checa no banco se o cliente já jogou hoje
    db.get(`SELECT * FROM plays WHERE ip = ? AND play_date = ?`, [userIP, today], (err, row) => {
        if (err) {
            console.error("Erro ao ler o banco:", err);
            return res.status(500).json({ error: 'Erro interno no servidor.' });
        }

        if (row) {
            return res.status(403).json({ error: 'Você já tentou a sorte hoje! Volte amanhã.' });
        }

        // Sorteia o prêmio
        const wonPrize = drawPrize();

        // Salva a jogada no banco para bloquear novas tentativas hoje
        db.run(`INSERT INTO plays (ip, play_date, prize) VALUES (?, ?, ?)`, [userIP, today, wonPrize], (insertErr) => {
            if (insertErr) {
                console.error("Erro ao salvar jogada:", insertErr);
                return res.status(500).json({ error: 'Erro ao processar a jogada.' });
            }
            
            // Envia o prêmio de volta para o cartão raspar
            res.json({ success: true, prize: wonPrize });
        });
    });
});

// ==========================================
// 4. ROTAS DO PAINEL ADMIN
// ==========================================
app.use('/api', adminRoutes);

// ==========================================
// 5. INICIAR O SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando, seguro e configurado na porta ${PORT}`);
});
