import { Router } from 'express';
import { redis } from '../../utils/redis.js';
const router = Router();
const ADMIN_TELEGRAM_ID = 1234567890;
const isAdmin = async (req, res, next) => {
    const telegramId = parseInt(req.headers.telegramid, 10);
    if (!telegramId || telegramId !== ADMIN_TELEGRAM_ID) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    next();
};
router.get('/stats', isAdmin, async (req, res) => {
    try {
        const users = await redis.keys('user:*');
        const stats = {
            totalUsers: users.length,
            premiumUsers: 0,
            totalMessages: 0
        };
        for (const userKey of users) {
            const userData = await redis.hgetall(userKey);
            if (userData.isSubscribed === 'true') {
                stats.premiumUsers++;
            }
            stats.totalMessages += parseInt(userData.count || '0', 10);
        }
        res.json(stats);
    }
    catch (error) {
        console.error('[ADMIN STATS ERROR]', error);
        res.status(500).json({ error: 'Ошибка при получении статистики' });
    }
});
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await redis.keys('user:*');
        const usersList = await Promise.all(users.map(async (userKey) => {
            const userData = await redis.hgetall(userKey);
            return {
                id: userKey.split(':')[1],
                ...userData,
                messageCount: parseInt(userData.count || '0', 10)
            };
        }));
        res.json(usersList);
    }
    catch (error) {
        console.error('[ADMIN USERS ERROR]', error);
        res.status(500).json({ error: 'Ошибка при получении списка пользователей' });
    }
});
router.post('/users/:userId/subscription', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { isSubscribed } = req.body;
    try {
        await redis.hset(`user:${userId}`, 'isSubscribed', isSubscribed ? 'true' : 'false');
        res.json({ success: true });
    }
    catch (error) {
        console.error('[ADMIN SUBSCRIPTION ERROR]', error);
        res.status(500).json({ error: 'Ошибка при обновлении подписки' });
    }
});
router.delete('/users/:userId/history', isAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        await redis.del(`history:${userId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('[ADMIN HISTORY DELETE ERROR]', error);
        res.status(500).json({ error: 'Ошибка при очистке истории' });
    }
});
export default router;
//# sourceMappingURL=adminRoutes.js.map