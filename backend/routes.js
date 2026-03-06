// backend/routes.js
const express = require('express');
const router = express.Router();
const db = require('./database.js');

// Middleware simples de autenticação para o Admin (Token via Header)
const adminAuth = (req, res, next) => {
    const token = req.headers['authorization'];
    // Em produção, use variáveis de ambiente (.env) para este token!
    if (token === 'Bearer CONTEINER_BEER_ADMIN_2026') {
        next();
    } else {
        res.status(401).json({ error: 'Não autorizado.' });
    }
};

// Rota de Estatísticas (Analytics)
router.get('/admin/stats', adminAuth, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const stats = {
        totalPlays: 0,
        playsToday: 0,
        prizesGiven: {}
    };

    db.serialize(() => {
        // Total de jogadas histórico
        db.get(`SELECT COUNT(*) as count FROM plays`, [], (err, row) => {
            if (row) stats.totalPlays = row.count;
            
            // Total de jogadas hoje
            db.get(`SELECT COUNT(*) as count FROM plays WHERE play_date = ?`, [today], (err, row) => {
                if (row) stats.playsToday = row.count;

                // Contagem de prêmios entregues
                db.all(`SELECT prize, COUNT(*) as count FROM plays GROUP BY prize`, [], (err, rows) => {
                    if (rows) {
                        rows.forEach(r => {
                            stats.prizesGiven[r.prize] = r.count;
                        });
                    }
                    res.json(stats);
                });
            });
        });
    });
});

module.exports = router;
