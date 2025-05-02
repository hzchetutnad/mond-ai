import { Router, Request, Response } from 'express';
import { redis } from '../../utils/redis';

const router = Router();

const ADMIN_TELEGRAM_ID = 'hzchetutnad';

// Middleware для проверки админ прав
const isAdmin = async (req: Request, res: Response, next: Function) => {
  const { adminToken, telegramId } = req.headers;
  
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN || telegramId !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  
  next();
};

// Получить статистику
router.get('/stats', isAdmin, async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('[ADMIN STATS ERROR]', error);
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
});

// Получить список пользователей
router.get('/users', isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await redis.keys('user:*');
    const usersList = await Promise.all(
      users.map(async (userKey) => {
        const userData = await redis.hgetall(userKey);
        return {
          id: userKey.split(':')[1],
          ...userData,
          messageCount: parseInt(userData.count || '0', 10)
        };
      })
    );

    res.json(usersList);
  } catch (error) {
    console.error('[ADMIN USERS ERROR]', error);
    res.status(500).json({ error: 'Ошибка при получении списка пользователей' });
  }
});

// Управление подпиской пользователя
router.post('/users/:userId/subscription', isAdmin, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { isSubscribed } = req.body;

  try {
    await redis.hset(`user:${userId}`, 'isSubscribed', isSubscribed ? 'true' : 'false');
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN SUBSCRIPTION ERROR]', error);
    res.status(500).json({ error: 'Ошибка при обновлении подписки' });
  }
});

// Очистка истории пользователя
router.delete('/users/:userId/history', isAdmin, async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    await redis.del(`history:${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN HISTORY DELETE ERROR]', error);
    res.status(500).json({ error: 'Ошибка при очистке истории' });
  }
});

export default router; 