(function () {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;
  var app = document.getElementById('app');
  var S = { me: null, isAdmin: false, firstName: '', stack: [], current: null, adminTab: 'req', openModule: null };

  // ---------- утилиты ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return app.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(app.querySelectorAll(sel)); }
  function on(sel, fn) { $$(sel).forEach(function (el) { el.addEventListener('click', function (e) { e.preventDefault(); fn(el, e); }); }); }

  var I = {
    shield: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    tick: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7A4B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    done: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7A4B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Bajarildi"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>',
    chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#56645C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    play: '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#0B7A4B"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>',
    bigplay: '<svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#fff" fill-opacity=".16"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>',
    task: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7A4B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/></svg>',
    down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B7A4B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
  };

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function confirmBox(msg) {
    return new Promise(function (resolve) {
      if (tg && tg.showConfirm) {
        try { tg.showConfirm(msg, function (ok) { resolve(!!ok); }); return; } catch (e) { /* старый клиент */ }
      }
      resolve(window.confirm(msg));
    });
  }

  function haptic(type) {
    try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(type || 'success'); } catch (e) { /* нет */ }
  }

  function api(path, body) {
    return fetch('/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Init-Data': (tg && tg.initData) || '' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || 'error'); e.status = r.status; e.code = j.error; throw e; }
        return j;
      });
    });
  }

  function openUrl(url) {
    if (tg && tg.openLink) tg.openLink(url); else window.open(url, '_blank');
  }

  function ytId(url) {
    if (!url) return '';
    var m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function fmtSize(b) {
    b = Number(b) || 0;
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' KB';
    return b ? b + ' B' : '';
  }

  function ext(name) {
    var m = String(name || '').match(/\.([A-Za-z0-9]{1,5})$/);
    return m ? m[1] : 'fayl';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ', ' +
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function initials(s) {
    var a = ((s.first_name || '') + ' ' + (s.last_name || '')).trim().split(/\s+/);
    return ((a[0] || '?')[0] + (a[1] ? a[1][0] : '')).toUpperCase();
  }

  // ---------- навигация ----------
  function go(view, params, replace) {
    if (S.current && !replace) S.stack.push(S.current);
    S.current = { view: view, params: params || {} };
    render();
  }
  function back() {
    var prev = S.stack.pop();
    if (prev) { S.current = prev; render(); }
  }
  if (tg && tg.BackButton) tg.BackButton.onClick(back);

  function backLink(text) {
    return '<button class="back" data-back>' + I.back + esc(text) + '</button>';
  }

  function render() {
    if (S.poll) { clearInterval(S.poll); S.poll = null; }
    if (tg && tg.BackButton) { if (S.stack.length) tg.BackButton.show(); else tg.BackButton.hide(); }
    window.scrollTo(0, 0);
    app.innerHTML = '<div class="loader" aria-label="Yuklanmoqda"></div>';
    var v = VIEWS[S.current.view];
    Promise.resolve().then(function () { return v(S.current.params); })
      .then(function () { on('[data-back]', back); })
      .catch(showError);
  }

  function showError(e) {
    console.error(e);
    var msg = "Xatolik yuz berdi. Qayta urinib ko'ring.";
    if (e && e.status === 401) msg = "Sessiya eskirdi. Ilovani yopib, bot orqali qayta oching.";
    if (e && e.code === 'config') msg = 'Сервер не настроен: проверьте переменные в Vercel.';
    if (e && e.code === 'closed') { boot(); return; }
    app.innerHTML = '<div class="card center"><h2>Diqqat</h2><p class="muted">' + esc(msg) + '</p>' +
      '<button class="btn primary" data-retry>Qayta urinish</button></div>';
    on('[data-retry]', function () { render(); });
  }

  // ---------- экраны ученика ----------
  var VIEWS = {};

  VIEWS.closed = function () {
    var st = S.me.status;
    var learn = [
      "1688 va Alibaba'dan yetkazib beruvchi topish",
      "WeChat'da muloqot va narxni tushirish",
      'Firibgarni aniqlash va kompaniyani tekshirish',
      "MYPOST orqali buyurtma, to'lov va yetkazish"
    ];
    var action = st === 'pending'
      ? '<div class="card soft"><div class="check">' + I.done + '<div><b>Arizangiz qabul qilindi</b><p class="small">Menejer tez orada Telegram orqali siz bilan bog\'lanadi.</p></div></div></div>'
      : '<button class="btn primary block" data-request>Ariza yuborish</button>';

    app.innerHTML =
      '<div class="brand"><div class="logo">' + I.shield + '</div><div><b>Xavfsiz Import</b><span>Xitoydan xavfsiz xarid kursi</span></div></div>' +
      '<div class="card"><h1>Xitoydan tovarni aldanmasdan buyurtma qiling</h1>' +
      '<p class="muted">WeChat orqali yetkazib beruvchi topish, uni tekshirish va MYPOST orqali xavfsiz to\'lov — qadamma-qadam.</p>' +
      '<div class="grid3"><div class="stat"><b>7</b><span>modul</span></div><div class="stat"><b>17</b><span>video dars</span></div><div class="stat"><b>∞</b><span>umrbod kirish</span></div></div></div>' +
      '<div class="card"><h3>Kursda nimani o\'rganasiz</h3>' +
      learn.map(function (t) { return '<div class="check">' + I.tick + '<span>' + esc(t) + '</span></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>Kirish qanday ochiladi</h3>' +
      '<div class="row"><span class="num">1</span><span>Ariza yuborasiz</span></div>' +
      '<div class="row"><span class="num">2</span><span>Menejer Telegram orqali bog\'lanadi</span></div>' +
      '<div class="row"><span class="num">3</span><span>To\'lovdan keyin barcha darslar ochiladi</span></div></div>' +
      action;

    // Пока заявка ждёт одобрения — проверяем статус каждые 7 секунд
    // и сами открываем уроки, как только админ откроет доступ.
    if (st === 'pending') {
      var check = function () {
        api('me').then(function (r) {
          S.me = r.student;
          if (r.student.status === 'active') {
            haptic('success');
            toast('Kirish ochildi! Xush kelibsiz');
            go('home', {}, true);
          } else if (r.student.status !== 'pending') {
            render();
          }
        }).catch(function () { /* сеть пропала — попробуем позже */ });
      };
      S.poll = setInterval(check, 7000);
    }

    on('[data-request]', function (btn) {
      btn.disabled = true;
      api('request').then(function (r) {
        S.me.status = r.status;
        haptic('success');
        if (r.status === 'active') go('home', {}, true); else go('closed', {}, true);
      }).catch(function (e) { btn.disabled = false; showError(e); });
    });
  };

  VIEWS.home = function () {
    return api('course').then(function (r) {
      var modules = r.modules;
      var all = [];
      modules.forEach(function (m) { m.lessons.forEach(function (l) { all.push(l); }); });
      var doneCount = all.filter(function (l) { return l.done; }).length;
      var nextL = all.filter(function (l) { return !l.done; })[0];
      var pct = all.length ? Math.round(doneCount / all.length * 100) : 0;
      if (S.openModule == null) {
        var nm = modules.filter(function (m) { return nextL && m.lessons.some(function (l) { return l.id === nextL.id; }); })[0];
        S.openModule = nm ? nm.id : (modules[0] && modules[0].id);
      }

      var admin = S.isAdmin ? '<button class="btn light block" data-admin>Админка</button>' : '';
      var cont = nextL
        ? '<button class="continue" data-lesson="' + nextL.id + '"><span><small>DAVOM ETISH</small><b>' + esc(nextL.label + ' ' + nextL.title) + '</b></span>' + I.play + '</button>'
        : '<div class="continue"><span><small>TABRIKLAYMIZ</small><b>Barcha darslar bajarildi!</b></span></div>';

      app.innerHTML =
        '<div><span class="muted">Xavfsiz Import</span><h1>Salom, ' + esc(S.firstName || 'do\'stim') + '!</h1></div>' +
        admin +
        '<div class="progress-card"><div class="row" style="justify-content:space-between"><span style="font-weight:600">Sizning natijangiz</span><b>' + doneCount + ' / ' + all.length + ' dars</b></div>' +
        '<div class="bar"><div style="width:' + pct + '%"></div></div>' + cont + '</div>' +
        '<h2>Modullar</h2>' +
        '<div class="stack" style="gap:8px">' + modules.map(function (m) {
          var d = m.lessons.filter(function (l) { return l.done; }).length;
          var full = m.lessons.length && d === m.lessons.length;
          return '<div class="mod' + (S.openModule === m.id ? ' open' : '') + '" data-mod="' + m.id + '">' +
            '<button class="mod-head" data-toggle="' + m.id + '" aria-expanded="' + (S.openModule === m.id) + '">' +
            '<span class="badge' + (full ? ' full' : '') + '">' + esc(m.position) + '</span>' +
            '<span class="grow" style="flex:1;min-width:0"><span class="t">' + esc(m.title) + '</span><span class="s">' + d + ' / ' + m.lessons.length + ' dars</span></span>' + I.chev + '</button>' +
            '<div class="mod-body">' + m.lessons.map(function (l) {
              return '<button class="lesson-row' + (nextL && nextL.id === l.id ? ' next' : '') + '" data-lesson="' + l.id + '">' +
                '<span class="t">' + esc(l.label + ' ' + l.title) + '</span>' +
                (l.done ? I.done : '<span class="d">' + esc(l.duration || '') + '</span>') + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>';

      on('[data-toggle]', function (el) {
        var id = Number(el.getAttribute('data-toggle'));
        var box = el.parentNode;
        var open = !box.classList.contains('open');
        $$('.mod').forEach(function (x) { x.classList.remove('open'); x.querySelector('.mod-head').setAttribute('aria-expanded', 'false'); });
        if (open) { box.classList.add('open'); el.setAttribute('aria-expanded', 'true'); }
        S.openModule = open ? id : -1;
      });
      on('[data-lesson]', function (el) { go('lesson', { id: Number(el.getAttribute('data-lesson')) }); });
      on('[data-admin]', function () { go('admin'); });
    });
  };

  VIEWS.lesson = function (p) {
    return api('lesson', { id: p.id }).then(function (r) {
      var L = r.lesson;
      var vid = ytId(L.youtube_url);
      var video = vid
        ? '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' + vid + '?rel=0&modestbranding=1&playsinline=1" title="' + esc(L.title) + '" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>'
        : '<div class="video">' + I.bigplay + '<span>Video tez orada qo\'shiladi</span></div>';
      var task = L.task ? '<div class="card"><div class="row" style="gap:8px">' + I.task + '<h3>Topshiriq</h3></div><p class="pre">' + esc(L.task) + '</p></div>' : '';
      var files = r.files.length ? '<div class="card"><h3>Fayllar</h3>' + r.files.map(function (f, i) {
        return '<button class="file" data-file="' + i + '"><span class="ext">' + esc(ext(f.name)) + '</span>' +
          '<span class="grow" style="flex:1;min-width:0"><span class="n">' + esc(f.name) + '</span><span class="small muted">' + esc(fmtSize(f.size)) + '</span></span>' + I.down + '</button>';
      }).join('') + '</div>' : '';
      var nextBtn = r.next
        ? '<button class="btn ghost block" data-next="' + r.next.id + '">Keyingi dars: ' + esc(r.next.label) + I.next + '</button>'
        : '';

      app.innerHTML =
        backLink('Modul ' + L.modulePosition + '. ' + L.moduleTitle) +
        video +
        '<div class="stack" style="gap:6px"><span class="label">' + esc(L.label) + '-DARS' + (L.duration ? ' · ' + esc(L.duration) : '') + '</span>' +
        '<h1 style="font-size:22px">' + esc(L.title) + '</h1>' +
        (L.description ? '<p class="pre" style="color:var(--ink2)">' + esc(L.description) + '</p>' : '') + '</div>' +
        task + files +
        '<div class="stack" style="margin-top:auto;gap:8px"><button class="btn block ' + (r.done ? 'primary' : 'outline') + '" data-done>' + (r.done ? 'Bajarildi ✓' : 'Bajarildi deb belgilash') + '</button>' + nextBtn + '</div>';

      var done = r.done;
      on('[data-done]', function (btn) {
        btn.disabled = true;
        api('progress', { lessonId: L.id, done: !done }).then(function () {
          done = !done;
          btn.className = 'btn block ' + (done ? 'primary' : 'outline');
          btn.textContent = done ? 'Bajarildi ✓' : 'Bajarildi deb belgilash';
          btn.disabled = false;
          if (done) { haptic('success'); toast('Ajoyib! Dars bajarildi'); }
        }).catch(function (e) { btn.disabled = false; showError(e); });
      });
      on('[data-file]', function (el) { openUrl(r.files[Number(el.getAttribute('data-file'))].url); });
      on('[data-next]', function (el) { go('lesson', { id: Number(el.getAttribute('data-next')) }, true); });
    });
  };

  // ---------- админка ----------
  VIEWS.admin = function () {
    var tab = S.adminTab;
    var head = '<div class="row" style="justify-content:space-between"><h1 style="font-size:22px">Админка</h1><span class="pill warn">ТОЛЬКО ДЛЯ ВАС</span></div>';
    var tabs = function (pending) {
      return '<div class="tabs" role="tablist">' +
        '<button data-tab="req" class="' + (tab === 'req' ? 'on' : '') + '">Заявки' + (pending ? ' · ' + pending : '') + '</button>' +
        '<button data-tab="students" class="' + (tab === 'students' ? 'on' : '') + '">Ученики</button>' +
        '<button data-tab="lessons" class="' + (tab === 'lessons' ? 'on' : '') + '">Уроки</button></div>';
    };
    var bindTabs = function () {
      on('[data-tab]', function (el) { S.adminTab = el.getAttribute('data-tab'); go('admin', {}, true); });
    };

    if (tab === 'lessons') {
      return api('admin', { action: 'structure' }).then(function (r) {
        app.innerHTML = head + tabs() +
          '<p class="small muted">Нажмите на урок, чтобы добавить видео, задание и файлы.</p>' +
          r.modules.map(function (m) {
            return '<div class="card" style="padding:12px 14px;gap:6px">' +
              '<div class="row"><span class="badge">' + esc(m.position) + '</span><b class="grow">' + esc(m.title) + '</b>' +
              '<button class="btn ghost small" data-edit-mod="' + m.id + '">Изменить</button></div>' +
              m.lessons.map(function (l) {
                return '<button class="lesson-row" style="padding-left:12px;border-radius:10px" data-edit-lesson="' + l.id + '">' +
                  '<span class="t">' + esc(l.label + ' ' + l.title) + '</span>' +
                  (l.hasVideo ? '<span class="pill ok">видео</span>' : '<span class="pill grey">нет видео</span>') + '</button>';
              }).join('') +
              '<button class="btn ghost small" data-add-lesson="' + m.id + '" data-next-pos="' + (m.lessons.length + 1) + '">+ Добавить урок</button></div>';
          }).join('') +
          '<button class="btn light block" data-add-mod="' + r.modules.length + '">+ Добавить модуль</button>';
        bindTabs();
        on('[data-edit-lesson]', function (el) { go('adminLesson', { id: Number(el.getAttribute('data-edit-lesson')) }); });
        on('[data-add-lesson]', function (el) { go('adminLesson', { moduleId: Number(el.getAttribute('data-add-lesson')), position: Number(el.getAttribute('data-next-pos')) }); });
        on('[data-edit-mod]', function (el) {
          var id = Number(el.getAttribute('data-edit-mod'));
          var m = r.modules.filter(function (x) { return x.id === id; })[0];
          go('adminModule', { id: id, title: m.title, position: m.position, count: m.lessons.length });
        });
        on('[data-add-mod]', function (el) { go('adminModule', { position: Number(el.getAttribute('data-add-mod')) }); });
      });
    }

    return api('admin', { action: 'students' }).then(function (r) {
      var list = r.students;
      var pending = list.filter(function (s) { return s.status === 'pending'; });
      var shown, intro;
      if (tab === 'req') {
        shown = pending;
        intro = '<p class="small muted">Получили оплату — нажмите «Открыть доступ». Ученику сразу придёт сообщение от бота.</p>';
      } else {
        shown = list.filter(function (s) { return s.status !== 'pending'; });
        var active = list.filter(function (s) { return s.status === 'active'; }).length;
        intro = '<div class="grid2"><div class="stat white"><b>' + active + '</b><span>с доступом</span></div><div class="stat white"><b>' + list.length + '</b><span>всего открывали бота</span></div></div>';
      }
      var statusPill = function (s) {
        if (s.status === 'active') return '<span class="pill ok">доступ открыт</span>';
        if (s.status === 'rejected') return '<span class="pill grey">отклонён</span>';
        if (s.status === 'pending') return '<span class="pill warn">ждёт</span>';
        return '<span class="pill grey">без заявки</span>';
      };
      var card = function (s) {
        var name = ((s.first_name || '') + ' ' + (s.last_name || '')).trim() || 'Без имени';
        var sub = (s.username ? '@' + s.username + ' · ' : '') + 'ID ' + s.tg_id;
        var when = s.status === 'pending' ? 'заявка ' + fmtDate(s.requested_at) :
          s.status === 'active' ? 'пройдено ' + s.done + ' / ' + r.totalLessons : '';
        var btns = s.status === 'pending'
          ? '<div class="row" style="gap:8px"><button class="btn primary small" style="flex:2" data-set="active" data-id="' + s.tg_id + '">Открыть доступ</button><button class="btn light small" style="flex:1" data-set="rejected" data-id="' + s.tg_id + '">Отклонить</button></div>'
          : s.status === 'active'
            ? '<button class="btn danger small" data-set="new" data-id="' + s.tg_id + '" data-ask="1">Закрыть доступ</button>'
            : '<button class="btn primary small" data-set="active" data-id="' + s.tg_id + '">Открыть доступ</button>';
        return '<div class="card" style="padding:14px;gap:12px"><div class="row"><span class="avatar">' + esc(initials(s)) + '</span>' +
          '<span class="grow"><b style="display:block">' + esc(name) + '</b><span class="small muted">' + esc(sub) + '</span>' +
          (when ? '<span class="small muted" style="display:block">' + esc(when) + '</span>' : '') + '</span>' +
          (tab === 'students' ? statusPill(s) : '') + '</div>' + btns + '</div>';
      };

      app.innerHTML = head + tabs(pending.length) + intro +
        (shown.length ? shown.map(card).join('') : '<div class="empty">' + (tab === 'req' ? 'Новых заявок нет' : 'Пока никого нет') + '</div>');
      bindTabs();
      on('[data-set]', function (el) {
        var status = el.getAttribute('data-set');
        var id = Number(el.getAttribute('data-id'));
        var ask = el.getAttribute('data-ask') ? confirmBox('Закрыть доступ этому ученику?') : Promise.resolve(true);
        ask.then(function (ok) {
          if (!ok) return;
          el.disabled = true;
          return api('admin', { action: 'set_status', tg_id: id, status: status }).then(function () {
            haptic('success');
            toast(status === 'active' ? 'Доступ открыт, ученик получил сообщение' : status === 'rejected' ? 'Заявка отклонена' : 'Доступ закрыт');
            go('admin', {}, true);
          });
        }).catch(showError);
      });
    });
  };

  VIEWS.adminModule = function (p) {
    app.innerHTML = backLink('Назад') +
      '<h1 style="font-size:22px">' + (p.id ? 'Модуль' : 'Новый модуль') + '</h1>' +
      '<div class="field"><label for="m-title">Название (видят ученики)</label><input id="m-title" value="' + esc(p.title || '') + '" placeholder="Masalan: Logistika"></div>' +
      '<div class="field"><label for="m-pos">Номер модуля</label><input id="m-pos" type="number" inputmode="numeric" value="' + esc(p.position != null ? p.position : 0) + '"><span class="hint">Модули идут по порядку номеров: 0, 1, 2…</span></div>' +
      '<button class="btn primary block" data-save>Сохранить</button>' +
      (p.id ? '<button class="btn danger block" data-del>Удалить модуль</button>' : '');
    on('[data-save]', function (btn) {
      btn.disabled = true;
      api('admin', { action: 'save_module', id: p.id, title: $('#m-title').value, position: $('#m-pos').value })
        .then(function () { toast('Сохранено'); back(); })
        .catch(function (e) { btn.disabled = false; toast(e.code === 'empty_title' ? 'Введите название' : 'Ошибка сохранения'); });
    });
    on('[data-del]', function () {
      if (p.count) { toast('Сначала удалите или перенесите уроки модуля'); return; }
      confirmBox('Удалить модуль?').then(function (ok) {
        if (!ok) return;
        return api('admin', { action: 'delete_module', id: p.id }).then(function () { toast('Удалено'); back(); });
      }).catch(showError);
    });
  };

  VIEWS.adminLesson = function (p) {
    var load = p.id ? api('admin', { action: 'get_lesson', id: p.id })
      : api('admin', { action: 'modules' }).then(function (r) {
        return { lesson: { module_id: p.moduleId, position: p.position || 1 }, files: [], modules: r.modules };
      });
    return load.then(function (r) {
      var L = r.lesson;
      var opts = r.modules.map(function (m) {
        return '<option value="' + m.id + '"' + (m.id === L.module_id ? ' selected' : '') + '>Модуль ' + esc(m.position) + '. ' + esc(m.title) + '</option>';
      }).join('');
      var files = p.id
        ? '<div class="stack" style="gap:8px"><span class="small" style="font-weight:700;color:var(--ink2)">Файлы для учеников</span>' +
          (r.files.length ? r.files.map(function (f) {
            return '<div class="card" style="padding:8px 12px;flex-direction:row;align-items:center;gap:10px"><span class="ext pill ok">' + esc(ext(f.name)) + '</span>' +
              '<span class="grow" style="flex:1;min-width:0;font-weight:600;word-break:break-word">' + esc(f.name) + ' <span class="small muted">' + esc(fmtSize(f.size)) + '</span></span>' +
              '<button class="btn danger small" data-del-file="' + f.id + '" aria-label="Удалить файл">Удалить</button></div>';
          }).join('') : '<span class="small muted">Файлов пока нет</span>') +
          '<label class="upload"><input type="file" multiple data-upload>+ Добавить файл</label><span class="hint">PDF, Excel, Word, картинки — до 50 МБ</span></div>'
        : '<p class="small muted">Файлы можно добавить после первого сохранения урока.</p>';

      app.innerHTML = backLink('Все уроки') +
        '<h1 style="font-size:22px">' + (p.id ? 'Редактирование урока' : 'Новый урок') + '</h1>' +
        '<div class="field"><label for="l-mod">Модуль</label><select id="l-mod">' + opts + '</select></div>' +
        '<div class="grid2"><div class="field"><label for="l-pos">Номер урока</label><input id="l-pos" type="number" inputmode="numeric" value="' + esc(L.position) + '"></div>' +
        '<div class="field"><label for="l-dur">Длительность</label><input id="l-dur" value="' + esc(L.duration || '') + '" placeholder="8 daq"></div></div>' +
        '<div class="field"><label for="l-title">Название урока (видят ученики)</label><input id="l-title" value="' + esc(L.title || '') + '"></div>' +
        '<div class="field"><label for="l-yt">Ссылка на видео YouTube</label><input id="l-yt" inputmode="url" value="' + esc(L.youtube_url || '') + '" placeholder="https://youtu.be/..."><span class="hint">На YouTube поставьте доступ «По ссылке» (Unlisted)</span></div>' +
        '<div class="field"><label for="l-desc">Описание</label><textarea id="l-desc">' + esc(L.description || '') + '</textarea></div>' +
        '<div class="field"><label for="l-task">Задание</label><textarea id="l-task">' + esc(L.task || '') + '</textarea></div>' +
        files +
        '<button class="btn primary block" data-save>Сохранить урок</button>' +
        (p.id ? '<button class="btn danger block" data-del>Удалить урок</button>' : '');

      on('[data-save]', function (btn) {
        var yt = $('#l-yt').value.trim();
        if (yt && !ytId(yt)) { toast('Не похоже на ссылку YouTube'); return; }
        btn.disabled = true;
        api('admin', {
          action: 'save_lesson', id: p.id,
          module_id: $('#l-mod').value, position: $('#l-pos').value, duration: $('#l-dur').value,
          title: $('#l-title').value, youtube_url: yt,
          description: $('#l-desc').value, task: $('#l-task').value
        }).then(function (res) {
          toast('Урок сохранён');
          if (!p.id) go('adminLesson', { id: res.id }, true); else btn.disabled = false;
        }).catch(function (e) { btn.disabled = false; toast(e.code === 'empty_title' ? 'Введите название урока' : 'Ошибка сохранения'); });
      });

      on('[data-del]', function () {
        confirmBox('Удалить урок вместе с файлами? Это нельзя отменить.').then(function (ok) {
          if (!ok) return;
          return api('admin', { action: 'delete_lesson', id: p.id }).then(function () { toast('Урок удалён'); back(); });
        }).catch(showError);
      });

      on('[data-del-file]', function (el) {
        confirmBox('Удалить файл?').then(function (ok) {
          if (!ok) return;
          return api('admin', { action: 'delete_file', id: Number(el.getAttribute('data-del-file')) }).then(function () { go('adminLesson', p, true); });
        }).catch(showError);
      });

      var up = $('[data-upload]');
      if (up) up.addEventListener('change', function () {
        var list = Array.prototype.slice.call(up.files || []);
        if (!list.length) return;
        var big = list.filter(function (f) { return f.size > 50 * 1024 * 1024; });
        if (big.length) { toast('Файл больше 50 МБ: ' + big[0].name); return; }
        up.parentNode.firstChild.nextSibling.textContent = 'Загрузка…';
        list.reduce(function (chain, f) {
          return chain.then(function () {
            return api('admin', { action: 'upload_url', lesson_id: p.id, name: f.name }).then(function (u) {
              return fetch(u.uploadUrl, { method: 'PUT', headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'false' }, body: f })
                .then(function (res) {
                  if (!res.ok) throw new Error('upload ' + res.status);
                  return api('admin', { action: 'add_file', lesson_id: p.id, name: f.name, path: u.path, size: f.size });
                });
            });
          });
        }, Promise.resolve()).then(function () {
          toast('Файлы загружены');
          go('adminLesson', p, true);
        }).catch(function (e) { console.error(e); toast('Не удалось загрузить файл'); go('adminLesson', p, true); });
      });
    });
  };

  // ---------- запуск ----------
  function boot() {
    if (!tg || !tg.initData) {
      app.innerHTML = '<div class="brand"><div class="logo">' + I.shield + '</div><div><b>Xavfsiz Import</b><span>Xitoydan xavfsiz xarid kursi</span></div></div>' +
        '<div class="card center"><h2>Ilovani Telegram orqali oching</h2><p class="muted">Bu kurs Telegram\'dagi bot ichida ishlaydi.</p></div>';
      return;
    }
    try {
      tg.ready(); tg.expand();
      tg.setHeaderColor && tg.setHeaderColor('#F4F6F5');
      tg.setBackgroundColor && tg.setBackgroundColor('#F4F6F5');
    } catch (e) { /* старый клиент */ }
    S.stack = []; S.current = null;
    api('me').then(function (r) {
      S.me = r.student; S.isAdmin = r.isAdmin; S.firstName = r.firstName;
      go((S.isAdmin || S.me.status === 'active') ? 'home' : 'closed');
    }).catch(showError);
  }

  boot();
})();
