const express = require('express');
const router = express.Router();
const db = require('./database.js');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const adminAuth = (req, res, next) => {
    if (!ADMIN_TOKEN) {
        return res.status(500).json({ error: 'Token administrativo não configurado no servidor.' });
    }

    const token = req.headers.authorization;
    if (token === `Bearer ${ADMIN_TOKEN}`) {
        return next();
    }

    return res.status(401).json({ error: 'Não autorizado.' });
};

function getLocalToday() {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Porto_Velho',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}-${parts.find((p) => p.type === 'day').value}`;
}

router.get('/admin/stats', adminAuth, (req, res) => {
    const today = getLocalToday();
    const stats = { totalPlays: 0, playsToday: 0, prizesGiven: {} };

    db.serialize(() => {
        db.get('SELECT COUNT(*) as count FROM plays', [], (errTotal, totalRow) => {
            if (errTotal) {
                return res.status(500).json({ error: 'Erro ao buscar total de jogadas.' });
            }

            stats.totalPlays = totalRow?.count || 0;

            db.get('SELECT COUNT(*) as count FROM plays WHERE play_date = ?', [today], (errToday, todayRow) => {
                if (errToday) {
                    return res.status(500).json({ error: 'Erro ao buscar jogadas de hoje.' });
                }

                stats.playsToday = todayRow?.count || 0;

                db.all('SELECT prize, COUNT(*) as count FROM plays GROUP BY prize', [], (errPrizes, rows) => {
                    if (errPrizes) {
                        return res.status(500).json({ error: 'Erro ao buscar prêmios.' });
                    }

                    if (rows) {
                        rows.forEach((r) => {
                            stats.prizesGiven[r.prize] = r.count;
                        });
                    }

                    return res.json(stats);
                });
            });
        });
    });
});

module.exports = router;
