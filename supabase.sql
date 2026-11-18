-- Xavfsiz Import: база данных курса.
-- Вставьте весь этот текст в Supabase → SQL Editor → New query и нажмите Run.
-- Можно запускать повторно: уже созданное не сломается.

-- 1. Таблицы
create table if not exists students (
  tg_id        bigint primary key,
  first_name   text not null default '',
  last_name    text not null default '',
  username     text not null default '',
  status       text not null default 'new' check (status in ('new', 'pending', 'active', 'rejected')),
  requested_at timestamptz,
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists modules (
  id       bigserial primary key,
  position int  not null default 0,
  title    text not null
);

create table if not exists lessons (
  id          bigserial primary key,
  module_id   bigint not null references modules(id) on delete restrict,
  position    int  not null default 1,
  title       text not null,
  duration    text not null default '',
  description text not null default '',
  task        text not null default '',
  youtube_url text not null default ''
);

create table if not exists lesson_files (
  id         bigserial primary key,
  lesson_id  bigint not null references lessons(id) on delete cascade,
  name       text not null,
  path       text not null,
  size       bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists progress (
  tg_id     bigint not null references students(tg_id) on delete cascade,
  lesson_id bigint not null references lessons(id) on delete cascade,
  done_at   timestamptz not null default now(),
  primary key (tg_id, lesson_id)
);

-- 2. Защита: напрямую к таблицам никто не подключится, только сервер приложения.
alter table students     enable row level security;
alter table modules      enable row level security;
alter table lessons      enable row level security;
alter table lesson_files enable row level security;
alter table progress     enable row level security;

-- 3. Закрытое хранилище для файлов уроков (скачать можно только по временной ссылке).
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

-- 4. Модули курса
insert into modules (id, position, title) values
  (1, 0, $$Kirish$$),
  (2, 1, $$Asoslar$$),
  (3, 2, $$WeChat va muloqot$$),
  (4, 3, $$Xavfsizlik$$),
  (5, 4, $$Buyurtma va to'lov$$),
  (6, 5, $$Yetkazish$$),
  (7, 6, $$Yakun$$)
on conflict (id) do nothing;

-- 5. Уроки (видео добавите в админке)
insert into lessons (id, module_id, position, title, duration, description, task) values
  (1, 1, 1, $$Kurs haqida va MYPOST bilan ishlash$$, $$4 daq$$,
   $$Kurs nima beradi, darslarni qanday o'tish kerak va MYPOST qanday yordam beradi. Nega pulni Xitoyga to'g'ridan-to'g'ri jo'natmaysiz.$$,
   $$Qaysi tovarni buyurtma qilmoqchi ekaningizni va nima uchun ekanini yozib qo'ying.$$),

  (2, 2, 1, $$Xitoydan xarid qanday ishlaydi$$, $$5 daq$$,
   $$Fabrika, trading kompaniya va agent: afzalliklari va kamchiliklari. MYPOST bilan buyurtma berishning 7 qadami.$$,
   $$Sizga qaysi turdagi yetkazib beruvchi mos kelishini aniqlang.$$),
  (3, 2, 2, $$Tovar tanlash va texnik topshiriq$$, $$7 daq$$,
   $$Tovarni qanday baholash: talab, ustama, og'irlik va yetkazish. Texnik topshiriqqa nimalar yoziladi: o'lcham, material, rang, qadoq, rasm.$$,
   $$Shablon bo'yicha o'z tovaringiz uchun texnik topshiriq tayyorlang.$$),
  (4, 2, 3, $$Yetkazib beruvchini qayerdan topish$$, $$8 daq$$,
   $$1688 va Alibaba'da qidiruv, rasm orqali qidirish, filtrlar. Sotuvchining WeChat'i yoki QR-kodini qayerdan topish mumkin.$$,
   $$O'z tovaringiz bo'yicha 5 ta yetkazib beruvchi toping.$$),

  (5, 3, 1, $$WeChat'ni o'rnatish va profilni sozlash$$, $$5 daq$$,
   $$WeChat'ni o'rnatish, ro'yxatdan o'tish, profil rasmi va ismi. QR-kod orqali kontakt qo'shish.$$,
   $$Profilingizni to'ldiring.$$),
  (6, 3, 2, $$Birinchi xabar: jiddiy xaridor bo'lish$$, $$8 daq$$,
   $$Yomon va yaxshi xabar namunasi. Birinchi xabarda bo'lishi kerak bo'lgan 6 narsa. Xabarni xitoychaga tarjima qilish.$$,
   $$O'z tovaringiz uchun xabar yozing va uni 3 ta sotuvchiga yuboring.$$),
  (7, 3, 3, $$Muzokara va narxni tushirish$$, $$10 daq$$,
   $$Guanxi, mianzi va sabr. 100, 500 va 1000 dona uchun narx so'rash. Chegirma so'rash namunasi.$$,
   $$3 xil hajm uchun narx so'rang va javoblarni jadvalga yozing.$$),
  (8, 3, 4, $$Tarjima va foydali xitoycha iboralar$$, $$5 daq$$,
   $$DeepL va Google Translate bilan ishlash. Tarjima ma'noni buzmasligi uchun qanday yozish kerak.$$,
   $$Xabaringizni tarjima qiling va teskari tarjima bilan tekshiring.$$),

  (9, 4, 1, $$Qizil bayroqlar$$, $$5 daq$$,
   $$Ishonchsiz sotuvchining 6 belgisi: juda past narx, shoshirish, shaxsiy kartaga to'lov, litsenziya yo'qligi, videodan bosh tortish, nomlar mos kelmasligi.$$,
   $$Sotuvchilaringizni ro'yxat bo'yicha tekshiring.$$),
  (10, 4, 2, $$Kompaniyani tekshirish: litsenziya va reestr$$, $$8 daq$$,
   $$Biznes litsenziyasi (营业执照), Qichacha va Tianyancha'da tekshirish, manzilni xaritada ko'rish, fabrika bilan video qo'ng'iroq.$$,
   $$Tanlagan sotuvchingizni 5 qadam bo'yicha tekshiring.$$),
  (11, 4, 3, $$Mashhur firibgarlik sxemalari$$, $$6 daq$$,
   $$Soxta fabrika, «hozir to'lang» bosimi, yaxshi namuna va yomon partiya, hisob raqamini almashtirish, oldindan to'lov olib yo'qolish.$$,
   $$Namuna yozishmani ko'rib chiqing va firibgarlik belgilarini toping.$$),

  (12, 5, 1, $$Buyurtmani rasmiylashtirish va nakladnoy (PI)$$, $$7 daq$$,
   $$Buyurtmani qanday yozish kerak: model, o'lcham, rang, soni, narx. Nakladnoy (PI) so'rash va uni tekshirish.$$,
   $$Sotuvchidan nakladnoy oling va uni buyurtmangiz bilan solishtiring.$$),
  (13, 5, 2, $$MYPOST orqali to'lov$$, $$6 daq$$,
   $$MYPOST'ga nimalarni yuborish kerak va pul O'zbekistondagi ofisga qanday topshiriladi. Sotuvchi to'lovni to'g'ridan-to'g'ri so'rasa, nima deyish kerak.$$,
   $$Chek-list bo'yicha MYPOST uchun hujjatlar to'plamini tayyorlang.$$),
  (14, 5, 3, $$Namuna buyurtma qilish$$, $$5 daq$$,
   $$Partiyadan oldin namuna nima uchun kerak, uni MYPOST orqali qanday buyurtma qilish va partiya bilan qanday solishtirish.$$,
   $$Namunada nimalarni tekshirish kerakligini ro'yxat qiling.$$),

  (15, 6, 1, $$Tekshiruv va O'zbekistonga yetkazish$$, $$7 daq$$,
   $$MYPOST tovarni Xitoyda qanday tekshiradi, qanday talablarni yozma berish kerak, yetkazish muddatlari.$$,
   $$Tovaringiz tekshiruvi uchun 3 ta asosiy talabni yozing.$$),
  (16, 6, 2, $$Tovarni qabul qilish va muammolar$$, $$5 daq$$,
   $$Tovarni nakladnoy bilan solishtirish, qadoqni ochishni videoga olish, nuqson yoki kamomad bo'lsa nima qilish kerak.$$,
   $$Qabul qilish chek-listini saqlab qo'ying.$$),

  (17, 7, 1, $$Yakuniy chek-list va amaliy topshiriq$$, $$5 daq$$,
   $$Butun yo'lni chek-list bo'yicha takrorlaymiz. Keyin nima qilish va MYPOST menejeri bilan qanday bog'lanish.$$,
   $$Yetkazib beruvchini toping, tekshiring, narxni kelishing, nakladnoy oling va MYPOST'ga yuboring.$$)
on conflict (id) do nothing;

-- 6. Счётчики, чтобы новые модули и уроки из админки получали следующие номера.
select setval(pg_get_serial_sequence('modules', 'id'), (select coalesce(max(id), 1) from modules));
select setval(pg_get_serial_sequence('lessons', 'id'), (select coalesce(max(id), 1) from lessons));
