(function () {
  const R = window.RULES, COURSES = window.COURSES;
  const KEY = 'kmla-credit-checker-v1';
  const SEM = ['1학년 1학기', '1학년 2학기', '2학년 1학기', '2학년 2학기', '3학년 1학기', '3학년 2학기'];
  const $ = id => document.getElementById(id);
  const byId = Object.fromEntries(COURSES.map(c => [c.id, c]));
  const gname = Object.fromEntries(R.groups.map(g => [g.key, g.label]));

  // state.sel: { "courseId@sem": credit }   state.cc: { year: true }
  const allCC = () => Object.fromEntries(R.creative.map(x => [x.year, true]));   // 창체는 기본적으로 모두 이수로 표시
  let state = { sel: {}, cc: allCC(), sem: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.sel) state = Object.assign(state, s); } catch (e) {}
  if (!state.ccInit) { state.cc = allCC(); state.ccInit = true; }   // 이전 저장값에도 한 번 적용
  const userOpen = {};   // 교과군 접힘 상태(화면 전환 간 유지, 저장은 안 함)
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  // 학점은 항상 개설 과목표(offerings.js) 기준으로 계산 — 저장값은 선택 여부만 의미
  const entries = () => Object.keys(state.sel).map(k => {
    const [id, sem] = k.split('@'); const c = byId[id];
    return c ? { c, sem: +sem, credit: defCredit(c, +sem) } : null;
  }).filter(Boolean);

  function takenSem(id) {   // 반복 불가 과목이 선택된 학기
    for (const k in state.sel) { const [i, s] = k.split('@'); if (i === id) return +s; }
    return -1;
  }
  const norm = s => s.replace(/\s+/g, '');
  const byName = Object.fromEntries(COURSES.map(c => [norm(c.name), c]));
  // 학기별 개설 과목: { sem: Map(courseId -> 단위) }
  const offered = {};
  Object.entries(window.OFFERINGS || {}).forEach(([sem, list]) => {
    const m = new Map();
    list.forEach(([name, cr]) => {
      const c = byName[norm((window.OFFERING_ALIAS || {})[name] || name)];
      if (c) m.set(c.id, cr); else console.warn('개설 과목을 과목목록에서 찾지 못함:', name);
    });
    offered[sem] = m;
  });
  const defCredit = (c, sem) => (offered[sem] && offered[sem].get(c.id)) ??
    (c.semCredits ? c.semCredits[sem] : c.credit);

  // '공통' 표시 과목은 개설 과목표가 있는 학기에 처음 들어갈 때 자동 선택(제2외국어·정보는 제외).
  // 한 번 적용한 학기는 다시 건드리지 않으므로 학생이 해제해도 유지됩니다.
  function applyAuto() {
    state.auto = state.auto || {};
    Object.keys(offered).forEach(sem => {
      if (state.auto[sem]) return;
      state.auto[sem] = true;
      offered[sem].forEach((cr, id) => {
        const c = byId[id];
        if (c.level !== '공통' || c.sub) return;
        if (!c.repeat && takenSem(id) >= 0) return;
        state.sel[id + '@' + sem] = cr;
      });
    });
    save();
  }
  applyAuto();

  /* ---------- 계산 ---------- */
  function calc() {
    const E = entries();
    const g = {}, semTot = [0, 0, 0, 0, 0, 0];
    R.groups.forEach(x => { g[x.key] = 0; });
    let subject = 0;
    E.forEach(({ c, sem, credit }) => {
      subject += credit; semTot[sem] += credit; g[c.group] += credit;
    });
    const creative = R.creative.reduce((s, x) => s + (state.cc[x.year] ? x.credit : 0), 0);
    return { g, semTot, subject, creative, all: subject + creative };
  }

  function requirements(m) {
    const out = [];
    const sec = 'all';
    const add = (t, ok, cur, goal, d, kind) => out.push({ t, ok, cur, goal, d, kind, sec });
    add('전체 교과 이수 학점', m.subject >= R.totalSubject, m.subject, R.totalSubject,
      m.subject >= R.totalSubject ? `${m.subject}학점 이수` : `<b>${R.totalSubject - m.subject}학점</b> 더 필요`);
    add('교과 + 창의적 체험활동', m.all >= R.totalAll, m.all, R.totalAll,
      m.all >= R.totalAll ? `${m.all}학점 이수` : `<b>${R.totalAll - m.all}학점</b> 더 필요 (창체 ${m.creative}/${R.creativeTotal})`);
    R.groups.forEach(x => {
      const cur = m.g[x.key], ok = cur >= x.min;
      add(`${x.label} 최소 ${x.min}학점`, ok, cur, x.min, ok ? `${cur}학점 이수` : `<b>${x.min - cur}학점</b> 더 필요`);
    });
    const kme = R.kme.keys.reduce((s, k) => s + m.g[k], 0);
    const cap = R.kme.cap + Math.floor(Math.max(0, m.subject - R.totalSubject) * R.kme.excessRatio);
    add(`국·수·영 합계 ${R.kme.cap}학점 이하`, kme <= cap, kme, cap,
      kme <= cap ? `국·수·영 ${kme}학점 (허용 ${cap}학점)` : `허용 ${cap}학점보다 <b>${kme - cap}학점</b> 초과`, 'cap');
    return out;
  }

  /* ---------- 렌더 ---------- */
  function renderSummary(m, reqs) {
    const tile = (label, cur, goal, cap) => {
      const pct = Math.min(100, Math.round(cur / goal * 100));
      return `<div class="tile ${cur >= goal && !cap ? 'done' : ''}"><b>${label}</b>
        <div class="n">${cur}<small> / ${goal}</small></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    };
    $('sum').innerHTML = tile('전체 교과 이수 학점', m.subject, R.totalSubject) +
      tile('창의적 체험활동', m.creative, R.creativeTotal) + tile('총 이수 학점', m.all, R.totalAll);
    const bad = reqs.filter(r => !r.ok);
    $('final').innerHTML = bad.length === 0
      ? `<div class="final ok">모든 졸업 요건을 충족했습니다 🎉</div>`
      : `<div class="final no">미충족 요건 ${bad.length}개 · 아래 항목을 확인하세요</div>`;
    const row = r => {
      const pct = r.kind === 'cap' ? 100 : Math.min(100, Math.round(r.cur / r.goal * 100));
      return `<div class="req ${r.ok ? 'ok' : 'no'}"><div class="badge">${r.ok ? '✓' : '!'}</div>
        <div style="flex:1;min-width:0"><div class="t">${r.t}</div><div class="d">${r.d}</div>
        <div class="rbar"><i style="width:${pct}%"></i></div></div></div>`;
    };
    const box = (cls, title, sub, list) => {
      const n = list.filter(r => r.ok).length;
      return `<section class="rbox ${cls}"><div class="rhead"><div><h3>${title}</h3><p>${sub}</p></div>
        <span class="cnt ${n === list.length ? 'full' : ''}">${n}/${list.length}</span></div>${list.map(row).join('')}</section>`;
    };
    $('reqs').innerHTML =
      box('all', '전체(졸업을 위한) 이수학점', '교과·창체 총 학점과 교과(군)별 필수 이수 학점', reqs.filter(r => r.sec === 'all'));
  }

  function renderTabs(m) {
    $('tabs').innerHTML = SEM.map((s, i) => {
      const [y, h] = s.split(' ');
      return `<button data-i="${i}" class="${i === state.sem ? 'on' : ''}">${y}<br>${h}<small>${m.semTot[i]}학점</small></button>`;
    }).join('');
    $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { state.sem = +b.dataset.i; save(); renderAll(); });
  }

  function renderList() {
    const sem = state.sem, year = Math.floor(sem / 2) + 1, q = $('q').value.trim().toLowerCase();
    const min = R.semMin[sem];
    const off = offered[sem];
    $('semnote').textContent = off
      ? `${SEM[sem]} 개설 과목(${off.size}개) · 편제표 기준 학기당 교과 최소 ${min}학점`
      : `${SEM[sem]} · 개설 과목표가 아직 등록되지 않아 대상학년 기준 과목을 임시로 표시합니다 · 학기당 최소 ${min}학점`;
    const html = R.groups.map(gr => {
      const list = COURSES.filter(c => c.group === gr.key &&
        (off ? off.has(c.id)
             : c.grades.includes(year) && (c.semOnly == null || (c.semOnly === sem % 2 && year === 1))) &&
        (!q || c.name.toLowerCase().includes(q)));
      if (!list.length) return '';
      const picked = list.filter(c => state.sel[c.id + '@' + sem] != null);
      const sub = picked.reduce((s, c) => s + defCredit(c, sem), 0);
      const rows = list.map(c => {
        const k = c.id + '@' + sem, on = state.sel[k] != null;
        const other = !c.repeat ? takenSem(c.id) : -1;
        const dis = !on && other >= 0;
        return `<div class="course ${on ? 'sel' : ''} ${dis ? 'dis' : ''}">
          <label><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}>
          <span class="cname">${c.name}</span><span class="lv">${c.level}</span>
          ${dis ? `<span class="hint">${SEM[other]} 선택됨</span>` : ''}</label>
          <div class="cr"><span>${defCredit(c, sem)}학점</span></div>
        </div>`;
      }).join('');
      const ov = userOpen[gr.key];
      const open = ov != null ? ov : (q || picked.length || ['국어', '수학', '영어', '사회', '과학', '체육', '예술'].includes(gr.key));
      return `<details class="grp" data-g="${gr.key}" ${open ? 'open' : ''}>
        <summary>${gr.label}<span>${picked.length ? picked.length + '과목 · ' + sub + '학점' : ''}</span></summary>${rows}</details>`;
    }).join('');
    $('list').innerHTML = html || '<div class="empty">조건에 맞는 과목이 없습니다.</div>';
    $('list').querySelectorAll('details').forEach(d => d.ontoggle = () => { userOpen[d.dataset.g] = d.open; });
    $('list').querySelectorAll('input[type=checkbox]').forEach(i => i.onchange = () => {
      const k = i.dataset.k, [id, s] = k.split('@');
      if (i.checked) state.sel[k] = defCredit(byId[id], +s); else delete state.sel[k];
      save(); renderAll();
    });
  }

  function renderCC() {
    $('cc').innerHTML = R.creative.map(x =>
      `<label><input type="checkbox" data-y="${x.year}" ${state.cc[x.year] ? 'checked' : ''}> ${x.year}학년 창체 ${x.credit}학점</label>`).join('');
    $('cc').querySelectorAll('input').forEach(i => i.onchange = () => {
      state.cc[i.dataset.y] = i.checked; save(); renderAll();
    });
  }

  function renderAll() {
    const m = calc(), reqs = requirements(m);
    renderSummary(m, reqs); renderTabs(m); renderList(); renderCC();
  }

  $('q').oninput = renderList;
  $('fill1').onclick = () => {
    const names = ['공통국어', '공통수학', '공통영어', '한국사', '통합사회', '통합과학', '과학탐구실험'];
    [0, 1].forEach(sem => {
      COURSES.forEach(c => {
        const base = c.name.replace(/[12]$/, '');
        if ((names.includes(base) && c.semOnly === sem) ||
            ((c.id === 'PE' || c.name === '진로와 직업') && c.grades.includes(1))) {
          const k = c.id + '@' + sem; if (state.sel[k] == null) state.sel[k] = defCredit(c, sem);
        }
      });
    });
    state.cc[1] = true; save(); renderAll();
  };
  $('reset').onclick = () => {
    if (confirm('선택한 모든 과목과 창체 체크를 지울까요?')) { state = { sel: {}, cc: allCC(), ccInit: true, sem: 0 }; applyAuto(); renderAll(); }
  };
  renderAll();
})();
