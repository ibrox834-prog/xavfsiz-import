// Ученик отправляет заявку на доступ; админам приходит сообщение от бота.
const { handler, db, getStudent, tg, ADMIN_IDS, openAppButton } = require('../lib/core');

module.exports = handler(async ({ user, appUrl }) => {
  const s = await getStudent(user.id);
  if (!s) return { status: 'new' };
  if (s.status === 'active' || s.status === 'pending') return { status: s.status };

  await db('students?tg_id=eq.' + Number(user.id), {
    method: 'PATCH',
    body: { status: 'pending', requested_at: new Date().toISOString() }
  });

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const uname = user.username ? ' @' + user.username : '';
  const text =
    '🆕 Новая заявка на курс\n' + name + uname + '\nID: ' + user.id +
    '\n\nПосле оплаты откройте админку и нажмите «Открыть доступ».';
  for (const id of ADMIN_IDS) {
    try {
      await tg('sendMessage', { chat_id: id, text, reply_markup: openAppButton(appUrl, 'Открыть админку') });
    } catch (e) {
      console.error('notify admin', id, e);
    }
  }
  return { status: 'pending' };
});
