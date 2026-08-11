/* ============================================================
 *  EARTHCOM 共通認証モジュール   ec-auth.js   v1.1
 *
 *  各アプリの <head> に2行足すだけで、会社のGoogleアカウント
 *  ログインと役割別の権限判定が使えるようになります。
 *
 *  使い方 ------------------------------------------------------
 *  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *  <script src="./ec-auth.js"></script>
 *  <script>
 *    EC.guard({ app: 'bumoncho', allow: ['admin','manager','sales'] })
 *      .then(function (me) {
 *      // ここから先は認証済み。me.role / me.areas が使えます
 *      EC.mountBadge('#userBadge');   // 任意: 右上にユーザー表示
 *      startApp();
 *    });
 *  </script>
 *
 *  提供するもの ------------------------------------------------
 *  EC.supabase          Supabaseクライアント（各アプリで共用）
 *  EC.guard(opts)       認証ゲート。通過すると社員情報を返す
 *  EC.me                ログイン中の社員情報 {id,email,full_name,role,areas}
 *  EC.can('admin',...)  役割チェック（true/false）
 *  EC.canUseApp(id)     このアプリの利用許可があるか（true/false）
 *  EC.APPS              アプリ一覧 [[id, 名称], ...]
 *  EC.mountBadge(sel)   ユーザー名＋ログアウトのバッジを描画
 *  EC.signOut()         ログアウト
 * ============================================================ */
