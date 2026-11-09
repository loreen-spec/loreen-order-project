// 작업지시서 자동입력 — 사이드패널
// 흐름: 시트 C5 상품명 읽기 → 회사 서버로 노션 제품 조회 → 담당자·생산공장·발주수량 미리보기 → 시트에 입력
// 키 입력 없이 @openhan.kr 구글 로그인만으로 사용

const $ = (id) => document.getElementById(id);
const S = CONFIG.sheet;

// target: 링크로 지정한 시트 { id, gid, file, tab, tabs } — 없으면 지금 열린 시트에 입력
// spec: 엑셀에서 읽은 사이즈 스펙 { file, sheet, sizes, rows, hasGrade } / specHeader: 시트의 스펙 사이즈 머리글
const state = { sheet: null, tab: '', header: null, product: null, round: '전체', target: null, recent: [], spec: null, specHeader: null };

init();

async function init() {
  const saved = await chrome.storage.local.get(['target', 'recent']);
  state.target = saved.target || null;
  state.recent = saved.recent || [];
  renderTarget();

  document.querySelector('[data-cell="productName"]').textContent = S.productName;
  document.querySelector('[data-cell="manager"]').textContent = S.manager;
  document.querySelector('[data-cell="factory"]').textContent = S.factory;
  document.querySelector('[data-cell="orders"]').textContent = ordersRange();
  const T = S.spec;
  document.querySelector('[data-cell="spec"]').textContent = `${T.labelCol}${T.firstRow}:${T.gradeCol}${T.firstRow + T.rows - 1}`;

  detectSheet();

  // 크롬 탭을 옮기거나 시트 탭(gid)을 바꾸면 다시 확인
  chrome.tabs.onActivated.addListener(scheduleDetect);
  chrome.tabs.onUpdated.addListener((_id, info) => info.url && scheduleDetect());
  chrome.windows.onFocusChanged.addListener(scheduleDetect);
}

// ---------- 시트 확인 ----------
let detectTimer;
let detectSeq = 0;
function scheduleDetect() {
  if (state.target) return; // 링크로 지정한 시트가 있으면 크롬 탭 이동은 무시
  clearTimeout(detectTimer);
  detectTimer = setTimeout(detectSheet, 300);
}

// 입력 대상: 링크로 지정한 시트 > 지금 열린 시트
async function targetSheet() {
  return state.target ? { id: state.target.id, gid: state.target.gid } : Sheets.current();
}

async function detectSheet() {
  const seq = ++detectSeq;
  const sheet = await targetSheet();
  if (seq !== detectSeq) return;
  state.sheet = sheet;
  state.header = null;
  state.specHeader = null;

  if (!sheet) return setConn('작업지시서 시트를 열거나 링크를 넣어주세요');

  setConn('시트 확인 중');
  try {
    const info = await Sheets.tabTitle(sheet, false);
    const [name, header, specHeader] = await Sheets.read(sheet, info.tab, [S.productName, S.sizeHeader, S.spec.sizeHeader]);
    if (seq !== detectSeq) return;
    state.tab = info.tab;
    state.header = (header[0] || []).map((v) => String(v).trim());
    state.specHeader = (specHeader[0] || []).map((v) => String(v).trim());
    if (state.spec) renderSpec();
    setConn(info.tab, 'ok');
    if (state.target) {
      Object.assign(state.target, { gid: info.gid, file: info.file, tab: info.tab, tabs: info.tabs });
      await saveTarget();
    }

    const sheetName = String(name[0]?.[0] || '').trim();
    if (sheetName && sheetName !== $('productName').value.trim()) {
      $('productName').value = sheetName;
      loadProduct();
    } else if (state.product) {
      render();
    }
  } catch (err) {
    if (seq !== detectSeq) return;
    const needLogin = /로그인/.test(err.message);
    if (needLogin) setConn('구글 로그인하기', 'warn', login);
    else setConn(err.message, 'warn', detectSheet);
    if (state.target && !state.target.file) {
      $('targetFile').textContent = needLogin ? '위의 구글 로그인을 눌러주세요' : '시트를 열 수 없어요';
    }
  }
}

// ---------- 입력할 시트 (링크) ----------
$('targetUrl').addEventListener('input', () => {
  const parsed = Sheets.parseUrl($('targetUrl').value.trim());
  if (parsed) setTarget(parsed);
});
$('targetUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !Sheets.parseUrl($('targetUrl').value.trim())) toast('구글 시트 링크가 아니에요', 'err');
});
$('clearTarget').onclick = () => setTarget(null);
$('openTarget').onclick = () => state.target && chrome.tabs.create({ url: Sheets.link(state.target) });

