const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const adminRoutes = require('./routes');

const app = express();

const PLAY_INTERVAL_MINUTES = 30;
const MAX_PLAYS_PER_DAY = 4;

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
const corsOptions = allowedOrigins.length > 0
    ? { origin: allowedOrigins, methods: ['GET', 'POST'], optionsSuccessStatus: 204 }
    : { origin: true, methods: ['GET', 'POST'], optionsSuccessStatus: 204 };

app.set('trust proxy', 1);
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function createSimpleRateLimit({ windowMs, max, message }) {
    const hits = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const windowStart = now - windowMs;
        const values = (hits.get(ip) || []).filter((ts) => ts > windowStart);

        if (values.length >= max) {
            return res.status(429).json(message);
        }

        values.push(now);
        hits.set(ip, values);

        return next();
    };
}

const playLimiter = createSimpleRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

const adminLimiter = createSimpleRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Muitas requisições administrativas. Aguarde e tente novamente.' }
});

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

    for (const item of PROBABILITIES) {
        sum += item.chance;
        if (random <= sum) {
            return item.prize;
        }
    }

    return 'Tente Novamente';
}

function getLocalToday() {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Porto_Velho',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}-${parts.find((p) => p.type === 'day').value}`;
}

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
}

function isValidPlayerId(value) {
    return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

app.post('/api/play', playLimiter, (req, res) => {
    const playerId = req.body?.playerId;

    if (!isValidPlayerId(playerId)) {
        return res.status(400).json({ error: 'Identificador do jogador inválido. Recarregue a página e tente novamente.' });
    }

    const userIP = getClientIp(req);
    const today = getLocalToday();
    const wonPrize = drawPrize();

    db.get(
        'SELECT COUNT(*) AS count FROM plays WHERE player_id = ? AND play_date = ?',
        [playerId, today],
        (countErr, countRow) => {
            if (countErr) {
                return res.status(500).json({ error: 'Erro ao verificar limite diário.' });
            }

            const playsToday = countRow?.count || 0;
            if (playsToday >= MAX_PLAYS_PER_DAY) {
                return res.status(403).json({ error: `Você já usou suas ${MAX_PLAYS_PER_DAY} jogadas de hoje. Volte amanhã!` });
            }

            db.get(
                'SELECT created_at FROM plays WHERE player_id = ? ORDER BY id DESC LIMIT 1',
                [playerId],
                (lastErr, lastRow) => {
                    if (lastErr) {
                        return res.status(500).json({ error: 'Erro ao verificar intervalo entre jogadas.' });
                    }

                    if (lastRow?.created_at) {
                        const lastPlayDate = new Date(`${lastRow.created_at}Z`);
                        const diffMs = Date.now() - lastPlayDate.getTime();
                        const waitMs = PLAY_INTERVAL_MINUTES * 60 * 1000 - diffMs;

                        if (waitMs > 0) {
                            const waitMinutes = Math.ceil(waitMs / 60000);
                            return res.status(429).json({
                                error: `Aguarde ${waitMinutes} minuto(s) para jogar novamente.`
                            });
                        }
                    }

                    return db.run(
                        'INSERT INTO plays (ip, player_id, play_date, prize) VALUES (?, ?, ?, ?)',
                        [userIP, playerId, today, wonPrize],
                        (insertErr) => {
                            if (insertErr) {
                                return res.status(500).json({ error: 'Erro ao registrar jogada.' });
                            }

                            return res.json({ success: true, prize: wonPrize });
                        }
                    );
                }
            );
        }
    );
});

app.get('/api/recent-winners', (req, res) => {
    db.all("SELECT prize FROM plays WHERE prize != 'Tente Novamente' ORDER BY id DESC LIMIT 5", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao buscar ganhadores' });
        }

        return res.json(rows.map((r) => r.prize));
    });
});

app.use('/api/admin', adminLimiter);
app.use('/api', adminRoutes);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
