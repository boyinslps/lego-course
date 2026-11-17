/* 樂高競賽課程 共用引擎（改自 robot-course 的引擎）
   功能：步驟分頁、#teacher 老師模式、身分列（隊伍＋班級＋座號）、筆記本儲存（localStorage ＋ Firebase）、
         先猜框、檢核條、闖關測驗（選完立刻顯示對錯、答對才解鎖）、跨堂帶值（data-from）、列印、老師計時器。
   這個系列沒有「分享＋收納」步驟。  made by 資訊老師黃博胤 */
(function () {
  'use strict';
  var body = document.body;
  var LESSON = body.dataset.lesson || 'L00';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- 積木／Python 模式：data-mode="block|py" 的內容只在對應模式顯示 ---------- */
  var MODE = 'block';
  try { var qm = /[?&]mode=(py|block)/.exec(location.search); MODE = qm ? qm[1] : (localStorage.getItem('lc.mode') === 'py' ? 'py' : 'block'); if (qm) localStorage.setItem('lc.mode', MODE); } catch (e) { }
  body.classList.toggle('mode-py', MODE === 'py');
  function inMode(el) { var m = el.closest('[data-mode]'); return !m || m.dataset.mode === MODE; }
  function attr(s, name) { var v = MODE === 'py' ? s.dataset[name + 'Py'] : null; return v != null ? v : s.dataset[name]; }
  function qsOf(s) { return $$('.q', s).filter(inMode); }

  /* ---------- SVG 圖示 ---------- */
  var ICONS = {
    box: '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 7l9 4 9-4M12 11v10" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    intro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5M12 7.5v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    task: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/><circle cx="17" cy="18" r="2.2" fill="currentColor"/><path d="M8 9V6h8v3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    rec: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    quiz: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  // 主機（頁首用）：5×5 燈陣、電源鍵、黃色側邊
  var HUB = '<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect x="18" y="8" width="84" height="134" rx="10" fill="#facc15"/><rect x="26" y="6" width="68" height="134" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>' +
    '<circle cx="82" cy="22" r="6" fill="none" stroke="#7dd3fc" stroke-width="3"/>' +
    '<g fill="#fde68a">' + (function () { var s = ''; for (var y = 0; y < 5; y++) for (var x = 0; x < 5; x++) s += '<rect x="' + (38 + x * 10) + '" y="' + (44 + y * 10) + '" width="7" height="7" rx="1.5"' + ((x + y) % 2 ? ' fill="#facc15"' : '') + '/>'; return s; })() + '</g>' +
    '<circle cx="60" cy="116" r="10" fill="#fff" stroke="#94a3b8" stroke-width="2"/>' +
    '<g stroke="#64748b" stroke-width="2" fill="none" stroke-linecap="round"><path d="M38 116l-5 0M82 116l5 0"/></g>' +
    '</svg>';
  var TYPE_NAME = { box: '領箱點收', intro: '認識', task: '動手做', rec: '記錄', quiz: '闖關' };

  /* ---------- 網址 hash：#teacher/s3 ---------- */
  function parseHash() {
    var t = location.hash.replace(/^#/, '').split('/').filter(Boolean), r = { teacher: false, step: null };
    t.forEach(function (x) { if (x === 'teacher') r.teacher = true; var m = /^s(\d+)$/.exec(x); if (m) r.step = +m[1]; });
    return r;
  }
  function writeHash(step) {
    var h = parseHash(), parts = [];
    if (h.teacher) parts.push('teacher');
    if (step != null) parts.push('s' + step);
    var nh = '#' + parts.join('/');
    if (location.hash !== nh) history.replaceState(null, '', nh || location.pathname);
  }

  /* ---------- 身分與儲存 ---------- */
  var identity = { team: '', cls: '', seat: '' };
  try { identity = Object.assign(identity, JSON.parse(localStorage.getItem('lc.identity') || '{}')); } catch (e) { }
  function clean(x) { return (x == null ? '' : String(x)).trim().replace(/[\/\.\#\$\[\]\s]/g, ''); }
  function studentKey() {
    var t = clean(identity.team), c = clean(identity.cls), s = clean(identity.seat);
    return (t && c && s) ? (t + '_' + c + '_' + s) : '_guest';
  }
  var state = {}, meta = { updatedAt: 0 };
  function lsKey() { return 'lc.' + LESSON + '.' + studentKey(); }
  function loadLocal() {
    state = {}; meta = { updatedAt: 0 };
    try { var o = JSON.parse(localStorage.getItem(lsKey()) || 'null'); if (o && o.data) { state = o.data; meta.updatedAt = o.updatedAt || 0; } } catch (e) { }
  }
  function saveLocal() {
    try { localStorage.setItem(lsKey(), JSON.stringify({ data: state, updatedAt: meta.updatedAt })); } catch (e) { }
  }
  var saveTimer = null;
  function setVal(k, v) {
    state[k] = v; meta.updatedAt = Date.now(); saveLocal();
    clearTimeout(saveTimer); saveTimer = setTimeout(cloudSave, 700);
    refreshDone(); mirror();
  }
  /* 同一堂內把某格的值顯示在別處：<span data-mirror="port.motor" data-empty="還沒填"></span> */
  function mirror() {
    $$('[data-mirror]').forEach(function (el) {
      var v = state[el.dataset.mirror];
      if (v == null || v === '') { el.textContent = el.dataset.empty || '（還沒填）'; el.classList.add('from', 'empty'); }
      else { el.textContent = v; el.classList.remove('empty'); el.classList.add('from'); }
    });
  }
  window.LC = { get: function (k) { return state[k]; }, set: setVal, state: function () { return state; }, lesson: LESSON, studentKey: studentKey };

  /* 讀別堂的值（data-from="L03:key"） */
  function readOther(lesson, key, cb) {
    var v;
    try { var o = JSON.parse(localStorage.getItem('lc.' + lesson + '.' + studentKey()) || 'null'); if (o && o.data) v = o.data[key]; } catch (e) { }
    if (v != null && v !== '') return cb(v);
    if (fb.db && studentKey() !== '_guest') {
      fb.db.collection('legocourse').doc(studentKey()).collection('lessons').doc(lesson).get().then(function (d) {
        var o = d.exists ? d.data() : null; cb(o && o.data ? o.data[key] : undefined);
      }).catch(function () { cb(undefined); });
    } else cb(undefined);
  }
  function fillFrom() {
    $$('[data-from]').forEach(function (el) {
      var p = el.dataset.from.split(':'); if (p.length < 2) return;
      el.classList.add('from');
      readOther(p[0], p[1], function (v) {
        if (v == null || v === '') { el.textContent = el.dataset.empty || '（上次沒有記錄）'; el.classList.add('empty'); }
        else { el.textContent = v; el.classList.remove('empty'); }
      });
    });
  }

  /* ---------- Firebase（assets/firebase-config.js 設定了才載入） ---------- */
  var fb = { db: null, uid: null, status: 'off' };
  var cloudChip;
  function setCloud(st, txt) { fb.status = st; if (!cloudChip) return; if (!window.LC_FIREBASE) { cloudChip.style.display = 'none'; return; } cloudChip.className = 'chip ' + (st === 'ok' ? 'ok' : st === 'err' ? 'err' : 'warn'); cloudChip.textContent = txt; }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function initFirebase() {
    var cfg = window.LC_FIREBASE;
    if (!cfg) { setCloud('warn', '只存在這台電腦'); return; }
    if (!navigator.onLine) { setCloud('warn', '離線：只存在這台電腦'); return; }
    var v = '10.14.1', base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    loadScript(base + 'firebase-app-compat.js').then(function () { return loadScript(base + 'firebase-auth-compat.js'); })
      .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); })
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        var auth = firebase.auth(); fb.db = firebase.firestore();
        var handled = false, unsub = auth.onAuthStateChanged(function (u) {
          if (handled) return; handled = true; if (unsub) unsub();
          if (u) onAuthed(u); else auth.signInAnonymously().then(function (c) { onAuthed(c.user); }).catch(function () { setCloud('err', '雲端登入失敗'); });
        });
      }).catch(function () { setCloud('warn', '雲端載不到：只存在這台電腦'); });
  }
  function onAuthed(u) { fb.uid = u.uid; cloudLoad(); }
  function docRef() { return fb.db.collection('legocourse').doc(studentKey()).collection('lessons').doc(LESSON); }
  function cloudLoad() {
    if (!fb.db || studentKey() === '_guest') { setCloud('warn', '填隊伍、班級、座號才會存到雲端'); return; }
    setCloud('warn', '連線中…');
    var askKey = studentKey();
    docRef().get().then(function (d) {
      if (askKey !== studentKey()) return;   // 回來時已經換了身分，這份資料丟掉
      if (d.exists) {
        var o = d.data() || {}, cd = o.data || {}, cu = o.updatedAtMs || 0, changed = false;
        Object.keys(cd).forEach(function (k) { if (!(k in state) || (cu > meta.updatedAt && state[k] !== cd[k])) { state[k] = cd[k]; changed = true; } });
        if (changed) { saveLocal(); bindAll(true); mirror(); }
      }
      setCloud('ok', '已存到雲端'); cloudSave(); refreshDone();
    }).catch(function () { setCloud('err', '雲端讀取失敗（規則未開？）'); });
  }
  function cloudSave() {
    if (!fb.db || !fb.uid || studentKey() === '_guest') return;
    docRef().set({ data: state, team: identity.team || '', cls: identity.cls || '', seat: identity.seat || '', lesson: LESSON, uid: fb.uid, updatedAtMs: meta.updatedAt || Date.now(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .then(function () { setCloud('ok', '已存到雲端'); }).catch(function () { setCloud('err', '雲端寫入失敗（規則未開？）'); });
  }

  /* ---------- 綁定輸入 ---------- */
  function bindAll(reapply) {
    $$('[data-key]').forEach(function (el) {
      var k = el.dataset.key, tag = el.tagName;
      if (el.classList.contains('guess')) { bindGuess(el, reapply); return; }
      if (el.classList.contains('q')) { bindQuiz(el, reapply); return; }
      if (tag === 'INPUT' && el.type === 'checkbox') {
        el.checked = !!state[k]; el.closest('.chk') && el.closest('.chk').classList.toggle('on', el.checked);
        if (!el.__b) { el.__b = 1; el.addEventListener('change', function () { setVal(k, el.checked); el.closest('.chk') && el.closest('.chk').classList.toggle('on', el.checked); }); }
      } else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (state[k] != null) el.value = state[k]; else if (reapply) el.value = '';
        if (!el.__b) { el.__b = 1; el.addEventListener('input', function () { setVal(k, el.value); }); el.addEventListener('change', function () { setVal(k, el.value); }); }
      }
    });
  }
  function bindGuess(g, reapply) {
    var k = g.dataset.key, after = $('.guess-after', g), why = $('.guess-why', g), opts = $$('.guess-opts button', g), rev = $('.guess-reveal', g);
    function apply() {
      opts.forEach(function (b) { b.classList.toggle('on', state[k] === b.dataset.v); });
      if (after) after.hidden = !state[k];
      if (why) why.hidden = !state[k + '.r'];
    }
    if (!g.__b) {
      g.__b = 1;
      opts.forEach(function (b) { b.addEventListener('click', function () { setVal(k, b.dataset.v); apply(); }); });
      if (rev) rev.addEventListener('click', function () { setVal(k + '.r', true); apply(); });
    }
    apply();
  }

  /* ---------- 闖關測驗 ----------
     <div class="q" data-key="qa1"><p class="q-t">題目</p>
       <div class="opts"><button type="button" data-ok="1" data-fb="為什麼對">選項</button><button type="button" data-fb="提示">選項</button></div>
       <p class="fb" hidden></p></div>
     選完立刻顯示：答對 → 綠色＋原因，鎖住；答錯 → 橘色＋提示，可以再選，不扣分。
     step 上寫 data-gate：這一步所有 .q 都答對，才能進下一步。 */
  function fbHtml(s) { return esc(s || '').replace(/&lt;(\/?)code&gt;/g, '<$1code>'); }
  function bindQuiz(q, reapply) {
    var k = q.dataset.key, opts = $$('.opts button', q), fbEl = $('.fb', q);
    function showSolved() {
      var ok = opts.filter(function (b) { return b.dataset.ok; })[0];
      opts.forEach(function (b) { b.classList.remove('bad'); b.classList.toggle('good', b === ok); b.disabled = true; });
      fbEl.hidden = false; fbEl.className = 'fb good'; fbEl.innerHTML = '✔ 答對了：' + (ok ? fbHtml(ok.dataset.fb) : '');
      q.classList.add('solved');
    }
    function reset() { opts.forEach(function (b) { b.classList.remove('good', 'bad'); b.disabled = false; }); fbEl.hidden = true; q.classList.remove('solved'); }
    if (!q.__b) {
      q.__b = 1;
      opts.forEach(function (b) {
        b.addEventListener('click', function () {
          if (q.classList.contains('solved')) return;
          var n = (+state[k + '.n'] || 0) + 1; state[k + '.n'] = n;
          if (b.dataset.ok) { setVal(k, 1); showSolved(); }
          else { b.classList.add('bad'); b.disabled = true; fbEl.hidden = false; fbEl.className = 'fb bad'; fbEl.innerHTML = '✘ 再想想：' + fbHtml(b.dataset.fb); setVal(k + '.n', n); }
          updateQuizState();
        });
      });
    }
    if (state[k]) showSolved(); else if (reapply) reset();
  }
  function quizSolved(s) { var qs = qsOf(s); return qs.every(function (q) { return !!state[q.dataset.key]; }); }
  function updateQuizState() {
    $$('.quiz-state').forEach(function (el) {
      var s = el.closest('.step'), qs = qsOf(s), n = qs.filter(function (q) { return !!state[q.dataset.key]; }).length;
      el.textContent = n === qs.length ? '✔ 這一關全部過了' : '已答對 ' + n + ' / ' + qs.length + ' 題';
      el.classList.toggle('ok', n === qs.length);
    });
    $$('.unlock').forEach(function (el) { var s = el.closest('.step'); el.hidden = !quizSolved(s) && !body.classList.contains('teacher'); });
  }

  /* ---------- 步驟 ---------- */
  var steps = $$('.step'), cur = 0, nav, visited = {};
  /* 完成＝檢核全勾、測驗全對，而且（有填寫格時）至少一半有內容；純閱讀步走過就算 */
  function stepDone(i) {
    var s = steps[i], boxes = $$('input[type=checkbox][data-key]', s).filter(inMode), qs = qsOf(s);
    var ins = $$('input[data-key]:not([type=checkbox]):not([type=hidden]):not([data-optional]),textarea[data-key]:not([data-optional]),select[data-key]:not([data-optional])', s).filter(inMode);
    if (!boxes.length && !ins.length && !qs.length) return !!(visited[i] || state['v' + i]);
    var okBox = boxes.every(function (b) { return b.checked; });
    var okIn = !ins.length || ins.filter(function (x) { return (x.value || '').trim(); }).length >= Math.ceil(ins.length / 2);
    var okQ = quizSolved(s);
    return okBox && okIn && okQ;
  }
  /* 有 data-gate 的步驟，測驗沒全對就擋住後面的步驟（老師模式不擋） */
  function maxOpen() {
    if (body.classList.contains('teacher')) return steps.length - 1;
    for (var i = 0; i < steps.length; i++) if (steps[i].hasAttribute('data-gate') && !quizSolved(steps[i])) return i;
    return steps.length - 1;
  }
  /* 進度列依「環節」分組：同一個 data-part 的幾頁（說明／官方／小測驗）合成一顆圓點；
     圓點不縮小、名稱 ≤ 4 字。環節裡的幾頁用頁內的小分頁切換。 */
  var groups = [], starCount = 0, booted = false, toastTimer = null;
  function groupOf(i) { return groups.filter(function (g) { return g.idx.indexOf(i) >= 0; })[0]; }
  function quizGroups() { return groups.filter(function (g) { return g.idx.some(function (i) { return qsOf(steps[i]).length; }); }); }
  function groupStarred(g) { return g.idx.every(function (i) { return quizSolved(steps[i]); }); }
  function toast(msg) {
    var t = $('#lc-toast'); if (!t) { t = document.createElement('div'); t.id = 'lc-toast'; t.setAttribute('role', 'status'); body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function refreshDone() {
    if (!nav) return;
    var mo = maxOpen();
    groups.forEach(function (g) {
      var b = g.btn, done = g.idx.every(stepDone);
      b.classList.toggle('done', done); b.classList.toggle('locked', g.idx[0] > mo); b.disabled = g.idx[0] > mo;
      if (g.idx.indexOf(cur) >= 0) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    $$('.subnav button').forEach(function (b) {
      var i = +b.dataset.i; b.disabled = i > mo; b.classList.toggle('on', i === cur); b.classList.toggle('done', stepDone(i));
      if (i === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    steps.forEach(function (s, i) { var nx = $('.stepfoot .next', s); if (nx && i < steps.length - 1) { nx.disabled = i + 1 > mo; nx.title = i + 1 > mo ? '先把這一關的題目都答對' : ''; } });
    var qg = quizGroups(), n = qg.filter(groupStarred).length;
    var st = $('#stars'); if (st) { st.textContent = '★ ' + n + '／' + qg.length; st.classList.toggle('all', n === qg.length && n > 0); }
    if (booted && n > starCount) toast(n === qg.length ? '拿到第 ' + n + ' 顆星，全部通過了' : '拿到第 ' + n + ' 顆星');
    if (!booted) starCount = n;
    starCount = n;
    updateQuizState();
  }
  function go(i, noScroll) {
    if (!steps.length) return;
    cur = Math.max(0, Math.min(steps.length - 1, i));
    var mo = maxOpen(); if (cur > mo) cur = mo;
    visited[cur] = true;
    if (!state['v' + cur]) { state['v' + cur] = 1; saveLocal(); }   // 純閱讀頁走過就記下來，重新整理後 ✓ 還在
    steps.forEach(function (s, k) { s.hidden = k !== cur; });
    writeHash(cur + 1); refreshDone();
    if (!noScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    try { document.dispatchEvent(new CustomEvent('lc:stepchange', { detail: { index: cur } })); } catch (e) { }
  }
  function buildSteps() {
    if (!steps.length) return;
    nav = document.createElement('nav'); nav.className = 'stepnav'; nav.setAttribute('aria-label', '步驟');
    var ol = document.createElement('ol');
    var total = 0, byKey = {};
    steps.forEach(function (s, i) {
      var key = s.dataset.part || ('s' + i), min = +attr(s, 'min') || 0;
      total += min;
      if (!byKey[key]) { byKey[key] = { key: key, idx: [], min: 0, type: s.dataset.type || 'task', color: s.dataset.color || '', label: s.dataset.part || s.dataset.title || ('第 ' + (i + 1) + ' 步') }; groups.push(byKey[key]); }
      byKey[key].idx.push(i); byKey[key].min += min;
      if (s.dataset.color) s.style.setProperty('--sc', s.dataset.color);
    });
    groups.forEach(function (g, gi) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.style.setProperty('--sc', g.color || ('var(--c-' + g.type + ')'));
      b.innerHTML = '<i>' + (gi + 1) + '</i><span>' + esc(g.label) + '</span>';
      b.title = g.label + '（約 ' + g.min + ' 分鐘）';
      b.setAttribute('aria-label', '第 ' + (gi + 1) + ' 項：' + g.label);
      b.onclick = function () { var first = g.idx.filter(function (i) { return !stepDone(i); })[0]; go(first != null ? first : g.idx[0]); };
      g.btn = b; li.appendChild(b); ol.appendChild(li);
    });
    steps.forEach(function (s, i) {
      var type = s.dataset.type || 'task', title = attr(s, 'title') || ('第 ' + (i + 1) + ' 步'), g = groupOf(i);
      var h = document.createElement('div'); h.className = 'step-h';
      h.innerHTML = '<span class="tag">' + (ICONS[type] || '') + ' ' + esc(TYPE_NAME[type] || type) + '</span><h2>' + esc(title) + '</h2>';
      s.insertBefore(h, s.firstChild);
      if (g.idx.length > 1) {
        var sn = document.createElement('div'); sn.className = 'subnav'; sn.setAttribute('aria-label', g.label + '的頁面');
        g.idx.forEach(function (j, k) {
          var c = document.createElement('button'); c.type = 'button'; c.dataset.i = j;
          c.innerHTML = '<i>' + (k + 1) + '</i>' + esc(attr(steps[j], 'sub') || ('第 ' + (k + 1) + ' 頁'));
          c.onclick = function () { go(j); }; sn.appendChild(c);
        });
        s.insertBefore(sn, h.nextSibling);
      }
      var f = document.createElement('div'); f.className = 'stepfoot';
      var prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '← 上一步'; prev.disabled = i === 0; prev.onclick = function () { go(i - 1); };
      var next = document.createElement('button'); next.type = 'button'; next.className = 'next';
      if (i < steps.length - 1) { next.textContent = '下一步：' + (attr(steps[i + 1], 'title') || '') + ' →'; next.onclick = function () { go(i + 1); }; }
      else { next.textContent = '回到課程目錄'; next.onclick = function () { location.href = '../index.html'; }; }
      f.appendChild(prev); f.appendChild(next); s.appendChild(f);
    });
    nav.appendChild(ol);
    var stars = document.createElement('span'); stars.id = 'stars'; stars.className = 'stars'; stars.title = '每個小測驗全對，拿一顆星'; nav.appendChild(stars);
    var first = steps[0]; first.parentNode.insertBefore(nav, first);
    var hh = parseHash(); go(hh.step ? hh.step - 1 : 0, true);
    recalcMin();
  }
  function recalcMin() {
    var total = 0;
    groups.forEach(function (g) { g.min = 0; g.idx.forEach(function (i) { g.min += +attr(steps[i], 'min') || 0; }); total += g.min; if (g.btn) g.btn.title = g.label + '（約 ' + g.min + ' 分鐘）'; });
    var tt = $('#total-min'); if (tt) tt.textContent = total;
  }
  /* 切換積木／Python：換標題、小分頁名稱、下一步文字、分鐘數，再重算鎖定 */
  function setMode(m) {
    MODE = m; try { localStorage.setItem('lc.mode', m); } catch (e) { }
    body.classList.toggle('mode-py', m === 'py');
    $$('.modesw button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === m ? 'true' : 'false'); b.classList.toggle('on', b.dataset.m === m); });
    steps.forEach(function (s, i) {
      var h = $('.step-h h2', s); if (h) h.textContent = attr(s, 'title') || ('第 ' + (i + 1) + ' 步');
      var nx = $('.stepfoot .next', s); if (nx && i < steps.length - 1) nx.textContent = '下一步：' + (attr(steps[i + 1], 'title') || '') + ' →';
    });
    $$('.subnav button').forEach(function (b) { var j = +b.dataset.i, k = $('i', b); b.innerHTML = '<i>' + (k ? k.textContent : '') + '</i>' + esc(attr(steps[j], 'sub') || ''); });
    recalcMin(); refreshDone(); go(cur, true);
  }

  /* ---------- 圖片點開放大（Esc 關閉） ---------- */
  function bindZoom() {
    document.addEventListener('click', function (e) {
      var im = e.target.closest && e.target.closest('img.zoom'); if (!im) return;
      var ov = document.createElement('div'); ov.className = 'zoom-ov'; ov.innerHTML = '<img alt="">'; $('img', ov).src = im.src; ov.setAttribute('role', 'dialog');
      function close() { ov.remove(); document.removeEventListener('keydown', key); }
      function key(ev) { if (ev.key === 'Escape') close(); }
      ov.addEventListener('click', close); document.addEventListener('keydown', key); body.appendChild(ov);
    });
  }

  /* ---------- 身分列：隊伍＋班級＋座號 ---------- */
  function buildIdBar() {
    var bar = $('.idbar'); if (!bar) return;
    bar.innerHTML = '<label>隊伍 <select id="id-team"><option value=""></option><option value="隊伍一">隊伍一</option><option value="隊伍二">隊伍二</option></select></label>' +
      '<label>班級 <input id="id-cls" class="n" inputmode="numeric" maxlength="4"></label>' +
      '<label>座號 <input id="id-seat" class="n" inputmode="numeric" maxlength="3"></label>' +
      '<span class="chip" id="cloud-chip">…</span>' +
      '<span class="timer"><button class="sm" id="tm-btn" type="button">開始計時</button><b id="tm-txt">00:00</b><span id="tm-hint"></span></span>' +
      '<span class="modesw" role="group" aria-label="用積木或 Python"><button type="button" data-m="block">積木</button><button type="button" data-m="py">Python</button></span>' +
      '<span class="btns"><button class="sm" id="btn-print" type="button">列印學習單</button><button class="sm" id="btn-teacher" type="button">老師模式</button></span>';
    cloudChip = $('#cloud-chip');
    var ti = $('#id-team'), ci = $('#id-cls'), si = $('#id-seat');
    ti.value = identity.team || ''; ci.value = identity.cls || ''; si.value = identity.seat || '';
    function changed() {
      var wasGuest = studentKey() === '_guest', guestState = wasGuest ? Object.assign({}, state) : null;
      identity.team = ti.value.trim(); identity.cls = ci.value.replace(/\D/g, ''); identity.seat = si.value.replace(/\D/g, '');
      try { localStorage.setItem('lc.identity', JSON.stringify(identity)); } catch (e) { }
      loadLocal();
      // 還沒填身分就先做的內容，第一次填身分時併過來（不蓋掉已有的）
      if (guestState && studentKey() !== '_guest') { Object.keys(guestState).forEach(function (k) { if (!(k in state)) state[k] = guestState[k]; }); if (Object.keys(guestState).length) { meta.updatedAt = Date.now(); saveLocal(); } }
      var wasBooted = booted; booted = false;
      bindAll(true); fillFrom(); mirror(); go(cur, true); booted = wasBooted;
      if (fb.db) cloudLoad(); else if (studentKey() === '_guest') setCloud('warn', '填隊伍、班級、座號才會存到雲端');
    }
    [ti, ci, si].forEach(function (x) { x.addEventListener('change', changed); });
    [ci, si].forEach(function (x) { x.addEventListener('input', function () { x.value = x.value.replace(/\D/g, ''); }); });
    $$('.modesw button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === MODE ? 'true' : 'false'); b.classList.toggle('on', b.dataset.m === MODE); b.onclick = function () { if (b.dataset.m !== MODE) setMode(b.dataset.m); }; });
    $('#btn-print').onclick = function () { window.print(); };
    $('#btn-teacher').onclick = function () {
      var h = parseHash();
      if (h.teacher) { location.hash = h.step ? '#s' + h.step : ''; }
      else { var pw = prompt('老師模式密碼（只是避免學生誤按，不是保密）'); if (pw === (window.LC_TEACHER_PW || '1234')) location.hash = '#teacher' + (h.step ? '/s' + h.step : ''); }
    };
    // 計時器（老師模式才顯示）
    var t0 = null, tick;
    $('#tm-btn').onclick = function () {
      if (t0) { t0 = null; clearInterval(tick); $('#tm-btn').textContent = '開始計時'; $('#tm-txt').textContent = '00:00'; $('#tm-hint').textContent = ''; return; }
      t0 = Date.now(); $('#tm-btn').textContent = '停止';
      tick = setInterval(function () {
        var s = Math.floor((Date.now() - t0) / 1000), m = Math.floor(s / 60);
        $('#tm-txt').textContent = (m < 10 ? '0' : '') + m + ':' + ((s % 60) < 10 ? '0' : '') + (s % 60);
        var acc = 0, idx = steps.length - 1;
        for (var i = 0; i < steps.length; i++) { acc += +attr(steps[i], 'min') || 0; if (m < acc) { idx = i; break; } }
        var g = groupOf(idx); $('#tm-hint').textContent = '建議進度：第 ' + (groups.indexOf(g) + 1) + ' 項「' + (g ? g.label : '') + '」';
      }, 1000);
    };
  }

  /* ---------- 老師模式 ---------- */
  function applyTeacher() {
    var h = parseHash(); body.classList.toggle('teacher', h.teacher);
    var b = $('#btn-teacher'); if (b) b.textContent = h.teacher ? '離開老師模式' : '老師模式';
    refreshDone();
    if (h.step && h.step - 1 !== cur) go(h.step - 1); else go(cur, true);   // 離開老師模式時，停在被鎖的頁就退回
  }

  /* ---------- 程式卡的「複製」按鈕 ---------- */
  function bindCopy() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.copybtn'); if (!b) return;
      var code = $('code', b.closest('.codewrap')), txt = code ? code.textContent : '';
      function ok() { b.textContent = '已複製'; setTimeout(function () { b.textContent = '複製'; }, 1500); }
      function fallback() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (x) { } body.removeChild(ta); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
    });
  }

  /* ---------- 署名 ---------- */
  function sig() { $$('.hub-slot').forEach(function (s) { if (!s.innerHTML.trim()) s.innerHTML = HUB; }); if (!$('.sig')) { var d = document.createElement('div'); d.className = 'sig'; d.textContent = 'made by 資訊老師黃博胤'; body.appendChild(d); } }

  /* ---------- 啟動 ---------- */
  function boot() {
    body.classList.toggle('teacher', parseHash().teacher);   // 老師模式要在建步驟前就生效，才不會被測驗鎖住
    loadLocal(); buildIdBar(); buildSteps(); bindAll(); fillFrom(); mirror(); applyTeacher(); sig(); bindZoom(); bindCopy(); setMode(MODE); refreshDone(); booted = true;
    window.addEventListener('hashchange', applyTeacher);
    initFirebase();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
