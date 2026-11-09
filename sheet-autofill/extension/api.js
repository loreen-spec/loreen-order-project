// 회사 대시보드 서버 — 노션 제품 정보 가져오기 (구글 로그인 토큰으로 인증)

const Api = {
  async product(name) {
    const token = await Sheets.token(true);
    const res = await fetch(`${CONFIG.server}/api/sheet-autofill?q=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      await chrome.runtime.sendMessage({ type: 'google-logout' });
      throw new Error(data.error || '회사 구글 계정으로 다시 로그인해주세요');
    }
    if (!res.ok) throw new Error(data.error || '서버 오류: ' + res.status);
    return data; // { email, product } 또는 { email, candidates }
  },
};
