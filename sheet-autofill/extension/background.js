importScripts('config.js');

// 아이콘 클릭 → 사이드패널 열기
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// 구글 로그인은 패널이 아닌 여기서 처리 (로그인 창이 떠도 끊기지 않게)
const SCOPE = 'openid email https://www.googleapis.com/auth/spreadsheets';

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg.type === 'google-token') {
    getToken(msg.interactive).then(
      (token) => send({ ok: true, token }),
      (err) => send({ ok: false, error: err.message })
    );
    return true;
  }
  if (msg.type === 'google-logout') {
    chrome.storage.session.remove('gtoken').then(() => send({ ok: true }));
    return true;
  }});

async function getToken(interactive) {
  const { gtoken } = await chrome.storage.session.get('gtoken');
  if (gtoken && gtoken.exp > Date.now() + 60_000) return gtoken.value;

  // config.js 값 우선, 없으면 예전 설정창에 저장했던 값
  const clientId = CONFIG.google.clientId || (await chrome.storage.local.get('clientId')).clientId;
  if (!clientId) throw new Error('config.js에 구글 클라이언트 ID가 없습니다 (관리자 설정)');

  try {
    return await auth(clientId, false); // 이미 허용했다면 창 없이 바로
  } catch (err) {
    if (!interactive) throw new Error('구글 로그인이 필요합니다');
  }
  return auth(clientId, true);
}

async function auth(clientId, interactive) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
    hd: CONFIG.google.domain, // 회사 계정 우선 표시
  });
  if (!interactive) params.set('prompt', 'none');

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    interactive,
  });
  const hash = new URLSearchParams(new URL(redirect).hash.slice(1));
  if (hash.get('error')) throw new Error('구글 로그인 실패: ' + hash.get('error'));
  const value = hash.get('access_token');
  if (!value) throw new Error('구글 로그인 실패');

  const exp = Date.now() + Number(hash.get('expires_in') || 3600) * 1000;
  await chrome.storage.session.set({ gtoken: { value, exp } });
  return value;
}
