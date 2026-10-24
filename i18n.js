// =====================================================================
//  ホルムズ海峡を駆け抜けろ！ — 多言語対応（言語の切り替え・保存・フォールバック）
//
//  ・文章そのものは lang フォルダの言語ファイル（ja.js / en.js / zh-CN.js / vi.js）にあります。
//  ・日本語（ja）が基準言語です。選んだ言語に文章が無いときは日本語を表示します。
//  ・選んだ言語はブラウザ内に「ゲームのセーブとは別に」保存します（NEW GAME やセーブ削除では消えません）。
//  ・初めて遊ぶときは、ブラウザの言語が対応言語ならその言語、それ以外は日本語で始まります。
// =====================================================================
(function () {
  'use strict';
  const PACKS = window.HORMUZ_LANG || {};
  const BASE = 'ja';
  const ORDER = ['ja', 'en', 'zh-CN', 'vi']; // 言語選択ボタンの並び順（言語ファイルがあるものだけ表示）
  const LANG_KEY = 'hormuz_lang_v1';         // 言語設定の保存場所（セーブデータ hormuz_save_v1 とは別）

  // ブラウザの言語設定から対応言語を選ぶ（無ければ日本語）
  function fromBrowser() {
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    for (const raw of list) {
      const l = String(raw || '').toLowerCase();
      if (l.startsWith('ja')) return 'ja';
      if (l.startsWith('en')) return 'en';
      if (l.startsWith('zh')) return 'zh-CN'; // 中国語は簡体字のみ対応
      if (l.startsWith('vi')) return 'vi';
    }
    return BASE;
  }
  function readSaved() {
    try { const v = window.localStorage.getItem(LANG_KEY); return v && PACKS[v] ? v : null; } catch (e) { return null; }
  }

  let lang = readSaved() || fromBrowser();
  if (!PACKS[lang]) lang = BASE;

  const pack = (l) => PACKS[l] || {};
  // 文章を取り出す。{name} の部分は params の値で置き換える
  function t(key, params) {
    const s = (pack(lang).strings || {})[key];
    let text = s != null ? s : (pack(BASE).strings || {})[key];
    if (text == null) text = key;
    if (params) text = String(text).replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
    return text;
  }
  // 船長のセリフ・第11ステージの無線など（日本語は dialogues.js、ほかの言語は各言語ファイル）
  function dialogues() {
    const ja = window.DIALOGUES || {};
    const d = lang === BASE ? null : pack(lang).dialogues;
    return { cur: d || {}, ja };
  }
  // HTML に書かれた固定の文章を、今の言語に置き換える
  //   data-i18n="キー"       … 文字だけを置き換える
  //   data-i18n-html="キー"  … 太字などの印を含めて置き換える
  //   data-i18n-aria="キー"  … 読み上げ用の名前（aria-label）を置き換える
  function applyDom(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.documentElement.lang = pack(lang).htmlLang || lang;
    const prefix = document.title.startsWith('[DEBUG] ') ? '[DEBUG] ' : '';
    document.title = prefix + t('meta.docTitle');
  }
  function setLang(l) {
    if (!PACKS[l]) return false;
    lang = l;
    try { window.localStorage.setItem(LANG_KEY, l); } catch (e) { /* 保存できない環境では、この画面を開いている間だけ有効 */ }
    applyDom();
    return true;
  }

  window.I18N = {
    t, setLang, applyDom, dialogues,
    get lang() { return lang; },
    languages: () => ORDER.filter((l) => PACKS[l]).map((l) => ({ code: l, name: pack(l).name || l })),
  };
})();
