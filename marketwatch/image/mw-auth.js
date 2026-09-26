// MarketWatch の画像ページ: ウォッチの「Web code」でのサインイン (2026-09-26)。
// ウォッチ (MarketWatch の新版) が自分の Device ID を登録した後は、Device ID だけでは
// 画像のアップロード・削除ができない。ウォッチの Device ID 画面で Web code を選ぶと 6 桁が
// 出るので、それをここで入れてトークン (30 日) に換える。
// 登録していないウォッチは今までどおり Device ID だけで使える (コード欄は出ない)。
// 画像の表示 (取得) は今までどおり誰でも見られる。
//
// 使い方: ページ本体の script より前に <script src="mw-auth.js"></script>。
//   mwAuth.headers(id)      … その ID のトークンがあれば Authorization を返す
//   mwAuth.needsCode(r)     … 応答が「Web code が要る」401 か
//   mwAuth.askCode(box, id, isJa) … box にコード欄を出し、トークンを得たら true で解決
//   mwAuth.clear(id)        … その ID のトークンを消す
(function () {
  var API = 'https://mlbwatch-server.onrender.com/api/marketwatch';
  var CODE_ERRORS = ['web_code_required', 'token_revoked', 'invalid_token'];

  function keyOf(id) { return 'mw_img_tok_' + String(id || '').toLowerCase(); }
  function getTok(id) { try { return localStorage.getItem(keyOf(id)) || null; } catch (e) { return null; } }
  function setTok(id, t) {
    try { if (t) { localStorage.setItem(keyOf(id), t); } else { localStorage.removeItem(keyOf(id)); } } catch (e) {}
  }

  function headers(id) {
    var t = getTok(id);
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  // この 401 は「Web code が要る」種類か (本文の error で判定。応答本体は読み潰さない)。
  async function needsCode(r) {
    if (!r || r.status !== 401) { return false; }
    try { var j = await r.clone().json(); return CODE_ERRORS.indexOf(j && j.error) >= 0; }
    catch (e) { return false; }
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  function askCode(box, devId, isJa) {
    setTok(devId, null);   // 失効したトークンは捨てる
    return new Promise(function (resolve) {
      var t = isJa ? {
        lead: 'このウォッチは登録済みです。ウォッチの MarketWatch の Device ID メニューで <b>Web code</b> を選ぶと 6 桁が出ます。それをここに入力してください (10 分以内)。',
        btn: 'サインイン', bad: 'コードが違うか、期限が切れています。ウォッチで新しいコードを出してください。',
        net: '通信できませんでした: '
      } : {
        lead: 'This watch is registered. In MarketWatch on the watch, choose <b>Web code</b> in the Device ID menu to show 6 digits, then enter them here (within 10 minutes).',
        btn: 'Sign in', bad: 'That code is wrong or has expired. Show a new code on the watch.',
        net: 'Could not connect: '
      };
      box.innerHTML = '<div class="alert">' + t.lead
        + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
        + '<input id="mwCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"'
        + ' style="font-size:20px;letter-spacing:4px;width:8.5em;padding:6px 10px;">'
        + '<button class="btn" id="mwCodeBtn">' + t.btn + '</button></div>'
        + '<div id="mwCodeMsg" style="margin-top:8px;color:#DC2626;"></div></div>';
      var inp = document.getElementById('mwCode');
      var btn = document.getElementById('mwCodeBtn');
      var msg = document.getElementById('mwCodeMsg');
      try { inp.focus(); } catch (e) {}
      async function submit() {
        var code = (inp.value || '').replace(/\D/g, '');
        if (code.length !== 6) { msg.textContent = t.bad; return; }
        btn.disabled = true; msg.textContent = '';
        try {
          var r = await fetch(API + '/web-auth', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: devId, code: code })
          });
          if (!r.ok) { msg.textContent = t.bad; btn.disabled = false; return; }
          var j = await r.json();
          setTok(devId, j.token);
          box.innerHTML = '';
          resolve(true);
        } catch (e) { msg.textContent = t.net + esc(e.message); btn.disabled = false; }
      }
      btn.addEventListener('click', submit);
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { submit(); } });
    });
  }

  window.mwAuth = {
    headers: headers,
    needsCode: needsCode,
    askCode: askCode,
    clear: function (id) { setTok(id, null); }
  };
})();
