// ==UserScript==
// @name         VIA calibration visualizer (HHKB DMK)
// @namespace    local
// @version      1.0.2
// @description  DMK の測定(キャリブレーション)で、今回測ったキーをキー配列の絵に強調色で塗る。レイヤー 0〜3 の右に切り替えボタンを足す。
// @match        https://usevia.app/*
// @match        https://www.usevia.app/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @inject-into  page
// ==/UserScript==

/* 何をしているか
   DMK は測定中、HID のコンソール(usagePage 0xFF31)に、こういう行を流す:
     [CAL] Calibration started: capturing baseline (16 samples)...   … 測定開始(ここで記録をリセット)
     [CAL] [====   ] 20% (12/60) | Key R1 C3 peak: 2650 (base: 1200)  … R1 C3 のキーが測れた
   VIA の「コンソール」画面はこれを文字で出すだけ。どのキーが終わったか目で追うのは無理。
   なので、ページが読み込まれる前(document-start)に WebHID に割り込んで、コンソールの報告を
   横から一緒に受け取り(tee)、測れたキーをキー配列の絵の上で強調色に塗る。

   VIA はコンソール画面を開くまで 0xFF31 を開かないので、このスクリプトが自分で開く。
   あとから VIA が開こう・閉じようとしても困らないように、open / close を少しだけ包んでいる:
     - もう開いている端末への open() は、何もせず成功扱い
     - コンソールの端末への close() は無視(閉じられると、こっちの受信も止まるため)

   ※ 行が流れてくるのは、HHKB → 保守・診断 → 「測定の経過出力」(Calibration Monitor)がオンのときだけ。 */

