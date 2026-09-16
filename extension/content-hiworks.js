// ── 하이웍스 전자결재 작성화면에서 실행 ──────────────────────
// 기안메이트에서 넘어온 기안서(pendingFill)를 읽어 플로팅 패널을 띄우고,
// [자동 입력] 버튼으로 제목·본문을 채운다. 결재선은 안내(수동 세팅 권장).
//
// ⚠️ 하이웍스 DOM은 페이지 구조에 따라 다를 수 있어, 여러 전략으로 시도한다.
//    실제 화면에서 안 맞으면 findTitleInput / findEditor 의 셀렉터만 조정하면 됩니다.

(function () {
  const V = "#836CE0", VD = "#5B44C4";

  // 기안 대기(초안) 목록을 읽어 패널로 표시
  chrome.storage.local.get("pendingList", (res) => {
    renderPanel(res.pendingList || []);
  });

  // 앱에서 목록이 바뀌면 패널 갱신 (담기/삭제 즉시 반영)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.pendingList) return;
    renderPanel(changes.pendingList.newValue || []);
  });

  // ── 제목 입력칸 찾기 ──
  function findTitleInput() {
    // 0) 기본 제목값이 들어있는 input (가장 확실) — "[지출결의서] OO 지급의 건"
    const byVal = [...document.querySelectorAll("input")].find(
      (i) => i.offsetParent !== null && /지출결의서|지급의 건|OO 지급/.test(i.value || "")
    );
    if (byVal) return byVal;
    // 1) label "제목" 다음의 input
    const labels = [...document.querySelectorAll("label, div, span, th, td")];
    for (const el of labels) {
      if (el.textContent && el.textContent.trim() === "제목") {
        const scope = el.parentElement || document;
        const inp = scope.querySelector('input[type="text"], input:not([type])');
        if (inp) return inp;
      }
    }
    // 2) placeholder 힌트
    const byPh = document.querySelector(
      'input[placeholder*="제목"], input[placeholder*="지출결의서"], input[name*="title" i], input[name*="subject" i]'
    );
    if (byPh) return byPh;
    // 3) 첫 번째 눈에 보이는 긴 텍스트 input
    const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')]
      .filter((i) => i.offsetParent !== null && i.offsetWidth > 300);
    return inputs[0] || null;
  }

  // ── 본문 에디터 찾기 (iframe 또는 contenteditable) ──
  function findEditor() {
    // 1) contenteditable iframe (대부분의 리치에디터)
    for (const f of document.querySelectorAll("iframe")) {
      try {
        const b = f.contentDocument && f.contentDocument.body;
        if (b && (b.isContentEditable || b.getAttribute("contenteditable") === "true")) {
          return { type: "iframe", body: b };
        }
      } catch (e) { /* cross-origin iframe skip */ }
    }
    // 2) 페이지 내 contenteditable div
    const ce = document.querySelector('[contenteditable="true"]');
    if (ce) return { type: "div", body: ce };
    // 3) textarea
    const ta = document.querySelector("textarea");
    if (ta) return { type: "textarea", body: ta };
    return null;
  }

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 본문(SynapEditor)은 페이지 내부 스크립트(inpage-hiworks.js)에 요청.
  function fillBodyViaBridge(html) {
    return new Promise((resolve) => {
      let settled = false;
      function onResult(e) {
        if (e.source !== window || !e.data || e.data.source !== "gm-setbody-result") return;
        settled = true;
        window.removeEventListener("message", onResult);
        resolve(e.data); // { ok, method }
      }
      window.addEventListener("message", onResult);
      window.postMessage({ source: "gm-setbody", html }, "*");
      setTimeout(() => { if (!settled) { window.removeEventListener("message", onResult); resolve({ ok: false, method: "timeout" }); } }, 1200);
    });
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // 문서 종류를 "지출결의서_오픈한"으로 선택 → 결재선/제목/본문 폼이 노출됨
  function selectDocType() {
    for (const s of document.querySelectorAll("select")) {
      const opt = [...s.options].find((o) => /지출결의서/.test(o.textContent || ""));
      if (opt) {
        if (s.value !== opt.value) {
          s.value = opt.value;
          s.dispatchEvent(new Event("change", { bubbles: true }));
          return "selected";
        }
        return "already";
      }
    }
    return "notfound";
  }

  // ── 결재선: 참조 입력칸에 이름 타이핑해서 추가 ──
  // 하이웍스 결재선은 "클릭 후 입력" 칸에 이름을 치면 자동 추가되는 방식.
  function refInput() {
    return [...document.querySelectorAll("input")].find(
      (i) => i.offsetParent !== null && /클릭 후 입력|이름 입력|참조/.test(i.placeholder || "")
    ) || null;
  }
  const norm = (s) => (s || "").replace(/\s/g, "");
  // 결재선 표 전체 텍스트 (우리 패널 제외). "김진선"은 sunny만 가지므로 존재확인에 사용.
  function refRowText() {
    const inp = refInput();
    const scope = (inp && inp.closest("table")) || document;
    return scope.textContent || "";
  }
  // 자동완성 항목은 click만으론 선택 안 되는 경우가 많아 마우스 시퀀스로 선택
  function fireMouse(el) {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    }
  }
  // typeStr(예: "sunny") 입력 → 자동완성 대기 → matchStr(예: "김진선") 항목 선택
  async function addRefByTyping(typeStr, matchStr) {
    const inp = refInput();
    if (!inp) return "no-input";
    inp.focus();
    setInputValue(inp, "");
    setInputValue(inp, typeStr);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent("keyup", { key: typeStr.slice(-1), bubbles: true }));

    const want = norm(matchStr);
    // 자동완성이 잠깐 떴다 사라지므로 빠르게 폴링. 뜨면 "한 번만" 선택.
    for (let i = 0; i < 20; i++) {
      await wait(150);
      // 입력칸 아래에 뜬 후보 항목만(참조에 이미 있는 칩과 구분: 입력칸보다 y가 아래)
      const inpBottom = inp.getBoundingClientRect().bottom;
      const cand = [...document.querySelectorAll("li,tr,div,a,td,span,p")].filter((e) => {
        if (e === inp || e.closest("#gm-panel")) return false;
        if (!norm(e.textContent).includes(want)) return false;
        const r = e.getBoundingClientRect();
        return r.height > 4 && r.height < 90 && r.width < 600 && r.top >= inpBottom - 4; // 입력칸 아래(=드롭다운)
      });
      if (!cand.length) continue;
      cand.sort((a, b) => a.offsetWidth * a.offsetHeight - b.offsetWidth * b.offsetHeight);
      // 클릭 대상: 후보를 감싸는 실제 항목(li/tr/option) 하나만
      const target = cand[0].closest("li,tr,[role='option'],a") || cand[0];
      fireMouse(target); // ← 딱 한 번
      await wait(350);
      return norm(refRowText()).includes(want) ? "clicked" : "clicked-unconfirmed";
    }
    setInputValue(inp, "");
    return "no-suggestion";
  }
  // 참조에 sunny김진선 자동 추가 (없을 때만). 나머지 기본 참조는 건드리지 않음.
  async function ensureReferences(doc) {
    const refs = (doc.approval && doc.approval.references) || [];
    const sunny = refs.find((r) => /sunny|김진선/i.test(r.name || ""));
    if (!sunny) return [];
    if (refRowText().includes("김진선")) return []; // 이미 있음
    const res = await addRefByTyping("sunny", "김진선"); // 검색은 sunny, 매칭은 김진선(더 확실)
    return res.startsWith("clicked") ? ["sunny김진선"] : [];
  }

  // ── 100만원↑: 참조에서 Hans 삭제 + 결재자로 Hans 추가 ──
  function approvalTable() { const inp = refInput(); return (inp && inp.closest("table")) || null; }
  // 참조에서 특정 이름(한글)의 칩을 찾아 × 삭제
  function removeReference(nameKor) {
    const table = approvalTable(); if (!table) return false;
    // 이름을 담은 가장 안쪽 요소
    const nodes = [...table.querySelectorAll("span,td,div,li,a")].filter(
      (e) => e.offsetParent !== null && (e.textContent || "").includes(nameKor) && (e.textContent || "").trim().length < 14
    );
    nodes.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    const chip = nodes[0]; if (!chip) return false;
    chip.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const scope = chip.closest("td,li,span,div") || chip;
    // 칩 내부/주변의 × 또는 삭제 컨트롤
    const del = [...scope.querySelectorAll("*")].find(
      (e) => e.offsetParent !== null && (/^[×✕✖xX]$/.test((e.textContent || "").trim()) || /del|remove|close|삭제/i.test((e.className || "") + (e.getAttribute && e.getAttribute("class") || "")))
    );
    if (del) { fireMouse(del); return true; }
    return false;
  }
  // 모달(신청 설정) 감지: 확인/취소 버튼 + 입력칸을 가진 컨테이너
  async function detectModal(tries) {
    for (let i = 0; i < (tries || 6); i++) {
      await wait(180);
      const t = [...document.querySelectorAll("*")].find(
        (e) => e.offsetParent !== null && /신청 설정|처리 설정|결재선 설정/.test(e.textContent || "") && (e.textContent || "").length < 30
      );
      if (t) { let m = t.closest("div,section,form"); while (m && !m.querySelector("input")) m = m.parentElement; if (m && m.querySelector("input")) return m; }
      const ok = [...document.querySelectorAll("button,a,input[type='button'],input[type='submit']")].find(
        (b) => b.offsetParent !== null && /^(확인|저장|적용|등록)$/.test((b.textContent || b.value || "").trim())
      );
      if (ok) { let m = ok.closest("div,section,form"), d = 0; while (m && d < 6) { if (m.querySelector("input")) return m; m = m.parentElement; d++; } }
    }
    return null;
  }

  // 신청측 "+" 클릭 → "신청 설정" 모달 → 검색 입력 → 후보 클릭 → 확인
  async function addApprover(typeStr, matchKor) {
    const table = approvalTable(); if (!table) return "no-table";
    const refIn = refInput();
    const refTop = refIn ? refIn.getBoundingClientRect().top : 99999;

    // "+" 후보 모으기: 텍스트/속성 + 좌표(신청 칸 위)
    const cands = [];
    [...table.querySelectorAll("a,button,span,div,td,i,img")].forEach((e) => {
      if (e.offsetParent === null) return;
      const r = e.getBoundingClientRect();
      if (r.top >= refTop - 10) return;
      const txt = (e.textContent || "").trim();
      const meta = ((e.getAttribute("title") || "") + (e.getAttribute("aria-label") || "") + (e.className || "") + (e.id || "")).toLowerCase();
      if (txt === "+" || /add|plus|추가/.test(meta)) cands.push(e);
    });
    const sinchung = [...table.querySelectorAll("td,th,div,span")].find((e) => (e.textContent || "").trim() === "신청" && e.offsetParent !== null);
    const trect = table.getBoundingClientRect();
    if (sinchung) {
      const s = sinchung.getBoundingClientRect();
      for (const dy of [12, 16, 20, 24]) {
        const el = document.elementFromPoint(s.left + s.width / 2, trect.top + dy);
        if (el && table.contains(el) && el.getBoundingClientRect().top < refTop - 10 && !cands.includes(el)) cands.push(el);
      }
    }
    cands.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (!cands.length) return "no-plus";

    // 후보를 하나씩 눌러 모달이 뜨는지 확인
    let modal = null;
    for (const c of cands) {
      fireMouse(c.closest("button,a,td,div") || c);
      modal = await detectModal(5);
      if (modal) break;
    }
    if (!modal) return "no-modal";

    const inp = [...modal.querySelectorAll("input")].find(
      (i) => i.offsetParent !== null && i.type !== "checkbox" && i.type !== "radio" && i.type !== "hidden"
    );
    if (!inp) return "no-input";
    inp.focus(); setInputValue(inp, ""); setInputValue(inp, typeStr);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent("keyup", { key: typeStr.slice(-1), bubbles: true }));

    const want = norm(matchKor);
    let picked = false;
    for (let i = 0; i < 20; i++) {
      await wait(150);
      const cand = [...modal.querySelectorAll("li,div,a,td,span,p,tr")].filter((e) => {
        if (e === inp || !norm(e.textContent).includes(want)) return false;
        const r = e.getBoundingClientRect();
        return r.height > 4 && r.height < 70 && r.width < 500;
      });
      if (cand.length) {
        cand.sort((a, b) => a.offsetWidth * a.offsetHeight - b.offsetWidth * b.offsetHeight);
        fireMouse(cand[0].closest("li,tr,[role='option'],a") || cand[0]);
        await wait(300);
        picked = true;
        break;
      }
    }
    if (!picked) return "no-suggestion";
    // 확인 버튼
    const okBtn = [...modal.querySelectorAll("button,a,input[type='button'],input[type='submit']")].find(
      (b) => b.offsetParent !== null && /확인|저장|적용|등록/.test((b.textContent || b.value || ""))
    );
    if (okBtn) { fireMouse(okBtn); await wait(300); }
    return "added";
  }
  // 100만원 이상이면 Hans 승격 (참조 삭제 → 결재자 추가)
  async function promoteCeoIfNeeded(doc) {
    const ceo = (doc.grandTotal || 0) >= 1000000 ||
      ((doc.approval && doc.approval.approvers) || []).some((a) => /최철용|Hans/i.test(a.name || ""));
    if (!ceo) return null;
    const steps = [];
    // 안전: 결재자 추가가 성공한 뒤에만 참조에서 Hans 삭제
    const res = await addApprover("hans", "최철용");
    if (res === "added") {
      steps.push("결재자Hans추가");
      await wait(400);
      steps.push(removeReference("최철용") ? "참조Hans삭제" : "참조Hans삭제실패");
    } else {
      steps.push("결재자Hans추가실패(" + res + ")");
    }
    return steps;
  }

  async function fill(doc) {
    const ok = [];
    const fail = [];

    // 0) 문서 종류 선택 (폼이 안 떠 있으면)
    const dt = selectDocType();
    if (dt === "selected") await wait(1600); // 폼 렌더 대기

    const titleInput = findTitleInput();
    if (titleInput) { setInputValue(titleInput, doc.title); ok.push("제목"); }
    else fail.push("제목");

    // 1) SynapEditor 브릿지 시도 (에디터 init 타이밍 대비 재시도)
    let bodyDone = false;
    let r = await fillBodyViaBridge(doc.bodyHtml);
    for (let i = 0; i < 3 && !r.ok && r.method === "no-instance"; i++) {
      await wait(700);
      r = await fillBodyViaBridge(doc.bodyHtml);
    }
    let diagStr = "";
    if (r.diag) diagStr = `bridge=${r.diag.bridge} wrapped=${r.diag.wrapped} captured=${r.diag.captured} m=[${(r.diag.methods || []).join(",")}]`;
    if (r.ok) { bodyDone = true; ok.push("본문(" + r.method + ")"); }

    // 2) 폴백: contenteditable / iframe / textarea 직접 조작
    if (!bodyDone) {
      const ed = findEditor();
      if (ed) {
        if (ed.type === "textarea") setInputValue(ed.body, stripHtml(doc.bodyHtml));
        else { ed.body.innerHTML = doc.bodyHtml; ed.body.dispatchEvent(new Event("input", { bubbles: true })); }
        ok.push("본문(직접·" + r.method + ")");
      } else fail.push("본문");
    }

    // 3) 결재선: 참조에 sunny 자동 추가
    try {
      const added = await ensureReferences(doc);
      if (added.length) ok.push("참조+" + added.join(","));
    } catch (e) { /* ignore */ }

    // 4) 100만원↑: Hans 참조삭제 + 결재자 승격
    try {
      const steps = await promoteCeoIfNeeded(doc);
      if (steps) ok.push(steps.join("·"));
    } catch (e) { /* ignore */ }

    return { ok, fail, diag: diagStr };
  }

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.innerText;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) {}
  }

  const won = (n) => (Number.isFinite(+n) ? Math.round(+n) : 0).toLocaleString("ko-KR");

  // ── 플로팅 패널: 기안 대기(초안) 목록 ──
  // 제목 + 금액만 표시. 각 항목 [채우기] → 하이웍스에 제목·본문 자동입력.
  function renderPanel(list) {
    const old = document.getElementById("gm-panel");
    if (old) old.remove();
    list = Array.isArray(list) ? list : [];
    if (list.length === 0) return; // 대기 없으면 패널 안 띄움 (귀찮지 않게)

    const wrap = document.createElement("div");
    wrap.id = "gm-panel";
    wrap.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147483647;width:330px;max-height:70vh;background:#fff;" +
      "border:1px solid #DDD7EC;border-radius:16px;box-shadow:0 12px 40px rgba(30,27,46,.25);" +
      "font-family:'Pretendard',-apple-system,system-ui,sans-serif;color:#1E1B2E;overflow:hidden;display:flex;flex-direction:column";

    const rows = list.length
      ? list.map((d, i) => `
        <div class="gm-item" data-i="${i}" style="border:1px solid #E9E5F2;border-radius:10px;padding:10px 11px;margin-bottom:8px">
          <div style="display:flex;align-items:start;gap:6px;margin-bottom:6px">
            <div style="flex:1;font-size:12.5px;font-weight:700;line-height:1.35">${escapeHtml(String(d.title || "").replace(/^\[지출결의서\]\s*/, ""))}</div>
            <button class="gm-del-one" data-i="${i}" title="목록에서 삭제" style="flex:none;background:none;border:none;color:#C9C2DA;font-size:16px;line-height:1;cursor:pointer;padding:0 2px">×</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:14px;font-weight:800;color:${VD};font-variant-numeric:tabular-nums">₩${won(d.grandTotal)}</span>
            <button class="gm-fill-one" data-i="${i}" style="margin-left:auto;background:${V};color:#fff;border:none;border-radius:8px;padding:7px 14px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit">채우기</button>
          </div>
        </div>`).join("")
      : `<div style="text-align:center;color:#9B94AA;font-size:12.5px;padding:22px 8px;line-height:1.6">대기 중인 기안이 없어요.<br>앱에서 <b>[기안 대기에 담기]</b> 하면<br>여기 목록으로 떠요.</div>`;

    wrap.innerHTML = `
      <div style="background:linear-gradient(135deg,${V},${VD});color:#fff;padding:12px 14px;display:flex;align-items:center;gap:8px;flex:none">
        <div style="width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.2);display:grid;place-items:center;font-size:15px">🧾</div>
        <b style="font-size:14px;flex:1">GianMate 기안 대기${list.length ? ` (${list.length})` : ""}</b>
        <span id="gm-close" style="cursor:pointer;opacity:.85;font-size:18px;line-height:1">×</span>
      </div>
      <div style="padding:12px 14px;overflow-y:auto">
        ${rows}
        <div id="gm-msg" style="font-size:12px;margin-top:4px;min-height:16px;color:#16A34A;font-weight:700"></div>
        <div id="gm-diag" style="font-size:10px;margin-top:2px;color:#C9C2DA;word-break:break-all;font-family:monospace"></div>
        <div style="font-size:11px;color:#9B94AA;margin-top:6px;line-height:1.5">※ 세금계산서 첨부·결재선 확정·최종 <b>기안하기</b>는 직접 확인해주세요.</div>
      </div>`;
    document.body.appendChild(wrap);

    const msg = wrap.querySelector("#gm-msg");
    wrap.querySelector("#gm-close").onclick = () => wrap.remove();

    // 목록에서 항목 삭제 (중복 등)
    wrap.querySelectorAll(".gm-del-one").forEach((btn) => {
      btn.onclick = () => {
        const idx = +btn.dataset.i;
        const next = list.filter((_, i) => i !== idx);
        chrome.storage.local.set({ pendingList: next }, () => renderPanel(next));
      };
    });

    wrap.querySelectorAll(".gm-fill-one").forEach((btn) => {
      btn.onclick = async () => {
        const doc = list[+btn.dataset.i];
        if (!doc) return;
        btn.disabled = true; btn.textContent = "입력 중…";
        const { ok, fail, diag } = await fill(doc);
        btn.textContent = fail.length ? "다시" : "✓ 입력됨";
        btn.disabled = false;
        msg.style.color = fail.length ? "#D97706" : "#16A34A";
        msg.textContent =
          (ok.length ? `✓ ${ok.join(" · ")} 완료. ` : "") +
          (fail.length ? `${fail.join("·")} 실패` : "결재선 확인 후 기안하기!");
        if (diag) { const d = document.getElementById("gm-diag"); if (d) d.textContent = diag; }
      };
    });
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
