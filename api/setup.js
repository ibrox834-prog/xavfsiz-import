// Однократная настройка бота. Откройте в браузере: https://ВАШ-АДРЕС.vercel.app/api/setup?key=ВАШ_WEBHOOK_SECRET
const { tg, appUrlFrom, BOT_TOKEN, SB_URL, SB_KEY, ADMIN_IDS, db } = require('../lib/core');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const secret = (process.env.WEBHOOK_SECRET || '').trim();
  const key = (req.query && req.query.key) || '';
  const lines = [];

  const missing = [];
  if (!BOT_TOKEN) missing.push('BOT_TOKEN');
  if (!SB_URL) missing.push('SUPABASE_URL');
  if (!SB_KEY) missing.push('SUPABASE_SERVICE_KEY');
  if (!ADMIN_IDS.length) missing.push('ADMIN_IDS');
  if (!secret) missing.push('WEBHOOK_SECRET');
  if (missing.length) {
    return res.status(200).send('❌ Не заполнены переменные в Vercel: ' + missing.join(', ') + '\nДобавьте их и сделайте Redeploy.');
  }
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(secret)) {
    return res.status(200).send('❌ WEBHOOK_SECRET: только латинские буквы, цифры, _ и -, от 8 символов.');
  }
  if (key !== secret) return res.status(401).send('❌ Неверный ключ в ссылке (?key=...).');

  const appUrl = appUrlFrom(req);

  try {
    const lessons = await db('lessons?select=id');
    lines.push('✅ База данных: подключена, уроков: ' + lessons.length);
  } catch (e) {
    lines.push('❌ База данных: ' + e.message);
  }

  const me = await tg('getMe');
  lines.push(me.ok ? '✅ Бот: @' + me.result.username : '❌ Бот: неверный BOT_TOKEN (' + me.description + ')');

  if (me.ok) {
    const wh = await tg('setWebhook', {
      url: appUrl + '/api/bot',
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true
    });
    lines.push(wh.ok ? '✅ Бот отвечает на /start' : '❌ Webhook: ' + wh.description);

    const mb = await tg('setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Kurs', web_app: { url: appUrl } }
    });
    lines.push(mb.ok ? '✅ Кнопка «Kurs» в меню бота' : '❌ Кнопка меню: ' + mb.description);

    await tg('setMyCommands', { commands: [{ command: 'start', description: 'Kursni ochish' }] });
  }

  lines.push('\nАдрес приложения: ' + appUrl);
  lines.push('Админы (ID): ' + ADMIN_IDS.join(', '));
  res.status(200).send(lines.join('\n'));
};