(() => {
  'use strict';
  if (!('hid' in navigator) || typeof HIDDevice === 'undefined') return;

  const CONSOLE_PAGE = 0xff31;
  const ACCENT = '#4CC2FF';

  /* 絵のキーの並び順(左上から右下)と、ファームウェアの行・列(R,C)の対応。
     DMK の via.json の matrix ラベル "r,c" と同じ。HHKB ANSI 60 キー。 */
  const LAYOUT = [
    '1,0', '1,3', '1,1', '1,2', '1,4', '1,5', '1,6', '1,7', '1,11', '1,8', '1,9', '1,10', '1,12', '1,14', '1,13',
    '2,0', '2,3', '2,1', '2,2', '2,4', '2,5', '2,7', '2,11', '2,8', '2,9', '2,10', '2,12', '2,14', '2,13',
    '3,0', '3,3', '3,1', '3,2', '0,5', '2,6', '3,7', '3,11', '3,8', '3,9', '3,10', '3,12', '3,14',
    '0,0', '0,1', '0,2', '3,4', '3,5', '3,6', '0,7', '0,11', '0,8', '0,9', '0,12', '0,14', '3,13',
    '0,3', '0,4', '0,6', '0,10', '0,13',
  ];

  const state = {
    done: new Set(),     // 今回測れたキー("r,c")
    total: LAYOUT.length,
    seenCal: false,      // [CAL] の行を一度でも受け取ったか
    on: false,           // 絵に塗るかどうか
  };
  try { state.on = localStorage.getItem('via-cal-visualizer') === 'on'; } catch (_) { /* 読めなくても動く */ }

  /* ---------- コンソールの行を受け取る ---------- */
  let lineBuf = '';
  const decoder = new TextDecoder();

  function handleLine(line) {
    if (!line.includes('[CAL]')) return;
    state.seenCal = true;
    if (/Calibration started|Baseline captured/.test(line)) {
      state.done.clear();
    }
    const m = line.match(/\((\d+)\/(\d+)\)\s*\|\s*Key R(\d+) C(\d+)/);
    if (m) {
      state.total = Number(m[2]) || state.total;
      state.done.add(`${m[3]},${m[4]}`);
    }
    render();
  }

  function onReport(ev) {
    const bytes = new Uint8Array(ev.data.buffer, ev.data.byteOffset, ev.data.byteLength);
    let end = bytes.indexOf(0);
    if (end < 0) end = bytes.length;
    lineBuf += decoder.decode(bytes.subarray(0, end));
    let nl;
    while ((nl = lineBuf.indexOf('\n')) >= 0) {
      handleLine(lineBuf.slice(0, nl).replace(/\r$/, ''));
      lineBuf = lineBuf.slice(nl + 1);
    }
    if (lineBuf.length > 4096) lineBuf = '';
  }

  const isConsole = (d) => d.collections.some((c) => c.usagePage === CONSOLE_PAGE);
  const tapped = new WeakSet();

  const origOpen = HIDDevice.prototype.open;
  const origClose = HIDDevice.prototype.close;
  HIDDevice.prototype.open = function (...args) {
    if (this.opened) return Promise.resolve();
    return origOpen.apply(this, args);
  };
  HIDDevice.prototype.close = function (...args) {
    if (isConsole(this)) return Promise.resolve();
    return origClose.apply(this, args);
  };

  async function tap(d) {
    if (!isConsole(d) || tapped.has(d)) return;
    tapped.add(d);
    try {
      if (!d.opened) await origOpen.call(d);
      d.addEventListener('inputreport', onReport);
    } catch (e) {
      tapped.delete(d);
    }
  }
  async function tapAll() {
    try { (await navigator.hid.getDevices()).forEach(tap); } catch (_) { /* 権限が無いうちは空 */ }
  }
  navigator.hid.addEventListener('connect', (e) => tap(e.device));
  navigator.hid.addEventListener('disconnect', (e) => tapped.delete(e.device));
  // 「デバイスを認証」で許可された直後にも拾えるように、定期的に見回る
  setInterval(tapAll, 2000);
  tapAll();

  /* ---------- 見た目 ---------- */
  const KEY_SEL = 'div[style*="pointer-events: all"][style*="position: absolute"] > div > div:last-child > div > div';
  const LAYER_ROW_SEL = 'div:has(> label + button + button + button + button)';

  const css = `
    /* 測れたキー:天面を強調色、刻印を黒、斜面は強調色を暗く */
    html ${KEY_SEL}[data-vcal="done"] {
      background-color: color-mix(in srgb, ${ACCENT} 65%, #000) !important;
    }
    html ${KEY_SEL}[data-vcal="done"] > div:has(> canvas) {
      background-color: ${ACCENT} !important;
      filter: none !important;
    }
    html ${KEY_SEL}[data-vcal="done"] > div:has(> canvas) > canvas {
      filter: brightness(0) !important;
    }
    /* レイヤー 0〜3 の右の切り替えボタン。見た目はレイヤーのボタンにそろえる */
    #via-cal-btn {
      font: inherit;
      font-size: 14px;
      height: 30px;
      padding: 0 12px;
      margin: 0 0 0 12px;
      border: 1px solid var(--p-border, #3C3C3C);
      border-radius: 4px;
      background: var(--p-control, #323232);
      color: var(--p-text, #E8E8E8);
      cursor: pointer;
      white-space: nowrap;
    }
    #via-cal-btn:hover { background: var(--p-control-hi, #3A3A3A); }
    #via-cal-btn[aria-pressed="true"] {
      background: ${ACCENT};
      border-color: ${ACCENT};
      color: #000;
    }
    #via-cal-hint {
      font-size: 13px;
      color: var(--p-text-dim, #9A9A9A);
      margin-left: 10px;
      white-space: nowrap;
    }
  `;

  function ensureStyle() {
    if (document.getElementById('via-cal-style')) return;
    const s = document.createElement('style');
    s.id = 'via-cal-style';
    s.textContent = css;
    (document.head || document.documentElement).append(s);
  }

  function ensureButton() {
    const row = document.querySelector(LAYER_ROW_SEL);
    if (!row) return null;
    let btn = row.querySelector('#via-cal-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'via-cal-btn';
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.on = !state.on;
        try { localStorage.setItem('via-cal-visualizer', state.on ? 'on' : 'off'); } catch (_) { /* 覚えられなくても動く */ }
        render();
      });
      const hint = document.createElement('span');
      hint.id = 'via-cal-hint';
      row.append(btn, hint);
    }
    return btn;
  }

  function render() {
    ensureStyle();
    const btn = ensureButton();
    if (btn) {
      btn.textContent = `測定済みを表示 ${state.done.size}/${state.total}`;
      btn.setAttribute('aria-pressed', String(state.on));
      const hint = btn.parentElement.querySelector('#via-cal-hint');
      if (hint) {
        hint.textContent = state.on && !state.seenCal
          ? '測定の記録がまだ届いていません(HHKB → 保守・診断 → 測定の経過出力 をオンにして、測定を開始)'
          : '';
      }
    }
    // 塗るのはキー配列の画面(/)の絵だけ。VIA は定義ファイル画面の絵も裏に置いているので、
    // URL で絞らないとそっちまで塗られる。60 キーの絵だけが対象(キーテストの 108 キーの絵は違う)
    const onKeymap = location.pathname === '/' || location.pathname === '';
    const drawings = document.querySelectorAll('div[style*="pointer-events: all"][style*="position: absolute"]');
    let first = true;
    for (const dr of drawings) {
      // ラベルが長すぎるキー(LM(2,MOD_LALT) など)は、VIA が吹き出し用の箱を隣に足すので、
      // 絵(canvas)を持つものだけを数える。数えないと 61 個になって色付けがずれる。
      const keys = [...dr.querySelectorAll(':scope > div > div:last-child > div > div')]
        .filter((k) => k.querySelector('canvas'));
      if (keys.length !== LAYOUT.length) continue;
      const paint = onKeymap && first;  // 並びの最初の 60 キーの絵がキー配列の画面のもの
      first = false;
      keys.forEach((k, i) => {
        const want = paint && state.on && state.done.has(LAYOUT[i]) ? 'done' : null;
        if (want) {
          if (k.dataset.vcal !== want) k.dataset.vcal = want;
        } else if (k.dataset.vcal) {
          delete k.dataset.vcal;
        }
      });
    }
  }

  // VIA は画面を作り直すので、ボタンと塗りは定期的にかけ直す(60 個の属性を見るだけなので軽い)
  setInterval(render, 500);
  document.addEventListener('DOMContentLoaded', render);
})();
