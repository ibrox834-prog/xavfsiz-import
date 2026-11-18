// Сообщения, которые пишут боту: /start — кнопка «Kursni ochish», /id — показать свой Telegram ID.
const { tg, appUrlFrom, openAppButton } = require('../lib/core');

module.exports = async (req, res) => {
  const secret = (process.env.WEBHOOK_SECRET || '').trim();
  if (!secret || req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(401).send('no');
  }
  try {
    let update = req.body || {};
    if (typeof update === 'string') update = JSON.parse(update || '{}');
    const msg = update.message;
    if (msg && msg.chat && typeof msg.text === 'string') {
      const chatId = msg.chat.id;
      const t = msg.text.trim();
      if (t.startsWith('/id')) {
        await tg('sendMessage', { chat_id: chatId, text: 'Sizning Telegram ID: ' + (msg.from && msg.from.id) });
      } else {
        await tg('sendMessage', {
          chat_id: chatId,
          text:
            "Assalomu alaykum! 👋\n\n«Xavfsiz Import» — Xitoydan tovarni aldanmasdan buyurtma qilishni o'rgatadigan kurs.\n\nKursni ochish uchun pastdagi tugmani bosing.",
          reply_markup: openAppButton(appUrlFrom(req), 'Kursni ochish')
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
  res.status(200).json({ ok: true });
};
