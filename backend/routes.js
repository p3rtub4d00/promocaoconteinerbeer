const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('./database.js');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rafaelRAMOS';

const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) {
        return cookies;
    }

    cookieHeader.split(';').forEach((cookie) => {
        const [name, ...rest] = cookie.trim().split('=');
        cookies[name] = decodeURIComponent(rest.join('='));
    });

    return cookies;
}

function createSession(res) {
    const sessionId = crypto.randomBytes(24).toString('hex');
    sessions.set(sessionId, Date.now() + SESSION_TTL_MS);

    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `admin_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secureFlag}`);
}

function clearSession(req, res) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.admin_session) {
        sessions.delete(cookies.admin_session);
    }

    res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

function isValidSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies.admin_session;

    if (!sessionId) {
        return false;
    }

    const expiresAt = sessions.get(sessionId);
    if (!expiresAt) {
        return false;
    }

    if (expiresAt < Date.now()) {
        sessions.delete(sessionId);
        return false;
    }

    return true;
}

const adminAuth = (req, res, next) => {
    if (isValidSession(req)) {
        return next();
    }

    if (ADMIN_TOKEN) {
        const token = req.headers.authorization;
        if (token === `Bearer ${ADMIN_TOKEN}`) {
            return next();
        }
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

router.post('/admin/login', (req, res) => {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'Usuário/senha admin não configurados no servidor.' });
    }

    const { username, password } = req.body || {};
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    createSession(res);
    return res.json({ success: true });
});

router.post('/admin/logout', (req, res) => {
    clearSession(req, res);
    return res.json({ success: true });
});

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
