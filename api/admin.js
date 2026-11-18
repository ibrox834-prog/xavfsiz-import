// Админка: заявки, ученики, модули, уроки, файлы. Доступна только ID из ADMIN_IDS.
const {
  handler, db, fail, tg, openAppButton, loadStructure,
  signUpload, signDownload, removeObject
} = require('../lib/core');

function text(v, max) {
  return String(v == null ? '' : v).slice(0, max || 5000);
}

const actions = {
  async students() {
    const students = await db('students?select=*&order=requested_at.desc.nullslast,created_at.desc');
    const prog = await db('progress?select=tg_id');
    const count = {};
    prog.forEach(p => { count[p.tg_id] = (count[p.tg_id] || 0) + 1; });
    const lessons = await db('lessons?select=id');
    students.forEach(s => { s.done = count[s.tg_id] || 0; });
    return { students, totalLessons: lessons.length };
  },

  async set_status({ body, appUrl }) {
    const status = body.status;
    if (!['active', 'rejected', 'new'].includes(status)) fail(400, 'bad_status');
    const tgId = Number(body.tg_id);
    const patch = { status };
    if (status === 'active') patch.approved_at = new Date().toISOString();
    await db('students?tg_id=eq.' + tgId, { method: 'PATCH', body: patch });
    if (status === 'active') {
      try {
        await tg('sendMessage', {
          chat_id: tgId,
          text: "✅ Tabriklaymiz! «Xavfsiz Import» kursiga kirish ochildi.\n\nDarslarni boshlash uchun pastdagi tugmani bosing.",
          reply_markup: openAppButton(appUrl, 'Kursni ochish')
        });
      } catch (e) {
        console.error('notify student', e);
      }
    }
    return { ok: true };
  },

  async structure() {
    return { modules: await loadStructure() };
  },

  async save_module({ body }) {
    const row = { title: text(body.title, 200), position: Number(body.position) || 0 };
    if (!row.title) fail(400, 'empty_title');
    if (body.id) {
      await db('modules?id=eq.' + Number(body.id), { method: 'PATCH', body: row });
      return { id: Number(body.id) };
    }
    const r = await db('modules', { method: 'POST', prefer: 'return=representation', body: row });
    return { id: r[0].id };
  },

  async delete_module({ body }) {
    const id = Number(body.id);
    const ls = await db('lessons?module_id=eq.' + id + '&select=id');
    if (ls.length) fail(400, 'module_not_empty');
    await db('modules?id=eq.' + id, { method: 'DELETE' });
    return { ok: true };
  },

  async get_lesson({ body }) {
    const id = Number(body.id);
    const rows = await db('lessons?id=eq.' + id + '&select=*');
    if (!rows[0]) fail(404, 'not_found');
    const files = await db('lesson_files?lesson_id=eq.' + id + '&select=id,name,path,size&order=id.asc');
    for (const f of files) {
      try { f.url = await signDownload(f.path, f.name); } catch (e) { f.url = ''; }
    }
    const modules = await db('modules?select=id,position,title&order=position.asc,id.asc');
    return { lesson: rows[0], files, modules };
  },

  async modules() {
    return { modules: await db('modules?select=id,position,title&order=position.asc,id.asc') };
  },

  async save_lesson({ body }) {
    const row = {
      module_id: Number(body.module_id),
      position: Number(body.position) || 1,
      title: text(body.title, 300),
      duration: text(body.duration, 50),
      description: text(body.description),
      task: text(body.task),
      youtube_url: text(body.youtube_url, 500).trim()
    };
    if (!row.title) fail(400, 'empty_title');
    if (!row.module_id) fail(400, 'no_module');
    if (body.id) {
      await db('lessons?id=eq.' + Number(body.id), { method: 'PATCH', body: row });
      return { id: Number(body.id) };
    }
    const r = await db('lessons', { method: 'POST', prefer: 'return=representation', body: row });
    return { id: r[0].id };
  },

  async delete_lesson({ body }) {
    const id = Number(body.id);
    const files = await db('lesson_files?lesson_id=eq.' + id + '&select=path');
    for (const f of files) {
      try { await removeObject(f.path); } catch (e) { console.error('remove', e); }
    }
    await db('lessons?id=eq.' + id, { method: 'DELETE' });
    return { ok: true };
  },

  async upload_url({ body }) {
    const lessonId = Number(body.lesson_id);
    const safe = text(body.name, 120).replace(/[^A-Za-z0-9._-]+/g, '_') || 'file';
    const path = 'lesson-' + lessonId + '/' + Date.now() + '-' + safe;
    return { path, uploadUrl: await signUpload(path) };
  },

  async add_file({ body }) {
    const row = {
      lesson_id: Number(body.lesson_id),
      name: text(body.name, 200),
      path: text(body.path, 300),
      size: Number(body.size) || 0
    };
    if (!row.path.startsWith('lesson-' + row.lesson_id + '/')) fail(400, 'bad_path');
    await db('lesson_files', { method: 'POST', body: row });
    return { ok: true };
  },

  async delete_file({ body }) {
    const id = Number(body.id);
    const rows = await db('lesson_files?id=eq.' + id + '&select=path');
    if (rows[0]) {
      try { await removeObject(rows[0].path); } catch (e) { console.error('remove', e); }
      await db('lesson_files?id=eq.' + id, { method: 'DELETE' });
    }
    return { ok: true };
  }
};

module.exports = handler(async (ctx) => {
  if (!ctx.isAdmin) fail(403, 'not_admin');
  const fn = actions[ctx.body.action];
  if (!fn) fail(400, 'unknown_action');
  return fn(ctx);
});
