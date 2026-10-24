// =====================================================================
//  ホルムズ海峡を駆け抜けろ！ — 言語ファイル：日本語（基準言語）
//
//  ・画面に表示する文章をまとめたファイルです。ゲームの処理（game.js）とは分けてあります。
//  ・日本語は基準言語です。ほかの言語ファイルに無い文章は、ここの日本語が表示されます。
//  ・{stage} や {banked} などの { } で囲まれた部分には、ゲームが数字や名前を入れます。消さないでください。
//  ・<b> や <br> は太字・改行の印です。
//  ・船長のセリフと第11ステージの無線・警報（日本語）は dialogues.js で管理しています。
//
//  【言語を追加するとき】
//   1. このファイルをコピーして lang/（言語コード）.js を作り、下の HORMUZ_LANG['ja'] の 'ja' と
//      name・htmlLang を書き換えて、文章を翻訳する（翻訳しなかった項目は日本語で表示される）。
//   2. index.html と build_public.ps1 に、そのファイルの読み込み・コピーを1行ずつ追加する。
// =====================================================================
window.HORMUZ_LANG = window.HORMUZ_LANG || {};
window.HORMUZ_LANG['ja'] = {
  name: '日本語',          // 言語選択ボタンに表示する名前
  htmlLang: 'ja',          // <html lang="…"> に入れる値（文字の形を正しく表示するため）
  // 船長のセリフ・第11ステージの無線は dialogues.js（window.DIALOGUES）を使う
  dialogues: null,
  strings: {
    // ---- 共通 ----
    'meta.docTitle': 'ホルムズ海峡を駆け抜けろ！',
    'lang.aria': '言語を選ぶ',
    'common.banked': '清算済み累計スコア',
    'common.threatSep': ' / ',

    // ---- 3Dラベル（海図上の地名） ----
    'label.vlcc': 'VLCC（依頼主）',
    'label.terminal': '原油積込ターミナル',
    'label.entry': '▼ 海峡入口（契約破棄 限界線）',
    'label.strait': 'ホルムズ海峡',
    'label.iran': 'イラン側（武装艇に注意）',
    'label.oman': 'オマーン側（浅瀬・岩礁注意）',

    // ---- サウンド設定 ----
    'sound.bgmVolAria': 'BGM音量',
    'sound.sfx': '効果音',
    'sound.sfxVolAria': '効果音の音量',
    'sound.hintM': 'M キーでBGMのON/OFF',

    // ---- タイトル画面 ----
    'title.catch': '君は世界を救えるか？',
    'title.h1': 'ホルムズ海峡を駆け抜けろ！',
    'title.sub': 'STRAIT RUNNER — 架空の海域を舞台にした船舶アクション',
    'title.story1': 'あなたは小型タンカーの船長。インド洋側に停泊する超大型タンカー（VLCC）の船長から、<b>危険な海峡の向こうにある原油ターミナルから原油を運んでくる</b>仕事を請け負った。',
    'title.story2': 'VLCCを出発し、ホルムズ海峡を抜けて湾内のターミナルで原油を積み込み、再び海峡を越えてVLCCへ戻れば契約完了。',
    'title.rule.reward': '契約報酬（1往復）',
    'title.rule.damage': '被弾・座礁・ペナルティ',
    'title.rule.damageVal': '報酬から差し引き',
    'title.rule.fatal': '機雷・ミサイル直撃 / ドローン被弾上限',
    'title.rule.fatalVal': '即ゲームオーバー',
    'title.rule.over': 'ゲームオーバー時',
    'title.rule.overVal': '累計報酬は保持。失敗したステージから再挑戦',
    'title.rule.stages': '全ステージ',
    'title.retreatHint': '<b>稼ぐことより、どこで手を引くかが問われる。</b>契約を終えるたびに、次の仕事を受けるか撤退するかを選べる。',
    'title.keysPc': '<b>操舵：</b>A/D または ←/→（押している間だけ舵が切れ、離すと中央に戻る。船は前進しながら弧を描いて曲がる）<br>' +
      '<b>その他：</b>W/S・↑/↓ スロットル　Space ダッシュ　G GPS　P 一時停止（画面下のスイッチはマウスでも操作可）<br>' +
      '<b>積み込み／引き渡し：</b>黄色い円の中で「停止」または十分に減速する',
    'title.keysTouch': '<b>操舵：</b>左下の ◀ ▶ を押している間だけ舵が切れ、離すと中央に戻る<br>' +
      '<b>その他：</b>右下の ▲加速・▼減速、DASH、GPS　上の II で一時停止（横向きでプレイ）<br>' +
      '<b>積み込み／引き渡し：</b>黄色い円の中で ▼ を押して「停止」にする',

    // ---- タイトルのボタン・セーブ ----
    'btn.continue': 'CONTINUE',
    'btn.continueSub': 'STAGE {stage} から ／ 累計 {banked}',
    'btn.newGame': 'NEW GAME',
    'btn.start': '世界を救ってみる',
    'btn.quit': '他の仕事を探す',
    'save.corrupt': '⚠ セーブデータを読み込めなかったため、続きから再開できません。「世界を救ってみる」で最初から始められます。',
    'save.unavailable': '⚠ この環境では進行状況を保存できません（ゲームは遊べますが、ページを閉じると最初からになります）。',
    'save.completed': '前回の航海は「ホルムズ海峡の伝説」で完結しました。「世界を救ってみる」で新しい航海を始められます。',

    // ---- NEW GAME の確認 ----
    'newgame.hasSave': '続きのセーブデータ（STAGE {stage} から・累計 {banked}）があります。',
    'newgame.warn': 'ステージ1から始めると、このセーブデータは<b>削除</b>されます。よろしいですか？',
    'newgame.yes': '削除して最初から始める',
    'newgame.no': 'やめる',

    // ---- 他の仕事を探す（終了） ----
    'quit.h2': 'お仕事探し、頑張ってください。',
    'quit.p': 'ゲームを終了しました。このタブを閉じてください。',

    // ---- ステージ開始前 ----
    'intro.reward': '契約報酬 <b>{reward}</b>',
    'intro.danger': '危険度',
    'intro.unmeasurable': '測定不能',
    'intro.seaInfo': '海域情報',
    'intro.crosstalk': '— 通信が混線している —',
    'intro.rewardPending': '契約報酬（未清算）',
    'intro.threats': '確認された脅威',
    'intro.route': 'ルート：VLCC出発 → 海峡通過 → 原油ターミナルで積込 → 海峡通過 → VLCCへ帰還<br>' +
      '海峡入口（黄色いブイ列）を越えるまでは「契約破棄」で今回の航海を中止できる（損益は破棄。CONTINUEで同じステージに再挑戦）。',
    'intro.sail': '出航',
    'threat.mines': '機雷 {n}基',
    'threat.boats': '武装小型艇 {n}隻',
    'threat.rocks': '岩礁・浅瀬',
    'threat.drone': '自爆ドローン',
    'threat.missile': '対艦ミサイル',
    'threat.gpsJam': 'GPS妨害',

    // ---- 航行中のメッセージ ----
    'msg.sail': 'STAGE {stage} 出航！\n原油ターミナルへ向かえ',
    'msg.strait': 'ホルムズ海峡に進入\nもう契約は破棄できない',
    'msg.loaded': '原油満載！ VLCCへ帰還せよ\n船が重くなり、操船が鈍くなった',
    'msg.spotted': '⚠ 武装小型艇に発見された！',
    'msg.warnShots': '⚠ 警告射撃！',
    'msg.injured': '乗組員が負傷！（負傷者 {n}名）',
    'msg.droneLoaded': '自爆ドローン被弾！ 積荷が炎上！\n残り耐久：あと{n}発',
    'msg.droneEmpty': '自爆ドローン被弾！\n残り耐久：あと{n}発',
    'msg.missile': '⚠ ミサイル警報！\n赤い円から離れろ！',
    'msg.mineInvincible': '機雷に接触！（無敵：ノーダメージ）',
    'msg.missileInvincible': 'ミサイル直撃！（無敵：ノーダメージ）',
    'prog.loading': '原油積み込み中…',
    'prog.transfer': 'VLCCへ原油を引き渡し中…',
    'prog.slow': '減速せよ（{kt}kt未満で作業開始）',

    // ---- 減額（画面右に流れる表示） ----
    'col.land': '陸岸', 'col.rock': '岩礁', 'col.boat': '武装艇', 'col.tanker': 'VLCC', 'col.facility': '原油基地', 'col.other': '構造物',
    'col.fatalCharge': '{name}に激突 船体大破',
    'col.chargeHeavy': '{name}と激突 船体修理費',
    'col.chargeLight': '{name}と接触 船体修理費',
    'col.msgHeavy': '{name}に激突！',
    'charge.shoal': '浅瀬座礁 船底損傷',
    'charge.stop': '不審停止ペナルティ',
    'charge.fuel': '燃料費（ダッシュ）',
    'charge.iran': '危険海域航行ペナルティ',
    'charge.gunRepair': '船体修理費',
    'charge.injury': '乗組員負傷補償',
    'charge.droneRepair': 'ドローン被弾 船体修理費',
    'charge.cargoFire': '火災消火・積荷損失',

    // ---- ゲームオーバー時の大きな文字 ----
    'over.mine': '機雷に接触！',
    'over.missile': 'ミサイル直撃！',
    'over.drone_empty': '航行不能！',
    'over.drone_loaded': '積荷炎上・沈没！',
    'over.hull': '船体損傷・航行不能！',
    'over.collision': '激突・船体大破！',
    'over.default': 'ゲームオーバー',

    // ---- HUD（画面の計器） ----
    'hud.lbl.stage': 'ステージ',
    'hud.lbl.cargo': '積荷',
    'hud.lbl.hull': '船体状態',
    'hud.lbl.drone': 'ドローン被弾',
    'hud.lbl.gun': '銃撃被弾',
    'hud.lbl.crew': '乗組員',
    'hud.lbl.engine': '機関状態',
    'hud.lbl.speed': '速力',
    'hud.lbl.expo': '被発見リスク',
    'hud.lbl.rudder': '舵角',
    'hud.lbl.pending': '未清算の契約報酬',
    'hud.lbl.loss': '今回の損失',
    'hud.loaded': '原油満載',
    'hud.empty': '空荷',
    'hud.drone': '{hits}回 / 上限{limit}（あと{left}）',
    'hud.gun': '{n}発',
    'hud.crew': '負傷 {n} / {total}名',
    'hud.expoLow': '低（隠密）',
    'hud.expoMid': '中',
    'hud.expoHigh': '高',
    'hud.omanSide': '・オマーン側',
    'eng.grounded': '座礁中（出力制限）',
    'eng.stop': '正常（停止）',
    'eng.dash': '正常（ダッシュ）',
    'eng.half': '正常（半速）',
    'eng.normal': '正常（通常）',
    'hud.rudderCenter': '中央',
    'hud.rudderLeft': '左 {deg}°',
    'hud.rudderRight': '右 {deg}°',
    'obj.default': '目的：原油ターミナルへ向かえ',
    'obj.outbound': '目的：原油ターミナルで原油を積み込め',
    'obj.return': '目的：VLCCへ帰還し、原油を引き渡せ',
    'hud.gpsJam': 'GPS妨害中 ---- m',
    'hud.distTerm': 'ターミナルまで {d} m',
    'hud.distVlcc': 'VLCCまで {d} m',
    'warn.missile': '⚠ ミサイル接近 — 赤い円から離れろ',
    'warn.drone': '⚠ 自爆ドローン接近（{n}機）— 方位 {dir}',
    'warn.chase': '⚠ 武装小型艇に追跡されている',
    'warn.search': '⚠ 武装小型艇が警戒している（まだ発見されていない）',
    'warn.iran': '⚠ イラン側領海に接近中 — 危険海域ペナルティ',
    'warn.shoal': '⚠ 浅瀬に乗り上げている！',
    'warn.stop': '停船中：あと{s}秒で不審停止ペナルティ',
    'warn.jam': '📡 GPS妨害を受けている',
    'info.cancel': '海峡入口までは契約破棄が可能',
    'dir.front': '前方', 'dir.back': '後方', 'dir.port': '左舷', 'dir.starboard': '右舷',

    // ---- 画面下の操作スイッチ（PC） ----
    'ctl.throttle': 'スロットル (W/S)',
    'thr.0': '停止', 'thr.1': '半速', 'thr.2': '通常',
    'ctl.dash': 'ダッシュ (Space)',
    'ctl.cancelOnly': '海峡進入前のみ',
    'btn.cancel': '契約破棄',
    'hint.pause': 'P / Esc：一時停止',

    // ---- スマートフォンのタッチ操作 ----
    'touch.leftAria': '左に舵を切る',
    'touch.rightAria': '右に舵を切る',
    'touch.accel': '加速',
    'touch.decel': '減速',
    'touch.pauseAria': '一時停止',
    'touch.cancel': '契約破棄',
    'touch.cancelSub': '海峡入口まで',
    'rotate.msg': 'スマートフォンを<b>横向き</b>にしてプレイしてください',

    // ---- 一時停止 ----
    'pause.h2': '一時停止',
    'pause.resume': '再開',

    // ---- ステージクリア（船長の再依頼） ----
    'clear.h2': 'STAGE {stage} 契約完了',
    'clear.captain': 'VLCC船長：「{line}」',
    'clear.reward': '契約報酬',
    'clear.settle': '今回の清算額',
    'clear.saved': '💾 進行状況を保存しました。',
    'clear.saveFailed': '⚠ 進行状況を保存できませんでした（ブラウザの設定で保存が禁止されている可能性があります）。',
    'clear.saveTail': '次の契約で沈んでも累計スコアは失われず、そのステージから再挑戦できます。',
    'clear.further': 'さらに進む',
    'clear.next': '次の契約を受ける',
    'clear.retreat': '仕事を終えて撤退する',
    'loss.repair': '船体修理費',
    'loss.injury': '乗組員負傷補償',
    'loss.penalty': 'ペナルティ',
    'loss.fuel': '燃料費（ダッシュ）',
    'loss.minor': 'その他の軽微な損傷',

    // ---- 契約破棄の確認 ----
    'cancel.h2': '契約を破棄しますか？',
    'cancel.losses': '今回の航海で発生した損益（破棄されます）',
    'cancel.banked': '清算済み累計スコア（変わりません）',
    'cancel.note': '契約を破棄すると今回の航海を中止します。このステージは未クリアのまま、タイトル画面の「CONTINUE」からステージの最初に再挑戦できます。',
    'cancel.yes': '破棄して航海を中止する',
    'cancel.no': '航行を続ける',

    // ---- 結果画面 ----
    'reason.retreat': '自主撤退',
    'reason.cancel': '契約破棄（今回の航海を中止）',
    'reason.mine': '沈没（機雷に接触）',
    'reason.missile': '沈没（ミサイル直撃）',
    'reason.drone_empty': '航行不能（自爆ドローン被弾上限）',
    'reason.drone_loaded': '沈没（自爆ドローン被弾・積荷炎上）',
    'reason.hull': '航行不能（船体損傷）',
    'reason.collision': '航行不能（高速衝突による船体大破）',
    'reason.stage11': '第11ステージ',
    'reason.legend': 'ゲームクリア（高評価ルート・第11ステージ）',
    'end.legend.title': 'ホルムズ海峡の伝説',
    'end.legend.comment': '大量破壊兵器は使われなかった。あなたの航海が、この海峡を守り抜いた。',
    'end.s11.title': '強欲の閃光',
    'end.s11.comment': '欲張りすぎた。海峡は、もうどこにもない。',
    'end.over.title': '海の藻屑',
    'end.over.comment': '引き際を見誤った。……だが、まだ終わりではない。',
    'rank.0.name': '赤字の船長',       'rank.0.comment': '海峡を前に、帳簿だけが沈んだ。',
    'rank.1.name': '慎重すぎる見習い', 'rank.1.comment': '命あっての物種。悪くない判断だ。',
    'rank.2.name': '堅実な運び屋',     'rank.2.comment': '危険と報酬の天秤を、きちんと読めている。',
    'rank.3.name': '海峡の古狸',       'rank.3.comment': '危ない橋を渡りつつ、落ちる前に引き返す。',
    'rank.4.name': '命知らずの船長',   'rank.4.comment': 'その度胸、保険屋が泣いている。',
    'rank.5.name': '海峡の古強者',     'rank.5.comment': '酒場では、もうあなたの噂で持ちきりだ。',
    'rank.6.name': '引き際の神',       'rank.6.comment': '全てを手に入れ、そして生きて帰った。完璧だ。',
    'end.h.clear': 'GAME CLEAR',
    'end.h.over': 'GAME OVER',
    'end.h.end': '航海終了',
    'end.legendLabel': '称号獲得',
    'end.titleQuote': '「{title}」',
    'end.legendTotal': 'ステージ1〜10の累計獲得額',
    'end.legendLine': '高評価ライン',
    'end.legendLineVal': '{v} 以上',
    'end.reason': '終了理由',
    'end.reached': '到達ステージ',
    'end.trips': '成功した往復回数',
    'end.tripsVal': '{n} 回',
    'end.score': '確定スコア',
    'end.failedLoss': '失敗した契約の損益（再挑戦で破棄）',
    'end.cancelLoss': '中止した航海の損益（破棄・累計に反映しない）',
    'end.histHead': 'ステージ別損益',
    'end.histRow': 'STAGE {stage}（{note}）',
    'hist.settled': '清算',
    'hist.failed': '失敗',
    'hist.cancelled': '契約破棄',
    'end.overNote': '累計スコアは保持されます。「再挑戦」でこのステージの開始時点から、もう一度挑めます。',
    'end.cancelNote': 'STAGE {stage} は未クリアです。タイトル画面の「CONTINUE」から、このステージの最初に再挑戦できます。',
    'end.cancelSaveFail': '⚠ 進行状況を保存できませんでした（この環境ではCONTINUEで再開できません）。',
    'btn.retry': '再挑戦（RETRY）',
    'end.again': 'もう一度世界を救う',
    'end.home': '故郷へ帰る',

    // ---- 第11ステージ ----
    'radio.head': '緊急無線 受信中',
    'radio.lost': '— 通信途絶 —',
    // dialogues.js が読み込めなかったときの予備
    'dlg.captainDefault': 'よく戻ったな。報酬は振り込んでおいた。もう一回頼めないか？',
    'dlg.legendFallback': '関係各国による停戦合意が成立した。',
    'dlg.alertFallback': '緊急警報！',
  },
};
