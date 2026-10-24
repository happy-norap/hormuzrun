// =====================================================================
//  ホルムズ海峡を駆け抜けろ！ — BGM設定ファイル
//
//  どの場面でどの曲を流すかを決めるファイルです。
//  ゲーム本体（game.js）を変更しなくても、ここを書き換えるだけで曲を差し替えられます。
//
//  【曲の差し替え方】
//   1. 使いたい MP3 ファイルを、このフォルダの中の「bgm」フォルダにコピーする
//   2. 下の一覧で、差し替えたい場面の file: の ' と ' の間を、そのファイル名に書き換える
//      例） file: 'bgm/04.mp3'  →  file: 'bgm/新しい曲.mp3'
//   3. 保存して、ブラウザでゲームを開き直す
//
//  【各項目の意味】
//   file    : 曲のファイル（bgm フォルダからの場所）。null にするとその場面は無音
//   volume  : その曲の音量（0〜1）。曲ごとの音の大きさの違いをそろえるために使う
//   loop    : true ならくり返し再生。終わり際に曲の頭へなめらかにつなぐ
//   fade    : 前の曲からこの曲へ切り替えるときのフェード秒数
//   loopStart / loopEnd : くり返すときに使う範囲（秒）。null なら曲の最初から最後まで
//
//  ※同じ file を続けて使う場面では、曲は最初に戻らず、音量だけがなめらかに変わります。
//  ※プレイヤーが設定するBGM全体の音量は、ここの volume にさらに掛け合わされます。
// =====================================================================
window.BGM_CONFIG = {

  // くり返し再生のつなぎ目で、前後を重ねて自然につなぐ秒数
  LOOP_CROSSFADE_SEC: 3,

  // プレイヤー設定の初期値（プレイヤーが変更すると、ブラウザ内に保存された値が優先されます）
  DEFAULTS: { BGM_ON: true, BGM_VOLUME: 0.6, SFX_VOLUME: 0.8 },

  SCENES: {
    // タイトル画面・ステージ開始前の画面・船長の再依頼の画面
    TITLE:          { file: 'bgm/OP用02.mp3',            volume: 0.75, loop: true,  fade: 1.5 },

    // 通常航海（往路：空荷でターミナルへ向かう）
    VOYAGE:         { file: 'bgm/04.mp3',                volume: 0.9,  loop: true,  fade: 2.0 },

    // 緊迫した航海（原油を積んだ帰路）
    VOYAGE_LOADED:  { file: 'bgm/Neutral Vectors.mp3',   volume: 1.0,  loop: true,  fade: 1.5 },

    // 第11ステージの通常航海（最終イベントの前）
    STAGE11:        { file: 'bgm/Silent Orbits (1).mp3', volume: 1.0,  loop: true,  fade: 2.0 },

    // NORMALルート：緊急警報〜閃光まで（警告音が聞こえるように音量を下げる）
    NORMAL_ALERT:   { file: 'bgm/Silent Orbits (1).mp3', volume: 0.3,  loop: true,  fade: 0.6 },
    // NORMALルート：閃光のあと（爆音を際立たせるため無音にする）
    NORMAL_BLAST:   { file: null,                        fade: 0.4 },

    // LEGENDルート：緊急無線（無線が読みやすいよう、エンディング曲を小さく流し始める）
    LEGEND_RADIO:   { file: 'bgm/ED01.mp3',              volume: 0.25, loop: true,  fade: 3.0 },
    // LEGENDルート：静かな航海（同じ曲の音量をゆっくり上げる）
    LEGEND_QUIET:   { file: 'bgm/ED01.mp3',              volume: 0.9,  loop: true,  fade: 4.0 },

    // 沈没・航行不能の演出中（曲を消す）
    SINKING:        { file: null,                        fade: 1.2 },
    // ゲームオーバー画面
    GAME_OVER:      { file: 'bgm/Silent Ledger.mp3',     volume: 0.9,  loop: true,  fade: 1.5 },
    // ゲームクリア画面（LEGENDルート）。静かな航海の曲がそのまま続く
    GAME_CLEAR:     { file: 'bgm/ED01.mp3',              volume: 0.8,  loop: true,  fade: 2.0 },
    // 自主撤退（契約破棄を含む）の結果画面
    RETREAT:        { file: 'bgm/ED02.mp3',              volume: 1.0,  loop: true,  fade: 1.5 },
  },
};