(function (global) {
  'use strict';

  var CONFIG = {
    url:    'https://aakofrzurgwrkctunthw.supabase.co',
    key:    'sb_publishable_yAUGrTJjqg56S16D7BI2oQ_pbt1olLa',
    domain: 'earthcom-eco.jp'
  };

  /* アプリ一覧。新しいアプリを作ったらここに1行足してください。
     idは app_users.apps に保存される値です（英数字とハイフンのみ）。 */
 var APPS = [
  ['bumoncho',     '部門長会議ボード'],
  ['refort-deals', 'ReFort査定スタジオ'],
  ['refort-board', 'ReFort現場判断ボード'],
  ['battery',      '低圧系統蓄電池シミュレーター'],
  ['secondary',    '高圧RF（セカンダリー）シミュレーター'],
  ['pipeline',     '商談パイプラインボード'],
  ['progress',     '工事進捗報告システム'],
  ['naiteisha',    '内定者オンボーディング管理'],
  ['planner',      'SUCCESS PLANNER'],
  ['portal',       '社内アプリ盤'],
  ['keikaku',      '経営計画書ポータル']
];

  var ROLE_LABEL = {
    admin:   '管理者',
    manager: '幹部',
    sales:   '営業',
    field:   '現場',
    viewer:  '未承認'
  };

  if (!global.supabase || !global.supabase.createClient) {
    throw new Error('ec-auth.js: supabase-js を先に読み込んでください');
  }

  var client = global.supabase.createClient(CONFIG.url, CONFIG.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var EC = {
    supabase: client,
    me: null,
    can: function () {
      if (!EC.me) return false;
      var roles = Array.prototype.slice.call(arguments);
      return roles.indexOf(EC.me.role) !== -1;
    },
    signOut: function () {
      return client.auth.signOut().then(function () { location.reload(); });
    }
  };

  /* ---------- 画面 ------------------------------------------ */

  function injectStyle() {
    if (document.getElementById('ec-auth-style')) return;
    var css = [
      '#ec-auth-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:#0E1B2B;color:#E8EDF3;font-family:"Noto Sans JP",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;padding:24px}',
      '#ec-auth-gate .box{width:100%;max-width:400px;background:#152B42;border:1px solid #23415F;border-radius:14px;padding:36px 32px;text-align:center}',
      '#ec-auth-gate .mark{font-size:11px;letter-spacing:.22em;color:#5FBFA0;font-weight:700;margin-bottom:22px}',
      '#ec-auth-gate h1{font-size:19px;font-weight:700;margin:0 0 10px;letter-spacing:.02em}',
      '#ec-auth-gate p{font-size:13px;line-height:1.85;color:#9FB3C8;margin:0 0 26px}',
      '#ec-auth-gate button{width:100%;padding:13px;border:0;border-radius:9px;background:#fff;color:#1F2937;',
      'font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:10px}',
      '#ec-auth-gate button:hover{background:#EEF2F6}',
      '#ec-auth-gate button:focus-visible{outline:3px solid #5FBFA0;outline-offset:2px}',
      '#ec-auth-gate .sub{margin:20px 0 0;font-size:11.5px;color:#6B8299;line-height:1.7}',
      '#ec-auth-gate .err{margin:18px 0 0;font-size:12.5px;color:#F0A0A0;line-height:1.8;text-align:left;',
      'background:#2A1A20;border:1px solid #5C2E38;border-radius:8px;padding:12px 14px}',
      '#ec-auth-gate .spin{width:26px;height:26px;margin:0 auto;border:2.5px solid #23415F;border-top-color:#5FBFA0;',
      'border-radius:50%;animation:ec-spin .8s linear infinite}',
      '@keyframes ec-spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.spin{animation:none}}',
      '.ec-badge{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;color:#3C4A5A;',
      'font-family:"Noto Sans JP",system-ui,sans-serif}',
      '.ec-badge .role{font-size:10.5px;font-weight:700;letter-spacing:.06em;padding:3px 8px;border-radius:5px;',
      'background:#E4EFEA;color:#1F6B52}',
      '.ec-badge .out{background:none;border:0;color:#7C8B9C;font-size:11.5px;cursor:pointer;text-decoration:underline;',
      'font-family:inherit;padding:2px 4px}',
      '.ec-badge .out:hover{color:#C0392B}'
    ].join('');
    var el = document.createElement('style');
    el.id = 'ec-auth-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function gate(html) {
    injectStyle();
    var g = document.getElementById('ec-auth-gate');
    if (!g) {
      g = document.createElement('div');
      g.id = 'ec-auth-gate';
      document.body.appendChild(g);
    }
    g.innerHTML = '<div class="box">' + html + '</div>';
    return g;
  }

  function closeGate() {
    var g = document.getElementById('ec-auth-gate');
    if (g) g.remove();
  }

  var GOOGLE_ICON =
    '<svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-3.9H24v7.1h12c-.2 1.9-1.5 4.7-4.4 6.6l6.7 5.2C42.2 35.4 45 30.2 45 24z"/>' +
    '<path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.1 15.4 46 24 46z"/>' +
    '<path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 9.9l7.1-5.5z"/>' +
    '<path fill="#EA4335" d="M24 10.6c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.4 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.1 5.5c1.8-5.3 6.7-9 12.5-9z"/></svg>';

  function screenLogin(errorMsg) {
    var html =
      '<div class="mark">EARTHCOM</div>' +
      '<h1>社内アプリにログイン</h1>' +
      '<p>会社のGoogleアカウントでログインしてください。</p>' +
      '<button id="ec-login" type="button">' + GOOGLE_ICON + 'Googleでログイン</button>' +
      '<p class="sub">@' + CONFIG.domain + ' のアカウントのみ利用できます</p>' +
      (errorMsg ? '<div class="err">' + errorMsg + '</div>' : '');
    gate(html);
    document.getElementById('ec-login').addEventListener('click', function () {
      client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: location.href.split('#')[0],
          queryParams: { hd: CONFIG.domain, prompt: 'select_account' }
        }
      });
    });
  }

  function screenLoading(msg) {
    gate('<div class="spin"></div><p style="margin-top:20px;margin-bottom:0">' + (msg || '確認しています') + '</p>');
  }

  function screenPending(me) {
    gate(
      '<div class="mark">EARTHCOM</div>' +
      '<h1>承認をお待ちください</h1>' +
      '<p>' + escapeHtml(me.email) + ' でログインしました。<br>' +
      '管理者が利用権限を設定すると使えるようになります。</p>' +
      '<button id="ec-out" type="button">別のアカウントでログイン</button>'
    );
    document.getElementById('ec-out').addEventListener('click', EC.signOut);
  }

  function screenDenied(me, appId) {
    gate(
      '<div class="mark">EARTHCOM</div>' +
      '<h1>このアプリの利用権限がありません</h1>' +
      '<p>' + escapeHtml(me.full_name || me.email) + '（' + (ROLE_LABEL[me.role] || me.role) + '）<br>' +
      (appId ? escapeHtml(EC.appLabel(appId)) + ' は許可されていません。<br>' : '') +
      '必要な場合は管理者に権限の変更を依頼してください。</p>' +
      '<button id="ec-out" type="button">ログアウト</button>'
    );
    document.getElementById('ec-out').addEventListener('click', EC.signOut);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 本体 ------------------------------------------ */

  function readUrlError() {
    var q = new URLSearchParams(location.search);
    var h = new URLSearchParams(location.hash.replace(/^#/, ''));
    var desc = q.get('error_description') || h.get('error_description');
    if (!desc) return null;
    history.replaceState(null, '', location.pathname);
    if (/earthcom-eco/.test(desc) || /Database error/i.test(desc)) {
      return '会社のGoogleアカウント（@' + CONFIG.domain + '）でログインしてください。個人のGmailでは利用できません。';
    }
    return decodeURIComponent(desc);
  }

  function fetchMe(userId) {
    return client.from('app_users')
      .select('id,email,full_name,role,areas,is_active,apps')
      .eq('id', userId)
      .maybeSingle()
      .then(function (r) {
        if (!r.error) return r.data;
        // apps列がまだ無い場合は従来の列だけで読む（移行中も動くように）
        return client.from('app_users')
          .select('id,email,full_name,role,areas,is_active')
          .eq('id', userId)
          .maybeSingle()
          .then(function (r2) { return r2.data; });
      });
  }

  /**
   * 認証ゲート。
   * @param {Object} opts
   * @param {string[]} [opts.allow] 通過を許可する役割。省略時は viewer 以外すべて
   * @returns {Promise<Object>} 社員情報
   */
  EC.guard = function (opts) {
    opts = opts || {};
    var allow = opts.allow || ['admin', 'manager', 'sales', 'field'];
    var app = opts.app || null;                        // アプリ別の利用許可
    var adminBypass = opts.adminBypass !== false;      // 管理者は既定で素通し

    return new Promise(function (resolve) {
      var urlError = readUrlError();
      screenLoading();

      client.auth.getSession().then(function (res) {
        var session = res.data.session;
        if (!session) { screenLogin(urlError); return; }

        return fetchMe(session.user.id).then(function (me) {
          // トリガーでの行作成がわずかに遅れる場合があるので一度だけ再試行
          if (!me) {
            return new Promise(function (r) { setTimeout(r, 900); })
              .then(function () { return fetchMe(session.user.id); });
          }
          return me;
        }).then(function (me) {
          if (!me) {
            screenLogin('社員情報を読み込めませんでした。もう一度ログインしてください。');
            return;
          }
          if (!me.is_active) {
            screenDenied(me);
            return;
          }
          if (allow.indexOf(me.role) === -1) {
            if (me.role === 'viewer') screenPending(me);
            else screenDenied(me);
            return;
          }
          EC.me = me;
          if (app && !(adminBypass && me.role === 'admin') && !EC.canUseApp(app)) {
            EC.me = null;
            screenDenied(me, app);
            return;
          }
          if (location.hash.indexOf('access_token') !== -1) {
            history.replaceState(null, '', location.pathname + location.search);
          }
          closeGate();
          resolve(me);
        });
      }).catch(function (e) {
        screenLogin('接続に失敗しました: ' + escapeHtml(e.message || e));
      });
    });
  };

  /** 右上などに置くユーザーバッジ */
  EC.mountBadge = function (selector) {
    var host = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!host || !EC.me) return;
    injectStyle();
    host.innerHTML =
      '<span class="ec-badge">' +
      '<span class="role">' + (ROLE_LABEL[EC.me.role] || EC.me.role) + '</span>' +
      '<span>' + escapeHtml(EC.me.full_name || EC.me.email) + '</span>' +
      '<button class="out" type="button">ログアウト</button></span>';
    host.querySelector('.out').addEventListener('click', EC.signOut);
  };

  EC.roleLabel = function (r) { return ROLE_LABEL[r] || r; };

  EC.APPS = APPS;

  EC.appLabel = function (id) {
    for (var i = 0; i < APPS.length; i++) if (APPS[i][0] === id) return APPS[i][1];
    return id;
  };

  /** ログイン中の社員がこのアプリを使えるか */
  EC.canUseApp = function (id) {
    if (!EC.me) return false;
    if (EC.me.role === 'admin') return true;
    var list = EC.me.apps || [];
    return list.indexOf(id) !== -1;
  };

  global.EC = EC;
})(window);