async function setTarget(target) {
  state.target = target ? { ...target, file: target.file || '', tab: target.tab || '', tabs: target.tabs || [] } : null;
  $('targetUrl').value = '';
  await saveTarget();
  if (target) {
    // 새 시트로 바꾸면 이전 상품 정보는 지움 (빈 시트면 상품명을 직접 입력)
    $('productName').value = '';
    state.product = null;
    $('result').hidden = true;
    updateSubmit();
  }
  detectSheet();
  if (!target) $('targetUrl').focus();
}

async function saveTarget() {
  const t = state.target;
  if (t?.file) {
    state.recent = [
      { id: t.id, gid: t.gid, file: t.file, tab: t.tab },
      ...state.recent.filter((r) => !(r.id === t.id && r.gid === t.gid)),
    ].slice(0, 5);
  }
  await chrome.storage.local.set({ target: t, recent: state.recent });
  renderTarget();
}

function renderTarget() {
  const t = state.target;
  $('targetUrl').hidden = !!t;
  $('targetHint').hidden = !!t;
  $('targetCard').hidden = !t;

  // 탭이 여러 개면 칩으로 고르기
  const chips = $('targetTabs');
  chips.innerHTML = '';
  chips.hidden = !t || (t.tabs || []).length < 2;
  for (const tab of t?.tabs || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (tab.gid === t.gid ? ' on' : '');
    b.textContent = tab.title;
    b.onclick = () => { t.gid = tab.gid; saveTarget(); detectSheet(); };
    chips.append(b);
  }

  if (t) {
    $('targetFile').textContent = t.file || '확인 중';
    $('targetTab').textContent = t.tab ? `${t.tab} 탭` : '';
  }

  // 최근 시트
  const recent = $('recent');
  recent.innerHTML = '';
  const list = t ? [] : state.recent;
  recent.hidden = !list.length;
  if (list.length) {
    const p = document.createElement('p');
    p.textContent = '최근 작업지시서';
    recent.append(p);
  }
  for (const r of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span></span><em></em>';
    b.firstChild.textContent = r.file;
    b.lastChild.textContent = r.tab;
    b.onclick = () => setTarget(r);
    recent.append(b);
  }
}

async function login() {
  setConn('로그인 중');
  try {
    await Sheets.token(true);
    detectSheet();
  } catch (err) {
    setConn('구글 로그인하기', 'warn', login);
    toast(err.message, 'err');
  }
}

function setConn(text, type = '', onClick) {
  const el = $('conn');
  el.className = 'pill ' + type;
  el.textContent = text;
  el.title = text;
  el.disabled = !onClick;
  el.onclick = onClick || null;
}

// ---------- 노션 불러오기 ----------
$('load').onclick = () => loadProduct();
$('productName').addEventListener('keydown', (e) => e.key === 'Enter' && loadProduct());

async function loadProduct() {
  const name = $('productName').value.trim();
  if (!name) return;

  busy($('load'), true);
  $('candidates').hidden = true;
  try {
    const data = await Api.product(name);
    if (!data.product) return showCandidates(data.candidates || [], name);
    state.product = data.product;
    const rounds = roundsOf(state.product.orders);
    state.round = rounds.length > 1 ? rounds[rounds.length - 1] : '전체';
    render();
  } catch (err) {
    toast(err.message, 'err');
    if (/로그인/.test(err.message)) setConn('구글 로그인하기', 'warn', login);
  } finally {
    busy($('load'), false);
  }
}

function showCandidates(list, name) {
  const box = $('candidates');
  box.innerHTML = '';
  if (!list.length) {
    toast(`노션에서 '${name}' 제품을 찾지 못했어요`, 'err');
    return;
  }
  const p = document.createElement('p');
  p.textContent = '정확히 같은 이름이 없어요. 이 중에 있나요?';
  box.append(p);
  for (const productName of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = productName;
    b.onclick = () => {
      $('productName').value = productName;
      loadProduct();
    };
    box.append(b);
  }
  box.hidden = false;
}

