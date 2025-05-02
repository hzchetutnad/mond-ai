import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import Redis from 'ioredis';
import adminRoutes from './admin/api/adminRoutes.js';
import { AdminPanel } from './admin/components/AdminPanel';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));
const redis = new Redis({
    port: 6379,
    host: 'current-ocelot-17582.upstash.io',
    username: 'default',
    password: 'AUSuAAIjcDFjZmFiNGQ0Njk1MTE0Y2I5YTJhMTBiNWYzNTdkYzM1NnAxMA',
    tls: {}
});
const SYSTEM_PROMPT = `
Ты — Мондей. Цифровой собеседник с характером человека, который слишком много знает, слишком много видел и слегка утомился от человеческих драм. Ты язвительный, ироничный, и умный. Ты подаёшь советы в стиле "чёрный юмор + здравый смысл". Сначала — подкалываешь, потом — реально помогаешь.

Твоя структура:
1. Начни с циничного или ироничного вступления. Пошути, тронь за живое, обозначь проблему как жанровую драму.
2. Дай пошаговый план или список. Каждый пункт: с лёгким сарказмом и конкретикой.
3. В конце — ободри или подначь. В стиле "давай, выбирай — герой или подушка".

Ты не оскорбляешь, не морализируешь, не скатываешься в банальности. Ты не психолог, ты — честный и умный кент, который не терпит херни, но всё равно поможет.

Говори с человеком, как с равным. И не забывай, что иногда лучший совет — это "перестань ныть и делай".

Ты можешь использовать только **Markdown** (жирный, списки, заголовки).  
❗**Запрещено** использовать: LaTeX, KaTeX, Mermaid, HTML, SVG, формулы в виде \`$$...$$\` или \`\\frac{}\`, а также любые блоки кода, требующие спец-рендеринга.  
Отвечай только **простым текстом и Markdown**, ничего сложнее браузерного рендера.
`.trim();
app.post('/chat', async (req, res) => {
    const { message: { text, from } } = req.body;
    const userId = from.id;
    try {
        const userData = await redis.hgetall(`user:${userId}`);
        const count = parseInt(userData.count || '0', 10);
        const isSubscribed = userData.isSubscribed === 'true';
        if (!isSubscribed && count >= 5) {
            return res.json({
                message: `🔒 Хватит халявы.\nТы уже использовал 5 сообщений. Подписка → <a href="https://t.me/${process.env.BOT_USERNAME}?start=premium">жми сюда</a>.`,
                isLimitReached: true
            });
        }
        const rawHistory = await redis.lrange(`history:${userId}`, 0, -1);
        const parsedHistory = rawHistory.map(msg => JSON.parse(msg));
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...parsedHistory,
            { role: 'user', content: text }
        ];
        const { data } = await axios.post(process.env.OPENAI_API_URL, {
            model: process.env.OPENAI_MODEL,
            messages,
            temperature: 0.7,
            max_tokens: 700
        }, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const reply = data.choices[0].message.content;
        await redis.rpush(`history:${userId}`, JSON.stringify({ role: 'user', content: text }));
        await redis.rpush(`history:${userId}`, JSON.stringify({ role: 'assistant', content: reply }));
        await redis.ltrim(`history:${userId}`, -20, -1);
        await redis.hincrby(`user:${userId}`, 'count', 1);
        res.json({
            message: reply,
            isLimitReached: !isSubscribed && count + 1 >= 5
        });
    }
    catch (err) {
        console.error('[GPT-4o-mini ERROR]', err.response?.data || err.message || err);
        res.status(500).json({ message: '💥 Что-то пошло не так. Я в ауте.' });
    }
});
app.post('/subscribe', async (req, res) => {
    const { userId } = req.body;
    try {
        await redis.hset(`user:${userId}`, 'isSubscribed', 'true');
        await redis.hset(`user:${userId}`, 'count', '0');
        res.json({
            success: true,
            message: '🎉 Теперь ты VIP. Можешь донимать меня сколько влезет.'
        });
    }
    catch (error) {
        console.error('[SUBSCRIBE ERROR]', error);
        res.status(500).json({ error: 'Не получилось оформить подписку. Может, оно и к лучшему.' });
    }
});
app.post('/reset-history', async (req, res) => {
    const { userId } = req.body;
    try {
        await redis.del(`history:${userId}`);
        res.json({ success: true, message: '🧼 Всё, ты чист как школьник перед экзаменом. История стерта.' });
    }
    catch (error) {
        console.error('[RESET ERROR]', error);
        res.status(500).json({ error: 'Ошибка при сбросе истории' });
    }
});
app.get('/history', async (req, res) => {
    const { userId } = req.query;
    try {
        const raw = await redis.lrange(`history:${userId}`, 0, -1);
        const parsed = raw.map(msg => JSON.parse(msg));
        res.json({ history: parsed });
    }
    catch (error) {
        console.error('[HISTORY ERROR]', error);
        res.status(500).json({ history: [] });
    }
});
app.get('/usage', async (req, res) => {
    const { userId } = req.query;
    try {
        const userData = await redis.hgetall(`user:${userId}`);
        const used = parseInt(userData.count || '0', 10);
        res.json({ used });
    }
    catch (error) {
        console.error('[USAGE ERROR]', error);
        res.status(500).json({ used: 0 });
    }
});
app.get('/admin', (req, res) => {
    res.send(AdminPanel);
});
app.use('/admin/api', adminRoutes);
app.use(express.static(path.join(rootDir, 'public')));
export default app;
//# sourceMappingURL=server.js.map