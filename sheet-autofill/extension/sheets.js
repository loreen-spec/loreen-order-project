// 구글 시트 API — 지금 보고 있는 작업지시서 탭 읽기/쓰기

const Sheets = {
  // 지금 크롬에서 보고 있는 탭이 구글 시트면 { id, gid } 반환
  async current() {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return this.parseUrl(tab?.url);
  },

  // 시트 링크 → { id, gid }  (링크에 gid가 없으면 null = 첫 번째 탭)
  parseUrl(url = '') {
    const m = String(url).match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
    if (!m) return null;
    const g = String(url).match(/[#&?]gid=(\d+)/);
    return { id: m[1], gid: g ? Number(g[1]) : null };
  },

  async token(interactive) {
    const r = await chrome.runtime.sendMessage({ type: 'google-token', interactive });
    if (!r?.ok) throw new Error(r?.error || '구글 로그인 실패');
    return r.token;
  },

  async req(path, { method = 'GET', body, interactive = false } = {}) {
    const call = async (token) =>
      fetch('https://sheets.googleapis.com/v4/spreadsheets/' + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    let res = await call(await this.token(interactive));
    if (res.status === 401) {
      // 로그인 만료 → 다시 로그인
      await chrome.runtime.sendMessage({ type: 'google-logout' });
      res = await call(await this.token(true));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403) throw new Error('이 시트를 편집할 권한이 없거나 Sheets API가 꺼져 있습니다');
      if (res.status === 404) throw new Error('시트를 찾을 수 없습니다');
      throw new Error('시트 오류: ' + (data.error?.message || res.status));
    }
    return data;
  },

  // 파일 이름, 탭 목록, 대상 탭 (gid가 없거나 못 찾으면 첫 번째 탭)
  async tabTitle(sheet, interactive) {
    const data = await this.req(`${sheet.id}?fields=properties.title,sheets.properties(sheetId,title)`, { interactive });
    const tabs = data.sheets.map((s) => ({ gid: s.properties.sheetId, title: s.properties.title }));
    const tab = tabs.find((t) => t.gid === sheet.gid) || tabs[0];
    return { file: data.properties.title, tab: tab.title, gid: tab.gid, tabs };
  },

  link(sheet) {
    return `https://docs.google.com/spreadsheets/d/${sheet.id}/edit#gid=${sheet.gid ?? 0}`;
  },

  async read(sheet, tab, ranges) {
    const q = ranges.map((r) => 'ranges=' + encodeURIComponent(a1(tab, r))).join('&');
    const data = await this.req(`${sheet.id}/values:batchGet?${q}`);
    return data.valueRanges.map((v) => v.values || []);
  },

  async write(sheet, tab, entries) {
    return this.req(`${sheet.id}/values:batchUpdate`, {
      method: 'POST',
      interactive: true,
      body: {
        valueInputOption: 'USER_ENTERED',
        data: entries.map(({ range, values }) => ({ range: a1(tab, range), values })),
      },
    });
  },
};

const a1 = (tab, range) => `'${tab.replace(/'/g, "''")}'!${range}`;

const colNum = (col) => [...col.toUpperCase()].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const colName = (n) => {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
