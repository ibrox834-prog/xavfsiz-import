// Кто открыл приложение: создаёт ученика при первом входе, возвращает его статус.
const { handler, db } = require('../lib/core');

module.exports = handler(async ({ user, isAdmin }) => {
  const rows = await db('students?on_conflict=tg_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      tg_id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || ''
    }
  });
  return { student: rows[0], isAdmin, firstName: user.first_name || '' };
});