// ---------- 미리보기 ----------
function render() {
  const p = state.product;
  $('result').hidden = false;
  $('productTitle').textContent = p.name;
  $('productLink').href = p.url;
  setValue($('nameValue'), p.name);
  setValue($('manager'), p.manager);
  setValue($('factory'), p.factory);

  // 차수 칩 (차수가 2개 이상일 때만)
  const rounds = roundsOf(p.orders);
  const chips = $('rounds');
  chips.innerHTML = '';
  chips.hidden = rounds.length < 2;
  for (const r of rounds.length > 1 ? [...rounds, '전체'] : []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (r === state.round ? ' on' : '');
    b.textContent = r === '전체' ? '전체 합계' : r;
    b.onclick = () => { state.round = r; render(); };
    chips.append(b);
  }

  // 컬러 × 사이즈 표
  const { colors, sizes, grid, total } = matrix();
  $('orderTotal').textContent = total ? total.toLocaleString() + '장' : '';
  $('orderTotal').classList.toggle('empty', !total);
  if (!total) $('orderTotal').textContent = '없음';

  const table = $('orderTable');
  table.innerHTML = '';
  if (colors.length) {
    const head = table.createTHead().insertRow();
    for (const h of ['컬러', ...sizes, '계']) {
      const th = document.createElement('th');
      th.textContent = h;
      if (h === '계') th.className = 'sum';
      head.append(th);
    }
    const body = table.createTBody();
    const colSum = sizes.map(() => 0);
    for (const c of colors) {
      const tr = body.insertRow();
      tr.insertCell().textContent = c;
      let rowSum = 0;
      sizes.forEach((s, i) => {
        const v = grid[c][s] || 0;
        rowSum += v;
        colSum[i] += v;
        const td = tr.insertCell();
        td.textContent = v ? v.toLocaleString() : '–';
        if (!v) td.className = 'zero';
      });
      const td = tr.insertCell();
      td.textContent = rowSum.toLocaleString();
      td.className = 'sum';
    }
    const foot = table.createTFoot().insertRow();
    foot.insertCell().textContent = '합계';
    colSum.forEach((v) => (foot.insertCell().textContent = v.toLocaleString()));
    const td = foot.insertCell();
    td.textContent = total.toLocaleString();
    td.className = 'sum';
  }

  // 주의사항
  const warns = problems();
  if (!p.orders.length) warns.push('노션에 이 제품의 발주 내역이 없어요');
  const ul = $('warnings');
  ul.innerHTML = '';
  warns.forEach((w) => (ul.appendChild(document.createElement('li')).textContent = w));
  ul.hidden = !warns.length;

  updateSubmit();
}

function updateSubmit() {
  $('submit').disabled = !(state.product || state.spec);
}

function setValue(el, v) {
  el.textContent = v || '비어 있음';
  el.classList.toggle('empty', !v);
}

function roundsOf(orders) {
  return [...new Set(orders.map((o) => o.round))].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
}

// 선택된 차수의 컬러 × 사이즈 합계
function matrix() {
  const orders = state.product.orders.filter((o) => state.round === '전체' || o.round === state.round);
  const colors = [];
  const sizes = [];
  const grid = {};
  let total = 0;
  for (const o of orders) {
    if (!colors.includes(o.color)) colors.push(o.color);
    if (!sizes.includes(o.size)) sizes.push(o.size);
    grid[o.color] ??= {};
    grid[o.color][o.size] = (grid[o.color][o.size] || 0) + o.qty;
    total += o.qty;
  }
  if (sizes.every((s) => /^\d+$/.test(s))) sizes.sort((a, b) => a - b);
  return { colors, sizes, grid, total };
}

// 시트에 넣을 수 없는 경우
function problems() {
  const out = [];
  const { colors, sizes } = matrix();
  if (colors.length > S.colorTable.rows) {
    out.push(`컬러가 ${colors.length}개인데 시트에는 ${S.colorTable.rows}칸뿐이에요 (${colors.slice(S.colorTable.rows).join(', ')} 초과)`);
  }
  if (state.header) {
    const missing = sizes.filter((s) => !state.header.includes(s));
    if (missing.length) out.push(`시트 사이즈 칸(${S.sizeHeader})에 없는 사이즈: ${missing.join(', ')}`);
  }
  return out;
}

function ordersRange() {
  const to = S.sizeHeader.split(':')[1].replace(/\d+/g, '');
  const t = S.colorTable;
  return `${t.colorCol}${t.firstRow}:${to}${t.firstRow + t.rows - 1}`;
}

