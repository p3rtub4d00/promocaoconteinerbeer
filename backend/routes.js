const express = require('express');
const router = express.Router();
const db = require('./database.js');

const adminAuth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token === 'Bearer CONTEINER_BEER_ADMIN_2026') {
        next();
    } else {
        res.status(401).json({ error: 'Não autorizado.' });
    }
};

router.get('/admin/stats', adminAuth, (req, res) => {
    const parts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Porto_Velho', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
    
    const stats = { totalPlays: 0, playsToday: 0, prizesGiven: {} };

    db.serialize(() => {
        db.get(`SELECT COUNT(*) as count FROM plays`, [], (err, row) => {
            if (row) stats.totalPlays = row.count;
            db.get(`SELECT COUNT(*) as count FROM plays WHERE play_date = ?`, [today], (err, row) => {
                if (row) stats.playsToday = row.count;
                db.all(`SELECT prize, COUNT(*) as count FROM plays GROUP BY prize`, [], (err, rows) => {
                    if (rows) rows.forEach(r => stats.prizesGiven[r.prize] = r.count);
                    res.json(stats);
                });
            });
        });
    });
});

module.exports = router;
