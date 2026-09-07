// ── 하이웍스 페이지 "내부(MAIN world)" · document_start 실행 ──
// SynapEditor 브릿지(window.synapEditorBridge)에는 setInstance 만 노출돼 있고
// 에디터 인스턴스를 꺼낼 방법이 없다. 그래서 페이지가 setInstance 를 호출하는
// 순간을 가로채서 인스턴스를 붙잡아 둔다. (문서종류 선택 후 에디터가 init될 때 잡힘)
// SynapEditor API: openHTML(html) / insertHTML(html) / setText / setContentsToPaste

(function () {
  let captured = null;
  function grab(inst) { if (inst && typeof inst === "object") { captured = inst; window.__gmSynap = inst; } }

  function wrapBridge(b) {
    if (!b || b.__gmWrapped) return;
    const orig = b.setInstance;
    if (typeof orig === "function") {
      b.setInstance = function () {
        // 인자 중 에디터스러운(=API 가진) 것을 붙잡기
        for (const a of arguments) {
          if (a && typeof a === "object" && (typeof a.insertHTML === "function" || typeof a.openHTML === "function")) grab(a);
        }
        const ret = orig.apply(this, arguments);
        if (ret && (typeof ret.insertHTML === "function" || typeof ret.openHTML === "function")) grab(ret);
        // setInstance 실행 후 this 에 인스턴스가 저장됐을 수도
        for (const k in this) { try { const v = this[k]; if (v && typeof v === "object" && (typeof v.insertHTML === "function" || typeof v.openHTML === "function")) grab(v); } catch (e) {} }
        return ret;
      };
      b.__gmWrapped = true;
    }
  }

  // 이미 있으면 즉시 래핑, 없으면 정의되는 순간 래핑
  if (window.synapEditorBridge) wrapBridge(window.synapEditorBridge);
  else {
    let _b;
    try {
      Object.defineProperty(window, "synapEditorBridge", {
        configurable: true,
        enumerable: true,
        get() { return _b; },
        set(v) { _b = v; wrapBridge(v); },
      });
    } catch (e) { /* 이미 정의됨 */ }
  }

  function hasFn(o, n) { return o && typeof o[n] === "function"; }

  function findInstance() {
    if (captured) return captured;
    if (window.__gmSynap) return window.__gmSynap;
    // 전역 스캔 폴백
    const SE = window.SynapEditor;
    if (SE) {
      if (SE.instances) { const v = Object.values(SE.instances).find((x) => hasFn(x, "insertHTML") || hasFn(x, "openHTML")); if (v) return v; }
      if (hasFn(SE, "getEditor")) { try { const v = SE.getEditor(); if (v) return v; } catch (e) {} }
    }
    for (const k of Object.keys(window)) {
      if (!/synap|editor/i.test(k)) continue;
      try { const v = window[k]; if (v && typeof v === "object" && (hasFn(v, "insertHTML") || hasFn(v, "openHTML"))) return v; } catch (e) {}
    }
    return null;
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "gm-setbody") return;
    const html = e.data.html || "";
    let done = "";
    const diag = { bridge: !!window.synapEditorBridge, wrapped: !!(window.synapEditorBridge && window.synapEditorBridge.__gmWrapped), captured: !!captured };
    try {
      const inst = findInstance();
      if (inst) {
        diag.methods = ["insertHTML", "openHTML", "setText", "setContentsToPaste"].filter((m) => hasFn(inst, m));
        const order = ["openHTML", "insertHTML", "setContentsToPaste"];
        for (const m of order) {
          if (hasFn(inst, m)) { try { inst[m](html); done = m; break; } catch (x) { diag["err_" + m] = String(x && x.message).slice(0, 40); } }
        }
      }
    } catch (err) { done = "error:" + (err && err.message); }
    window.postMessage({ source: "gm-setbody-result", ok: !!done && !done.startsWith("error"), method: done || "no-instance", diag }, "*");
  });
})();
