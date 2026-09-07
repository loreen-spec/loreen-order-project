// ── GianMate 웹앱 페이지에서 실행 ────────────────────────────
// 앱이 localStorage(gm_pending_hiworks_list)에 저장한 '기안 대기(초안)' 목록을
// chrome.storage.local(pendingList)로 동기화한다. 하이웍스 탭의 패널이 이를 리스트로 표시.

function syncList() {
  try {
    const raw = window.localStorage.getItem("gm_pending_hiworks_list");
    const list = raw ? JSON.parse(raw) : [];
    chrome.storage.local.set({ pendingList: Array.isArray(list) ? list : [] });
  } catch (e) { /* ignore */ }
}

// 로드 시 1회 동기화
syncList();

// 앱이 목록을 갱신하면(담기/삭제) 신호를 받아 다시 동기화
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.source === "gianmate-synclist") syncList();
});

// 설치 여부를 웹앱이 알 수 있도록 신호
window.postMessage({ source: "gianmate-ext", status: "ready" }, "*");
