// Ученик отмечает урок выполненным (или снимает отметку).
const { handler, db, requireAccess } = require('../lib/core');

module.exports = handler(async (ctx) => {
  await requireAccess(ctx);
  const lessonId = Number(ctx.body.lessonId);
  const tgId = Number(ctx.user.id);
  if (ctx.body.done) {
    await db('progress?on_conflict=tg_id,lesson_id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates',
      body: { tg_id: tgId, lesson_id: lessonId }
    });
  } else {
    await db('progress?tg_id=eq.' + tgId + '&lesson_id=eq.' + lessonId, { method: 'DELETE' });
  }
  return { done: !!ctx.body.done };
});
