// Один урок: видео, описание, задание, файлы (временные ссылки), следующий урок.
const { handler, db, requireAccess, loadStructure, signDownload, fail } = require('../lib/core');

module.exports = handler(async (ctx) => {
  await requireAccess(ctx);
  const id = Number(ctx.body.id);
  const rows = await db('lessons?id=eq.' + id + '&select=*');
  const lesson = rows[0];
  if (!lesson) fail(404, 'not_found');

  const filesRows = await db('lesson_files?lesson_id=eq.' + id + '&select=id,name,path,size&order=id.asc');
  const files = [];
  for (const f of filesRows) {
    try {
      files.push({ id: f.id, name: f.name, size: f.size, url: await signDownload(f.path, f.name) });
    } catch (e) {
      console.error('sign file', f.id, e);
    }
  }

  const prog = await db('progress?tg_id=eq.' + Number(ctx.user.id) + '&lesson_id=eq.' + id + '&select=lesson_id');

  const modules = await loadStructure();
  const flat = [];
  modules.forEach(m => m.lessons.forEach(l => flat.push(Object.assign({ moduleTitle: m.title, modulePosition: m.position }, l))));
  const idx = flat.findIndex(l => l.id === id);
  const me = flat[idx] || {};
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      duration: lesson.duration,
      description: lesson.description,
      task: lesson.task,
      youtube_url: lesson.youtube_url,
      label: me.label || '',
      moduleTitle: me.moduleTitle || '',
      modulePosition: me.modulePosition
    },
    files,
    done: prog.length > 0,
    next: next ? { id: next.id, label: next.label, title: next.title } : null
  };
});
