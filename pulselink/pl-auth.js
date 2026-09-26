// PulseLink の Web ページ共通: ウォッチの「Web code」でのサインイン。
// ウォッチが自分の Device ID を登録した後は、Device ID だけでは入れない。ウォッチの
// Device ID 画面で Web code を選ぶと 6 桁が出るので、それをここで入れてトークンに換える。
// 登録していないウォッチは今までどおり Device ID だけで入れる (コード欄は出ない)。
//
// 使い方: <script src="../pl-auth.js" data-kind="web|cam"></script> をページの本体より前に置く。
//   - PL の API への fetch には、トークンがあれば自動で Authorization を付ける (各ページの
//     fetch 呼び出しを書き換えなくて済むように、window.fetch を包む)。画像の配信は対象外。
//   - kind=cam は PL Cam の iPhone 用 (90 日)、それ以外は web (30 日)。
(function () {
  var API = 'https://mlbwatch-server.onrender.com/api/pulselink';
  var me = document.currentScript;
  var KIND = (me && me.getAttribute('data-kind') === 'cam') ? 'cam' : 'web';
  var KEY = 'pl_tok_' + KIND;
  var CODE_ERRORS = ['secret_required', 'token_invalid', 'token_revoked', 'token_scope'];

  function getTok() { try { return localStorage.getItem(KEY) || null; } catch (e) { return null; } }
  function setTok(t) { try { if (t) { localStorage.setItem(KEY, t); } else { localStorage.removeItem(KEY); } } catch (e) {} }

  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = (typeof input === 'string') ? input : ((input && input.url) || '');
    if (url.indexOf(API) === 0 && url.indexOf('/compass-image/') < 0 && url.indexOf('/web-auth') < 0) {
      var tok = getTok();
      if (tok) {
        init = Object.assign({}, init || {});
        init.headers = Object.assign({}, init.headers || {}, { Authorization: 'Bearer ' + tok });
      }
    }
    return origFetch(input, init);
  };

  // この 401 は「Web code が要る」種類か (本文の error で判定。応答本体は読み潰さない)。
  async function needsCode(r) {
    if (!r || r.status !== 401) { return false; }
    try { var j = await r.clone().json(); return CODE_ERRORS.indexOf(j && j.error) >= 0; }
    catch (e) { return false; }
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  // box の中にコード欄を出し、正しいコードでトークンを得たら true で解決する。
  function askCode(box, devId, isJa) {
    return new Promise(function (resolve) {
      var t = isJa ? {
        lead: 'このウォッチは登録済みです。ウォッチの Device ID 画面で <b>Web code</b> を選ぶと 6 桁が出ます。それをここに入力してください (10 分以内)。',
        btn: 'サインイン', bad: 'コードが違うか、期限が切れています。ウォッチで新しいコードを出してください。',
        net: '通信できませんでした: '
      } : {
        lead: 'This watch is registered. On the watch, open the Device ID screen and choose <b>Web code</b> to show 6 digits, then enter them here (within 10 minutes).',
        btn: 'Sign in', bad: 'That code is wrong or has expired. Show a new code on the watch.',
        net: 'Could not connect: '
      };
      box.innerHTML = '<div class="alert">' + t.lead
        + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<input id="plCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"'
        + ' style="font-size:20px;letter-spacing:4px;width:8.5em;padding:6px 10px;">'
        + '<button class="btn" id="plCodeBtn">' + t.btn + '</button></div>'
        + '<div id="plCodeMsg" style="margin-top:8px;color:#DC2626;"></div></div>';
      var inp = document.getElementById('plCode');
      var btn = document.getElementById('plCodeBtn');
      var msg = document.getElementById('plCodeMsg');
      try { inp.focus(); } catch (e) {}
      async function submit() {
        var code = (inp.value || '').replace(/\D/g, '');
        if (code.length !== 6) { msg.textContent = t.bad; return; }
        btn.disabled = true; msg.textContent = '';
        try {
          var r = await origFetch(API + '/web-auth', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: devId, code: code, kind: KIND })
          });
          if (!r.ok) { msg.textContent = t.bad; btn.disabled = false; return; }
          var j = await r.json();
          setTok(j.token);
          box.innerHTML = '';
          resolve(true);
        } catch (e) { msg.textContent = t.net + esc(e.message); btn.disabled = false; }
      }
      btn.addEventListener('click', submit);
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { submit(); } });
    });
  }

  window.plAuth = {
    kind: KIND,
    token: getTok,
    clear: function () { setTok(null); },
    clearAll: function () { try { localStorage.removeItem('pl_tok_web'); localStorage.removeItem('pl_tok_cam'); } catch (e) {} },
    needsCode: needsCode,
    askCode: askCode,
    // 画像 URL に付ける短期トークン (/user/me の img_t)。無ければ空文字。
    imgParam: function (imgT, first) { return imgT ? ((first ? '?' : '&') + 'it=' + encodeURIComponent(imgT)) : ''; }
  };
})();