// ---------- 사이즈 스펙 (엑셀) ----------
$('specFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) loadSpec(file);
});
$('clearSpec').onclick = () => {
  state.spec = null;
  $('specResult').hidden = true;
  $('dropZone').hidden = false;
  updateSubmit();
};

// 패널 어디에 끌어다 놓아도 인식
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragDepth++;
  $('dropZone').hidden = false;
  $('dropZone').classList.add('over');
  $('dropZone').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
document.addEventListener('dragleave', () => {
  if (--dragDepth > 0) return;
  dragDepth = 0;
  $('dropZone').classList.remove('over');
  if (state.spec) $('dropZone').hidden = true;
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('dropZone').classList.remove('over');
  const file = e.dataTransfer.files[0];
  if (file) loadSpec(file);
  else if (state.spec) $('dropZone').hidden = true;
});

async function loadSpec(file) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return toast('엑셀 파일(.xlsx, .xls, .csv)만 올릴 수 있어요', 'err');
  try {
    state.spec = { file: file.name, ...(await Spec.parseFile(file)) };
    $('useSpec').checked = true;
    renderSpec();
    toast(`사이즈 스펙 ${state.spec.rows.length}개 항목을 읽었어요`, 'ok');
  } catch (err) {
    if (state.spec) $('dropZone').hidden = true;
    toast(err.message, 'err');
  }
}

function renderSpec() {
  const sp = state.spec;
  $('dropZone').hidden = true;
  $('specResult').hidden = false;
  $('specName').textContent = sp.file;
  $('specName').title = `${sp.file} · ${sp.sheet} 시트`;

  const table = $('specTable');
  table.innerHTML = '';
  const head = table.createTHead().insertRow();
  for (const h of ['항목', ...sp.sizes, ...(sp.hasGrade ? ['편차'] : [])]) {
    const th = document.createElement('th');
    th.textContent = h;
    if (h === '편차') th.className = 'grade';
    head.append(th);
  }
  const body = table.createTBody();
  for (const r of sp.rows) {
    const tr = body.insertRow();
    tr.insertCell().textContent = r.label;
    for (const v of r.values) {
      const td = tr.insertCell();
      td.textContent = v === '' ? '–' : v;
      if (v === '') td.className = 'zero';
    }
    if (sp.hasGrade) {
      const td = tr.insertCell();
      td.textContent = r.grade === '' ? '–' : r.grade;
      td.className = 'grade';
    }
  }

  const { errors, warns } = specProblems();
  const ul = $('specWarnings');
  ul.innerHTML = '';
  [...errors, ...warns].forEach((w) => (ul.appendChild(document.createElement('li')).textContent = w));
  ul.hidden = !errors.length && !warns.length;
  updateSubmit();
}

// 엑셀 사이즈 → 시트 사이즈 칸 맞추기
function specPlan() {
  const sp = state.spec;
  const T = S.spec;
  const [fromCol, toCol] = T.sizeHeader.split(':').map((c) => c.replace(/\d+/g, ''));
  const width = colNum(toCol) - colNum(fromCol) + 1;
  const header = (state.specHeader || []).map((v) => (v ? sizeText(v) : ''));
  // 시트 머리글이 비어 있으면 엑셀 사이즈를 그대로 머리글에 씀
  const writeHeader = !header.some(Boolean);
  const colSizes = writeHeader ? sp.sizes.slice(0, width) : Array.from({ length: width }, (_, j) => header[j] || '');
  const idx = Array.from({ length: width }, (_, j) => (colSizes[j] ? sp.sizes.indexOf(colSizes[j]) : -1));
  const missing = sp.sizes.filter((s) => !colSizes.includes(s));
  return { fromCol, toCol, width, colSizes, idx, missing, writeHeader };
}

function specProblems() {
  const sp = state.spec;
  const T = S.spec;
  const errors = [];
  const warns = [];
  if (sp.rows.length > T.rows) errors.push(`항목이 ${sp.rows.length}개인데 시트에는 ${T.rows}칸뿐이에요`);
  if (state.specHeader) {
    const plan = specPlan();
    if (!plan.idx.some((i) => i >= 0)) errors.push(`시트 사이즈 칸(${T.sizeHeader})과 맞는 사이즈가 없어요`);
    else if (plan.missing.length) warns.push(`시트에 없는 사이즈는 빠져요: ${plan.missing.join(', ')}`);
    if (plan.writeHeader) warns.push(`시트 사이즈 칸이 비어 있어서 ${plan.colSizes.join(' ')}도 함께 적어요`);
  }
  if (!sp.hasGrade) warns.push('엑셀에 편차 칸이 없어서 시트의 편차는 그대로 둬요');
  return { errors, warns };
}

