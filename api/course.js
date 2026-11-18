// Список модулей и уроков с отметками «пройдено» для текущего ученика.
const { handler, db, requireAccess, loadStructure } = require('../lib/core');

module.exports = handler(async (ctx) => {
  await requireAccess(ctx);
  const modules = await loadStructure();
  const prog = await db('progress?tg_id=eq.' + Number(ctx.user.id) + '&select=lesson_id');
  const done = new Set(prog.map(p => p.lesson_id));
  modules.forEach(m => m.lessons.forEach(l => { l.done = done.has(l.id); }));
  return { modules };
});