function specEntries() {
  const sp = state.spec;
  const T = S.spec;
  const plan = specPlan();
  const last = T.firstRow + T.rows - 1;
  const entries = [];
  if (plan.writeHeader) {
    entries.push({
      range: T.sizeHeader,
      values: [Array.from({ length: plan.width }, (_, j) => {
        const s = plan.colSizes[j] || '';
        return /^\d+$/.test(s) ? Number(s) : s;
      })],
    });
  }
  const labels = [];
  const values = [];
  const grades = [];
  for (let i = 0; i < T.rows; i++) {
    const r = sp.rows[i];
    labels.push([r ? r.label : '']);
    values.push(plan.idx.map((k) => (r && k >= 0 ? r.values[k] : '')));
    grades.push([r ? r.grade : '']);
  }
  entries.push({ range: `${T.labelCol}${T.firstRow}:${T.labelCol}${last}`, values: labels });
  entries.push({ range: `${plan.fromCol}${T.firstRow}:${plan.toCol}${last}`, values });
  if (sp.hasGrade) entries.push({ range: `${T.gradeCol}${T.firstRow}:${T.gradeCol}${last}`, values: grades });
  return entries;
}

// ---------- 시트에 입력 ----------
$('submit').onclick = async () => {
  const btn = $('submit');
  const p = state.product;
  if (!p && !state.spec) return;
  busy(btn, true, '입력 중');
  try {
    const sheet = await targetSheet();
    if (!sheet) throw new Error('작업지시서 시트를 열거나 링크를 넣어주세요');
    const { tab, gid } = await Sheets.tabTitle(sheet, true);
    sheet.gid = gid;
    const entries = [];

    if (p && $('useName').checked) entries.push({ range: S.productName, values: [[p.name]] });
    if (p && $('useManager').checked) entries.push({ range: S.manager, values: [[p.manager]] });
    if (p && $('useFactory').checked) entries.push({ range: S.factory, values: [[p.factory]] });

    if (state.spec && $('useSpec').checked) {
      const [specHeader] = await Sheets.read(sheet, tab, [S.spec.sizeHeader]);
      state.specHeader = (specHeader[0] || []).map((v) => String(v).trim());
      const { errors } = specProblems();
      if (errors.length) throw new Error(errors.join('\n'));
      entries.push(...specEntries());
    }

    if (p && $('useOrders').checked) {
      const [header] = await Sheets.read(sheet, tab, [S.sizeHeader]);
      state.header = (header[0] || []).map((v) => String(v).trim());
      const errs = problems();
      if (errs.length) throw new Error(errs.join('\n'));

      const [fromCol, toCol] = S.sizeHeader.split(':').map((c) => c.replace(/\d+/g, ''));
      const width = colNum(toCol) - colNum(fromCol) + 1;
      const t = S.colorTable;
      const lastRow = t.firstRow + t.rows - 1;
      const { colors, grid } = matrix();

      const colorRows = [];
      const qtyRows = [];
      for (let i = 0; i < t.rows; i++) {
        const c = colors[i];
        colorRows.push([c || '']);
        qtyRows.push(Array.from({ length: width }, (_, j) => {
          const size = state.header[j];
          return c && size && grid[c][size] ? grid[c][size] : '';
        }));
      }
      entries.push({ range: `${t.colorCol}${t.firstRow}:${t.colorCol}${lastRow}`, values: colorRows });
      entries.push({ range: `${fromCol}${t.firstRow}:${toCol}${lastRow}`, values: qtyRows });
    }

    if (!entries.length) throw new Error('입력할 항목을 하나 이상 선택해주세요');
    await Sheets.write(sheet, tab, entries);
    toast(`'${tab}' 탭에 입력했어요`, 'ok', () => chrome.tabs.create({ url: Sheets.link(sheet) }));
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    busy(btn, false, '시트에 입력');
  }
};

// ---------- 공통 ----------
function busy(btn, on, label) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
  if (label) btn.querySelector('.label').textContent = label;
}

let toastTimer;
function toast(msg, type = '', open) {
  const el = $('toast');
  el.className = 'toast show ' + type;
  el.textContent = msg;
  if (open) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '시트 열기';
    b.onclick = open;
    el.append(b);
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), type === 'err' || open ? 6000 : 3000);
}
