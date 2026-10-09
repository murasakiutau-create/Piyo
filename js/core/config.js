'use strict';

  // =====================================================================
  //  調整用の設定（ここを変えるだけで遊び心地を変えられます）
  // =====================================================================
  const CONFIG = {
    startCoins: 50,          // 最初の所持メダル
    insertInterval: 0.22,    // 長押し連続投入の間隔（秒）
    gameOverWait: 6,         // メダル0枚になってから判定するまでの待ち時間（秒）

    // ---- スマートボール盤面 ----
    board: {
      left: 22, right: 158, top: 48, bottom: 145,
      ballR: 5,              // 盤面でのメダルの当たり判定の半径
      gravity: 0.07,         // 重力（1フレームあたり）
      maxSpeed: 3.2,         // 最高速度
      airDrag: 0.996,        // 空気抵抗（1に近いほど減速しない）
      wallBounce: 0.5,       // 左右の壁の跳ね返り
      substeps: 3,           // 衝突計算の細かさ
      dropJitter: 0.25,      // 投入時の横方向のブレ
      ballBallPush: 1        // メダル同士の押し合いの強さ
    },

    // ---- ピン（釘） ----
    pins: {
      radius: 1.5,
      bounce: 0.45,          // 跳ね返りの強さ
      jitter: 0.2,           // 当たったときの左右ランダム性（小さいほど狙いやすい）
      top: 58,               // 一番上の段の高さ
      rows: 6,               // 段数
      dx: 20,                // 横の間隔
      dy: 13,                // 縦の間隔
      margin: 8,             // 壁からの余白
      extra: [],             // 追加したいピン [[x, y], ...]
      remove: []             // 取り除きたいピン [[x, y], ...]（近い位置のピンを消します）
    },

    // ---- 入賞ポケット（4つ） ----
    pockets: {
      y: 132,                // ポケットの口の高さ
      depth: 12,
      clearance: 0.3,        // 口の柱とメダルのすき間。メダルより口が必ず広くなるので、口で引っかかりません
      guardPin: false,       // 口の真上に「守りのピン」を置く（入賞率は下がるが、狙いにくくなる）
      guardY: 11.5,           // 守りのピンの、口からの高さ（小さいほど入りにくい）
      centers: [44, 74, 106, 136], // 外側のポケットは壁から離して、壁ぎわも通れるようにしています
      colors: ['#ff5ca8', '#5ce8ff', '#ffd040', '#7dff8a'],
      holdTime: 0.25         // 入賞したメダルがポケットにとどまる時間（そのあと別ルートでプッシャーへ）
    },

    // ---- 引っかかり防止 ----
    unstuck: {
      speed: 0.15,           // この速さより遅い状態が続いたら「止まっている」とみなす
      time: 0.35,            // 止まっていられる時間（秒）
      kick: 0.9,             // 止まったときに横へはじく強さ（続けて止まると強くなります）
      maxKicks: 5            // これ以上はじいても動かないときは、ピンをすり抜けて落とす
    },

    // ---- SLIME HUNT（2台目のメダルゲーム） ----
    //   勝率・配当・レア出現率は、遊びながら何度も調整する前提です。ここだけ変えれば変わります。
    slimeHunt: {
      playCost: 1,                // PLAY_COST：1プレイに必要なメダル（ゲームセンター共通のMEDAL）
      visibleCount: 6,            // VISIBLE_SLIME_COUNT：画面を回るスライムの数
      rotationSpeed: 0.13,        // ROTATION_SPEED：回る速さ（ラジアン／秒。0.13で約48秒に1周）
      enterTime: 1.3,             // 補充されたスライムが画面端から入ってくる時間（秒）
      moveTime: 0.45,             // 選んだスライムが中央へ動く時間（秒）
      battleRequiredTaps: 6,      // BATTLE_REQUIRED_TAPS：結果へ進むまでの連打の回数（5〜10くらい）
      battleDuration: 4.0,        // BATTLE_DURATION：連打が足りなくても、この秒数で結果へ（連打が苦手でも遊べる）
      rareSpawnRate: 0.04,        // RARE_SPAWN_RATE：補充のとき、レアになる確率（0〜1）
                                  //   レアの中身の出やすさは、下の slimes の appearanceWeight（CRYSTAL/GOLD/KING/RAINBOW）
      // RESULT_EFFECT_DURATION：結果の演出の長さ（秒）。タップで早送りもできます
      resultEffectDuration: { normal: 2.6, lose: 2.2, crystal: 3.6, gold: 4.4, king: 4.4, rainbow: 8.0 },
      // RARE_EFFECT_DURATION：レアが入ってきたときの「出現！」の演出の長さ（秒）
      rareEffectDuration: { crystal: 1.8, gold: 2.4, king: 2.4, rainbow: 4.0 },

      // ---- 開発用のデバッグ（本番は enabled: false のまま） ----
      //   enabled を true にすると、下の設定が効きます。
      //   rareRate：1.0 にすると補充がすべてレアになります（null なら通常どおり）
      //   forceNext：次の補充を、このIDのスライムに固定（'rainbow' / 'gold' / 'king' / 'crystal' など）
      //   forceResult：結果を固定（'win' / 'lose'）
      //   URLの後ろに ?slimedebug=rainbow,win のように付けても有効になります
      debug: { enabled: false, rareRate: null, forceNext: null, forceResult: null },

      // ---- スライムの絵（index.html から見た相対パス） ----
      //   src：画像ファイル　size：大きさの倍率（1.0 が標準。ベビー 0.85、ゴールド・デビル 1.15、キング 1.45）
      //   crop・mass：画像の余白をけずる範囲と「見た目の大きさ」。読み込めなかったときだけ使う予備の値です
      //   （通常は画像を読み込んだときに自動で計って、どの絵も同じくらいの大きさにそろえます）
      imageBaseSize: 32,          // size 1.0 のスライムの大きさ（画面のドット数。大きいほど大きく表示）
      images: {
        baby: { src: 'img/slimes/baby.webp', size: 0.85, crop: [198, 351, 857, 657], mass: 658 },
        aqua: { src: 'img/slimes/aqua.webp', size: 1.0, crop: [219, 288, 819, 745], mass: 631 },
        leaf: { src: 'img/slimes/leaf.webp', size: 1.0, crop: [225, 265, 772, 783], mass: 616 },
        fire: { src: 'img/slimes/fire.webp', size: 1.0, crop: [192, 215, 905, 848], mass: 702 },
        thunder: { src: 'img/slimes/thunder.webp', size: 1.0, crop: [186, 207, 894, 871], mass: 694 },
        metal: { src: 'img/slimes/metal.webp', size: 1.0, crop: [105, 493, 1026, 520], mass: 643 },
        poison: { src: 'img/slimes/poison.webp', size: 1.0, crop: [37, 252, 1164, 805], mass: 723 },
        dark: { src: 'img/slimes/dark.webp', size: 1.0, crop: [63, 232, 1096, 837], mass: 695 },
        devil: { src: 'img/slimes/devil.webp', size: 1.15, crop: [30, 352, 1212, 682], mass: 703 },
        crystal: { src: 'img/slimes/crystal.webp', size: 1.0, crop: [111, 278, 1053, 797], mass: 731 },
        gold: { src: 'img/slimes/gold.webp', size: 1.15, crop: [104, 277, 1021, 822], mass: 708 },
        king: { src: 'img/slimes/king.webp', size: 1.45, crop: [54, 113, 1144, 1044], mass: 909 },
        rainbow: { src: 'img/slimes/rainbow.webp', size: 1.0, crop: [77, 285, 1115, 814], mass: 722 }
      },

      // ---- SlimeData：スライムごとの設定 ----
      //   payout：勝ったときにもらえる枚数（投入した1枚とは別）
      //   winRate / loseRate：結果の確率（％。引き分けはありません）。選んだ瞬間に抽選して、連打は演出です
      //   rarity：normal / rare　　appearanceWeight：補充で出やすい順（normal同士、rare同士で比べます）
      slimes: [
        { id: 'baby',    name: 'ベビースライム',     label: 'BABY',    payout: 2,  winRate: 46, loseRate: 54, rarity: 'normal', appearanceWeight: 14 },
        { id: 'aqua',    name: 'アクアスライム',     label: 'AQUA',    payout: 4,  winRate: 23.25, loseRate: 76.75, rarity: 'normal', appearanceWeight: 14 },
        { id: 'leaf',    name: 'リーフスライム',     label: 'LEAF',    payout: 5,  winRate: 18.4, loseRate: 81.6, rarity: 'normal', appearanceWeight: 13 },
        { id: 'fire',    name: 'ファイアスライム',   label: 'FIRE',    payout: 6,  winRate: 14.5, loseRate: 85.5, rarity: 'normal', appearanceWeight: 12 },
        { id: 'thunder', name: 'サンダースライム',   label: 'THUNDER', payout: 8,  winRate: 10.75, loseRate: 89.25, rarity: 'normal', appearanceWeight: 10 },
        { id: 'metal',   name: 'メタルスライム',     label: 'METAL',   payout: 10, winRate: 8.2, loseRate: 91.8, rarity: 'normal', appearanceWeight: 8 },
        { id: 'poison',  name: 'ポイズンスライム',   label: 'POISON',  payout: 12, winRate: 6.5, loseRate: 93.5, rarity: 'normal', appearanceWeight: 6 },
        { id: 'dark',    name: 'ダークスライム',     label: 'DARK',    payout: 15, winRate: 4.75, loseRate: 95.25, rarity: 'normal', appearanceWeight: 4 },
        { id: 'devil',   name: 'デビルスライム',     label: 'DEVIL',   payout: 20, winRate: 3.35, loseRate: 96.65, rarity: 'normal', appearanceWeight: 3 },
        // ---- レア（補充のとき rareSpawnRate の確率で、この中から出ます） ----
        { id: 'crystal', name: 'クリスタルスライム', label: 'CRYSTAL', payout: 20, winRate: 5.5, loseRate: 94.5, rarity: 'rare', appearanceWeight: 55 },
        { id: 'gold',    name: 'ゴールドスライム',   label: 'GOLD',    payout: 30, winRate: 3.25, loseRate: 96.75, rarity: 'rare', appearanceWeight: 20 },
        { id: 'king',    name: 'キングスライム',     label: 'KING',    payout: 30, winRate: 3.5, loseRate: 96.5, rarity: 'rare', appearanceWeight: 17.5 },
        { id: 'rainbow', name: 'レインボースライム', label: 'RAINBOW', payout: 50, winRate: 2.1, loseRate: 97.9, rarity: 'rare', appearanceWeight: 7.5 }
      ]
    },

    // ---- DUCK RACE（3台目のメダルゲーム） ----
    //   BETして、6羽のゴムアヒルのレースを応援するゲームです。数字は遊びながら調整してください。
    duckRace: {
      wide: true,                 // DUCK RACE：スマホの横幅を使うワイド配置にする（false で、通常の幅の配置へ）
      betCost: 1,                 // BET_COST：BETの最小（1枚）
      maxBet: 5,                  // 1レースに賭けられる合計の最大（同じ予想に、まとめて賭けます）
      betOptions: [1],            // 将来「2枚」「3枚」「MAX」を足すための枠（いまは1枚だけ）
      houseEdge: 0.12,            // HOUSE_EDGE：オッズから引く割合（0.12なら、長く遊ぶと約12%ずつ減る計算）
      raceDuration: 16,           // RACE_DURATION：1着のアヒルがゴールするまでの秒数
      duckCount: 6,               // DUCK_COUNT：出走するアヒルの数（ducks の先頭から数えます）
      photoFinishRate: 0.1,       // PHOTO_FINISH_RATE：写真判定になる確率（0〜1）
      maxOdds: 999,               // これより高いオッズは、この数字で止めます（上限に当たるのは、ごく珍しい組み合わせだけです）
      jackpotOdds: 50,            // このオッズ以上の的中は「JACKPOT!!」の演出
      maxSpeed: 0.2,              // アヒルの最高速度（コース全体を1として、1秒あたり。大きいほど、急加速が速くなります）
      wanderAmp: 9,               // 走りながら左右にフラフラする大きさ（ドット数。0にすると、まっすぐ走ります）
      finalStretch: { slow: 0.65, before: 1.5, after: 0.4 },   // ゴール前の「溜め」：1着のゴールの何秒前から、どのくらいゆっくりにするか
      strengthSpread: 0.55,       // 本命と穴の差の大きさ（大きいほど、強い子と弱い子がはっきり分かれる）
      minWinRate: 0.035,          // どのアヒルも、これ以下の勝率にはしない
      countdown: { accepted: 0.9, ready: 0.7, step: 0.6 },   // BET ACCEPTED → READY → 3・2・1（秒）
      resultTime: 3.2,            // 結果の表示時間（秒）。タップで早送りもできます
      jackpotTime: 6.5,           // JACKPOT のときの表示時間（秒）
      // レース展開の出やすさ：逃げ切り / 中盤逆転 / ゴール前逆転 / 接戦 / 圧勝
      patternWeights: { wire: 25, comeback: 25, lastspurt: 25, close: 15, blowout: 10 },

      // ---- 開発用のデバッグ（本番は enabled: false のまま） ----
      //   forceWinner：1着を固定（1〜6 または 'kuromame' など）
      //   forceOrder：着順を固定（例：['kuromame', 'torimomo', 'konbu']）
      //   forceHighOdds：true にすると、超高配当の着順になります
      //   forcePhotoFinish：true にすると、必ず写真判定になります
      //   URLの後ろに ?duckdebug=kuromame,photo,highodds のように付けても有効になります
      debug: { enabled: false, forceWinner: null, forceOrder: null, forceHighOdds: false, forcePhotoFinish: false },

      // ---- 出走するアヒル（番号・色・名前・画像は固定。強さは毎レース変わります） ----
      //   image：画像（index.html から見た相対パス）　style：動きのくせ（見た目だけで、勝率には関係しません）
      ducks: [
        { id: 'takuan',   no: 1, name: 'たくあん',     label: 'TAKUAN',   color: '#ffd93a', image: 'assets/duck-race/takuan.webp',   style: 'normal' },
        { id: 'penguin',  no: 2, name: 'ぺんぎん',     label: 'PENGUIN',  color: '#4a9ef0', image: 'assets/duck-race/penguin.webp',  style: 'penguin' },
        { id: 'torimomo', no: 3, name: 'トリモモ',     label: 'TORIMOMO', color: '#ff8ab8', image: 'assets/duck-race/torimomo.webp', style: 'ribbon' },
        { id: 'konbu',    no: 4, name: 'コンブ',       label: 'KONBU',    color: '#a6cd65', image: 'assets/duck-race/konbu.webp',    style: 'konbu' },
        { id: 'violet',   no: 5, name: 'バイオレット', label: 'VIOLET',   color: '#b25df1', image: 'assets/duck-race/violet.webp',   style: 'violet' },
        { id: 'kuromame', no: 6, name: 'クロマメ',     label: 'KUROMAME', color: '#8a86a0', image: 'assets/duck-race/kuromame.webp', style: 'kuromame' }
      ]
    },

    // ---- ハムちゃん危機一髪！（4台目のメダルゲーム） ----
    //   1メダルでトロッコを出発 → 区間を突破するたびに「おりる」か「すすむ！」を選ぶ
    //   倍率・突破率・走行時間・表情は、すべてここで変えられます
    hamPanic: {
      betCost: 1,                 // BET_COST：START に必要なメダル
      preset: 'balanced',         // 'balanced'（おすすめ）または 'spec'（最初にもらった仕様どおりの数字）
      // STAGES：区間ごとの「到達したときの倍率（投入した1枚を含む総払い出し）」と「その区間を突破できる確率」
      presets: {
        // 仕様の仮値。×8で降りるだけで、1枚あたり平均2.9枚もどってくる計算です（メダルが増え続けます）
        spec:     { payouts: [2, 3, 5, 8, 12, 20, 30, 50], rates: [0.85, 0.80, 0.75, 0.70, 0.65, 0.55, 0.45, 0.30] },
        // どこで降りても期待値が1以下。欲張るほど、少しずつ損になります（×2＝1.0、×8＝0.90、×50＝0.80）
        balanced: { payouts: [2, 3, 5, 8, 12, 20, 30, 50], rates: [0.50, 0.65, 0.58, 0.60, 0.65, 0.58, 0.65, 0.58] }
      },
      rideDuration: [2.4, 2.5, 2.6, 2.8, 3.0, 3.2, 3.4, 3.8],   // RIDE_DURATION：区間ごとの走行時間（秒）
      dangerAt: 0.72,             // 走行時間のどのあたりで「危険地点」に着くか（0〜1）
      readyTime: 1.1,             // READY... の時間（秒）
      displaySize: 112,           // ハムちゃんの絵の表示サイズ（画面のドット数。大きいほど大きく表示）
      // ハムちゃんは、遊ぶたびにランダムで1匹が乗ります（ほかの表情の絵も同じ子です）
      hams: [
        { id: 'cha', name: '茶ハム' },
        { id: 'shiro', name: '白ハム' },
        { id: 'gray', name: 'グレーハム' }
      ],
      // 絵の名前と、assets/ham-chan/<ham>_<file>.webp の対応（ZONE4.5 → zone45、ZONE6.7 → zone67）
      faceFiles: {
        ham_normal: 'zone0', ham_cheer: 'zone1', ham_wonder: 'zone2', ham_worry: 'zone3',
        ham_very_worry: 'zone45', ham_go_home: 'zone67', ham_soul_gone: 'final', ham_happy: 'success'
      },
      // いくつ区間を突破したか（0＝出発前 〜 7＝×30）ごとの表情。どんどん悪くなります
      faces: ['ham_normal', 'ham_cheer', 'ham_wonder', 'ham_worry', 'ham_very_worry', 'ham_very_worry', 'ham_go_home', 'ham_soul_gone'],
      // 区間ごとの坑道と危険地点（見た目だけ）。hazard は rock / gap / wall / boulder
      zones: [
        { name: 'TUNNEL', hazard: 'rock' },       // 普通の坑道
        { name: 'ROUGH RAIL', hazard: 'rock' },   // ガタガタしたレール
        { name: 'DOWNHILL', hazard: 'wall' },     // 急な下り坂
        { name: 'WOOD BRIDGE', hazard: 'gap' },   // 木製橋
        { name: 'DARK TUNNEL', hazard: 'wall' },  // 暗いトンネル
        { name: 'ROCKFALL', hazard: 'boulder' },  // 落石地帯
        { name: 'OLD BRIDGE', hazard: 'gap' },    // 壊れかけの橋
        { name: 'FINAL', hazard: 'boulder' }      // 最後の危険地帯
      ],

      // ---- 開発用のデバッグ（本番は enabled: false のまま） ----
      //   forceSuccess：true → すべて成功（FINALまで行く）　forceCrash：true → 最初でCRASH
      //   forceCrashStage：n番目の区間（1〜8）でCRASH。例：5 にすると、×8のあと（×12への挑戦）でCRASH
      //   forceFinalClear：true → FINALまで完全成功
      //   URLの後ろに ?hamdebug=final / crash / 5 のように付けても有効になります（final＝全成功、crash＝最初でCRASH、数字＝その区間でCRASH）
      debug: { enabled: false, forceSuccess: false, forceCrash: false, forceCrashStage: null, forceFinalClear: false }
    },

    // ---- LUCKY SLOT（5台目のメダルゲーム） ----
    //   3つのリールを自分でSTOPして、同じ図柄を3つ揃える。STOPを押した位置から、0〜2コマ「滑って」止まります
    luckySlot: {
      betCost: 1,                 // BET_COST：SPINに必要なメダル
      preset: 'balanced',         // 'balanced'（おすすめ）または 'spec'（最初にもらった仕様どおりの数字）
      presets: {
        // 仕様どおり：7を狙って押せる人は、1回あたり平均2〜3枚もどってくる計算です（メダルが増え続けます）
        spec:     { payouts: { cherry: 3, lemon: 5, bell: 8, star: 12, diamond: 20, red7: 50 }, slipWeights: { 0: 50, 1: 50 }, roleProbs: { cherry: 0.13, lemon: 0.065, bell: 0.037, star: 0.022, diamond: 0.011, red7: 0.004 } },
        // どんな狙い方でも、1回あたりの戻りが約1以下（7を完璧に狙っても0.99）。目押しをすると、ランダムの約2〜3倍もどります
        // roleProbs：SPIN時に決める内部成立役の確率（残りはハズレ）。成立していない役は、揃いません
        // 目押しがうまい人（成立役が滑り範囲に入るよう押せる人）の戻りは約0.97、ランダムに押す人は約0.34
        balanced: { payouts: { cherry: 3, lemon: 5, bell: 7, star: 10, diamond: 15, red7: 25 }, slipWeights: { 0: 50, 1: 50 }, roleProbs: { cherry: 0.176, lemon: 0.088, bell: 0.055, star: 0.033, diamond: 0.0176, red7: 0.0088 } }
      },
      reelSpeed: 5.0,             // REEL_SPEED：リールが1秒に進むコマ数（大きいほど速い。図柄を目で追える速さは4〜6くらい）
      reelSpeedMul: [1.0, 1.08, 0.94],   // 左・中・右のリールの速さの比（少しずつ違うと、そろえる楽しさが出ます）
      slipMin: 0,                 // SLIP_MIN：滑るコマ数の最小
      slipMax: 1,                 // SLIP_MAX：成立役を引き込める最大のコマ数（1〜2コマ程度）。大きいほど、目押しがかんたんに
                                  //   （成立役がなければ、この範囲の滑りは、重み slipWeights でランダムに決まります）
      snap: 0.35,                 // 図柄が「ちょうど真ん中」を少し過ぎていても、その図柄に止まるとみなす幅（コマ）
      // リール配列：C=CHERRY L=LEMON B=BELL S=STAR D=DIAMOND 7=RED 7（上から下へ流れます）。3つのリールで、並びを変えてあります
      reels: ['CLCBCLSCBCLDCLCBC7LS', 'CBCLDCLCBC7LSCLCBCLS', 'CBCLCDLCBCSLCBCLCSL7'],
      resultTime: { miss: 0.9, win: 1.8, big: 2.8, jackpot: 4.2 },   // 結果の表示時間（秒）。SPINを押すと、すぐ次へ進めます

      // ---- 開発用のデバッグ（本番は enabled: false のまま） ----
      //   force：結果を固定。'cherry' / 'lemon' / 'bell' / 'star' / 'diamond' / 'red7' / 'miss' / 'reach7'（7｜7｜？のリーチだけ見る）
      //   URLの後ろに ?slotdebug=red7 のように付けても有効になります
      debug: { enabled: false, force: null }
    },

    // ---- 3階建てのゲームセンター（各階4枠。null にすると「COMING SOON」の空き枠） ----
    // ---- メダルゲームの階ごとの配置（地上の 2F・3F・4F）。台のID（machineId）は、これまでと同じ：記録・セーブは、そのまま使われます ----
    floors: [
      ['piyo', 'slime', 'duck', 'slot'],           // 2F MEDAL FLOOR：PIYO MEDAL ADVENTURE / SLIME HUNT / DUCK RACE / LUCKY SLOT（メダル貸出機もここ）
      ['ham', 'fish', 'star', 'pirate'],           // 3F MEDAL FLOOR：ハムちゃん危機一髪！ / FISH CATCH / STAR FLIGHT / PIRATE TREASURE
      ['bingo', 'train', 'balloon', 'cosmo']       // 4F MEDAL FLOOR：BIG BINGO / STOP! TRAIN / BALLOON SHOOT / SUPER COSMO（GHOST PANIC は 外した）
    ],

    // ---- 新しい6台（数字は仮値です。遊びながら調整してください） ----
    //   debug：enabled を true にすると、forceXxx などの強制結果と、showStats の統計表示が使えます
    newGames: {
      // 🎱 BIG BINGO：配当表（ライン数 0〜5 の倍率。BET×倍率）・球の数字（1〜range）・1回に でる球の数（重複なし）。理論値：BINGO率 33.36%／RTP 83.95%（変えると RTP が かわります）
      //   spinNormal／spinLong＝ドームの まわる時間（通常／リーチ中・最終球）／drop＝球が おちる時間／reveal＝番号を みせる時間／startWait＝STARTのあとの ためる時間（秒）
      bingo: { betCost: 1, bets: [1, 3, 5], pay: [0, 2, 5, 10, 20, 50], range: 20, balls: 6, spinNormal: 1.25, spinLong: 2.3, drop: 0.55, reveal: 0.9, startWait: 0.8, debug: { enabled: false, showStats: false } },
      // 🚀 STAR FLIGHT：上下に飛んで⭐を集める
      star: {
        betCost: 1,
        scrollSpeed: 42,            // コースが流れる速さ（ドット／秒）
        shipMaxSpeed: 95,           // 宇宙船が上下に動く最高速度
        shipAccel: 420,             // 上下の加速（慣性）
        captureR: 9,                // ⭐を取れる範囲
        patternsPerCourse: 7,       // 1プレイでつなぐパターンの数
        // 「その日のコースで、理論上とれる最大数」に対する取得率 → 払い出し（上から順に、最初に当てはまったもの）
        payBands: [[1.0, 10], [0.98, 5], [0.96, 3], [0.9, 2], [0.56, 1]],
        // 出発前に SHIP SIZE UP（+2メダル、合計3枚）：船が大きくなって、星を取れる範囲がひろがります。払い出しの上限は5枚くらい
        sizeUp: { cost: 2, captureMul: 1.5, shipScale: 1.4, payBands: [[0.94, 5], [0.88, 4], [0.74, 3], [0.7, 2], [0.5, 1]] },
        debug: { enabled: false, forceStars: null, showStats: false }
      },
      // 🐟 FISH CATCH：網が降りるまで0.5秒。魚の少し先を読む
      fish: {
        betCost: 1,
        netDelay: 0.5,              // CATCH!を押してから、網が最下点に着くまで（秒）
        timeLimit: 15,              // 観察できる時間（秒）。過ぎたら、その場で網が降ります
        fishCount: 4,
        nets: { normal: { cost: 1, x0: 82, x1: 98 }, big: { cost: 3, x0: 66, x1: 114 } },     // 網を選ぶ：NORMAL 1枚 ／ BIG 3枚（BIGは、捕まえやすいだけ。配当は同じ）
        netY0: 156,                 // 網がおりる深さ（下の2レーン）
        // 捕獲判定：魚の当たり判定（画像の透明な余白ではなく、魚の体の部分）のうち、網に重なっている割合が need 以上なら、その魚を捕獲。画面の魚すべてを個別に判定（まとめて捕まえられる）
        //   w, h＝魚の画像に対する、当たり判定の大きさの割合（尾びれ・ひれを除いた体）／ need＝必要な重なり率（NORMAL NET も BIG NET も同じ）
        hit: { w: 0.6, h: 0.6, need: 0.7 },
        // 魚の上下の動き：それぞれ独立して、ときどき（上のほう）⇄（網の届く下のほう）へ、泳ぎながらゆっくり移動する
        // ときどき泳ぎ方が変わる（魚ごとに独立。たまに「おっ」と思う程度）。CATCH後や、網の捕獲範囲の手前では起こさない（入力を見て避けたように感じさせない）
        behave: { every: [18, 38], slow: 0.45, fast: 1.6, accel: 3, margin: 18, chance: { slow: 0.3, fast: 0.3, turn: 0.25, pause: 0.15 } },
        dive: { speed: 18, retarget: [3, 6], lowerChance: 0.5, maxUpperTime: 1.5 },     // speed＝上下の速さ（ドット／秒）／retarget＝つぎの高さを決めるまでの秒数／lowerChance＝下へ向かう確率／maxUpperTime＝3匹とも届かない状態が続く最大秒数（これを超えたら、1匹を下へ向かわせる）
        // speed：泳ぐ速さ　pay：配当　weight：出やすさ　pattern：straight（まっすぐ）/ turn（ときどき向きを変える）/ octo / weave
        types: [
          { id: 'small',  name: 'SMALL',    w: 13, h: 7,  color: '#7ad0ff', speed: 40, pay: 1,  weight: 38, pattern: 'straight' },
          { id: 'normal', name: 'NORMAL',   w: 17, h: 9,  color: '#ff9a4a', speed: 54, pay: 2,  weight: 30, pattern: 'straight' },
          { id: 'gold',   name: 'GOLDFISH', w: 19, h: 10, color: '#ff6030', speed: 66, pay: 2,  weight: 14, pattern: 'straight' },
          { id: 'puffer', name: 'PUFFER',   w: 15, h: 15, color: '#e8e0a0', speed: 50, pay: 3,  weight: 9,   pattern: 'turn' },
          { id: 'octo',   name: 'OCTOPUS',  w: 17, h: 15, color: '#e060a0', speed: 42, pay: 4,  weight: 6,   pattern: 'octo' },
          { id: 'golden', name: 'GOLDEN',   w: 22, h: 12, color: '#ffd830', speed: 80, pay: 8,  weight: 2,  pattern: 'weave' }
        ],
        debug: { enabled: false, forceFish: null, showStats: false }       // forceFish：'golden' など、その魚だけ出す
      },
      // 👻 GHOST PANIC：10秒間、出てくるゴーストをタップ
      ghost: {
        betCost: 1,
        duration: 10,               // 制限時間（秒）
        spawnStart: 0.55, spawnEnd: 0.20,     // ゴーストが出る間隔（秒）：序盤 → 終盤
        dwellStart: 0.72, dwellEnd: 0.20,     // 顔を出している時間（秒）：序盤 → 終盤
        missCooldown: 0.22,         // 空振りのあとの、ごく短い入力クールダウン（画面全体の連打対策）
        payFrac: [[1.0, 5], [0.99, 3], [0.95, 2], [0.75, 1]],     // （撃退数 − カボチャ）÷ 出たゴースト数 → 払い出し
        pumpkinRate: [0.12, 0.30],  // カボチャ（たたくと減点）が出る割合：序盤 → 終盤
        // 前半＝いまに近い／中盤＝表示時間が短く、複数同時が少しずつ／後半＝さらに短く、複数同時・ゴースト＋カボチャの同時出現
        phases: [
          { until: 0.33, dwellMul: 1.0,  multi: 0.0,  jitter: [0.85, 1.15] },
          { until: 0.66, dwellMul: 0.86, multi: 0.14, jitter: [0.78, 1.22] },
          { until: 1.01, dwellMul: 0.72, multi: 0.34, jitter: [0.68, 1.32], pairPumpkin: 0.55 }
        ],
        minDwell: 0.22,             // 表示時間の下限（見て反応すれば間に合う長さ）
        lullFrom: 6.5,              // 残りこの秒数から、ときどき出現の間をあける（先走ってタップするのを防ぐ）
        lullChance: 0.2,            // 1回ごとに、間をあける確率
        lullGap: [0.4, 0.8],        // あける長さ（秒）。長く待たせすぎない
        debug: { enabled: false, forceGhosts: null, showStats: false }
      },
      // 🏴‍☠️ PIRATE TREASURE：3ラウンド、3つの宝箱から1つ選ぶ（箱の見た目と中身は無関係）
      pirate: {
        betCost: 1,
        items: ['STONE', 'OLD COIN', 'SAPPHIRE', 'EMERALD', 'RUBY', 'DIAMOND'],
        values: [0, 1, 2, 3, 5, 8],                       // 宝物のVALUE
        probs: [0.40, 0.25, 0.15, 0.10, 0.06, 0.04],      // 出る確率（どの箱も同じ）
        payBands: [[24, 20], [21, 12], [17, 8], [13, 5], [10, 3], [7, 2], [4, 1]],      // 3つのVALUEの合計 → 払い出し（最大VALUEは 8×3＝24）
        debug: { enabled: false, forceItems: null, showStats: false }   // forceItems：['DIAMOND', 'DIAMOND', 'RUBY'] など
      },
      // 🚂 STOP! TRAIN：一度だけBRAKE。押してから、じわじわ減速
      train: {
        betCost: 1,
        speeds: { SLOW: 34, NORMAL: 56, FAST: 86 },       // 列車の速さ（ドット／秒）。速度の差が、見て分かるくらい大きく
        carsList: [2, 3, 4],                              // 車両数（多いほど、止まりにくい）
        baseDecel: 60,              // ブレーキの強さ（止まるまでの距離は、最長でも約105ドット＝画面内で読めます）
        runIn: 1.6,                 // 助走：登場してから、BRAKEを押せるようになるまで（秒）。この間に、列車の速さを見る
        approachBySpeed: { SLOW: 8 },      // 駅に着くまでの秒数（書いていない速さは、approach）。SLOWだけ、少し長く
        runInBySpeed: { SLOW: 2.4 },       // SLOWだけ、助走を少し長く（助走の長さで、速さを当てられないように）
        zoneRefSpeed: 56,           // 判定ゾーンは、この速さを基準に、列車の速さに比例して広がり・せまくなります（速い列車ほど、ズレやすいため）
        carFactor: 0.22,            // 1両ふえるごとに、ブレーキが弱くなる割合
        rampTime: 0.4,              // BRAKEを押してから、ブレーキが全力になるまで（秒）
        approach: 6,                // 駅に着くまでの秒数（目安）
        zones: { perfect: 0.8, good: 1.8, ok: 3.2 },          // 停止マークからのズレ（ドット）。ゆっくり走るので、ズレは小さく測ります
        pays: { perfect: 4, good: 2, ok: 1 },
        debug: { enabled: false, forceSpeed: null, forceCars: null, showStats: false }
      },
      // 🎈 BALLOON SHOOT：自動で動く照準。FIRE!のタイミングだけ
      balloon: {
        betCost: 1,
        shots: 3,                   // 1メダルで撃てる数
        balloonCount: 22,
        blast: 12,                  // 弾が当たる範囲（重なった風船は、1発で複数割れます）
        crossSpeed: 1.0,            // 照準の速さ（1.0が標準）
        // 3発撃ち終えたとき、1ゲームに1回だけ追加購入できます（+1メダル → +2発。最大5発）
        extra: { cost: 1, shots: 2, maxShots: 5, offerTime: 8 },
        types: [
          { id: 'red',    r: 8, pts: 1, speed: 14, weight: 70, color: '#ff5a6a' },       // 赤・丸型
          { id: 'silver', r: 7, pts: 3, speed: 20, weight: 22, color: '#c8d0e0' },       // 銀・丸型
          { id: 'star',   r: 6, pts: 5, speed: 28, weight: 8,  color: '#ffd84a' }        // 金・星型
        ],
        payBands: [[11, 5], [8, 3], [5, 2], [3, 1]],      // 合計POINT → 払い出し
        debug: { enabled: false, forceScore: null, showStats: false }
      },
      // 🌟 SUPER COSMO：大量のメダルを一度にBETする大型機（BET額で確率は変わりません）
      //   w＝抽選の重み　mul＝BETに対する倍率（払い出しは「BET×倍率」の端数を切り捨て）
      cosmo: {
        betCost: 5,                 // 最小BET（記録の計算用）
        bets: [5, 10, 20],          // 選べるBET
        stage1: { lose: 22, ret: 12, next: 66 },                 // 第1抽選：LOSE（全部失う）／RETURN（BETが戻る）／NEXT（次へ）
        take1: 1.2,                 // NEXTのあと、ここで受け取る（TAKE）ときの倍率
        stage2: [                   // BIG CHANCE（CHALLENGEしたとき）
          { id: 'lose', w: 20, mul: 0 }, { id: 'x1', w: 20, mul: 1 }, { id: 'x15', w: 25, mul: 1.5 }, { id: 'x2', w: 15, mul: 2 },
          { id: 'jpc', w: 20 }      // JACKPOT CHANCE（次のJACKPOT抽選に進む権利）
        ],
        take2: 1.5,                 // JACKPOT CHANCEで、ここで受け取る（TAKE）ときの倍率
        final: [                    // 最終のJACKPOT抽選
          { id: 'lose', w: 30, mul: 0 }, { id: 'ret', w: 15, mul: 1 }, { id: 'x2', w: 29, mul: 2 }, { id: 'jp', w: 26, mul: 3 }       // JACKPOT ＝ BET×3
        ],
        rounding: 'floor',          // 端数の処理（'floor'＝切り捨て）
        debug: { enabled: false, force: null, showStats: false }       // force：['next', 'jpc', 'jp'] のように、順番に結果を固定
      }
    },

    // ---- B1 PRIZE CORNER・クレーンゲーム（共通エンジン。景品・台は、すべてここのデータで決まります） ----
    crane: {
      price: 100,                        // 1 PLAY の料金（MONEYから）
      world: { WX: 100, WZ: 64, WY: 70 },// 筐体の中の広さ（横x・奥行きz・高さy）
      home: { x: 7, z: 58 },             // アームの初期位置（景品口の上）
      chute: { x: 20, z: 44 },           // 景品口：x < chute.x かつ z > chute.z
      claw: { xSpeed: 20, zSpeed: 15, descend: 36, lift: 28, move: 30, close: 0.55, spread: 10, prong: 2.4, topY: 62, prongLen: 5, reach: 1.5, reachZ: 0.95, neighbor: 2.2, holdZ: 2.0 },
      phys: { gravity: 90, slide: 26, wallBounce: 0.3, pushPower: 1.0, maxPush: 0.45, contactSlow: 0.4 },       // maxPush＝爪が景品を、1フレームで押せる最大の距離（重い景品ほど、さらに小さくなる）／contactSlow＝爪が景品に触れている間の、下降の速さの倍率
      grab: { minStrength: 0.18, lossBase: 0.5, swing: 0.5, strapBonus: 0.12, multiPenalty: 0.97, heavy: 2.5, heavyHold: { base: 0.07, grip: 0.3, swing: 1.9 } },       // heavyHold＝重い景品（ピヨBIG）は、持ち上がって上まで行くが、バランスを崩しやすい。base＝つねにすべる量／grip＝掴みがあまいほど／swing＝アームを横に動かしているとき   // 持ち上げ判定の係数（強い・弱い・ぽろっ）
      strapHit: 1.6,                     // ストラップに爪が掛かる範囲（細い。判定は大きくしない）
      restock: { tidyDays: 5, newsEvery: 3 },   // 補充は「GETされた空き」だけ／5DAY動いていない景品だけ軽く整頓
      // 台（machines）：armPower＝アームの強さ／count＝入っている景品の数／lineup＝景品の種類（weight＝出やすさ）
      machines: {
        piyo:  { id: 'crane_piyo',  name: 'PIYO BIG CATCHER',      short: 'PIYO BIG', color: '#ffd040', armPower: 0.78, spreadMul: 1.85, count: 3,  lineup: [['piyo_normal', 60], ['piyo_ribbon', 30], ['piyo_crown', 10]] },
        slime: { id: 'crane_slime', name: 'SLIME CATCHER',         short: 'SLIME',    color: '#58e0a0', armPower: 0.5, count: 16, lineup: [['s_baby', 14], ['s_aqua', 12], ['s_leaf', 12], ['s_fire', 10], ['s_thunder', 10], ['s_metal', 8], ['s_poison', 8], ['s_dark', 7], ['s_devil', 6], ['s_crystal', 3], ['s_gold', 2], ['s_king', 2], ['s_rainbow', 1]] },
        duck:  { id: 'crane_duck',  name: 'DUCK CATCHER',          short: 'DUCK',     color: '#5ac8ff', armPower: 0.74, gripMul: 1.35, count: 8, lineup: [['d_takuan', 1], ['d_penguin', 1], ['d_torimomo', 1], ['d_konbu', 1], ['d_violet', 1], ['d_kuromame', 1]] },
        ham:   { id: 'crane_ham',   name: 'HAMSTER & GHOST CATCHER', short: 'HAM&GHOST', color: '#c8a0ff', armPower: 0.54, gripMul: 1.9, count: 12, lineup: [['h_cha', 2], ['h_gray', 2], ['h_shiro', 2], ['h_cha_z2', 2], ['h_gray_z2', 2], ['h_shiro_z2', 2], ['h_cha_z45', 2], ['h_gray_z45', 2], ['h_shiro_z45', 2], ['g_white', 3], ['g_purple', 3], ['g_green', 3], ['p_pumpkin', 1]] },
        fish:  { id: 'crane_fish',  name: 'FISH CATCHER',          short: 'FISH',     color: '#7ad0ff', armPower: 0.5, gripMul: 1.7, count: 9, lineup: [['f_small', 4], ['f_normal', 4], ['f_gold', 3], ['f_puffer', 3], ['f_octo', 3], ['f_golden', 1]] }
      },
      // 景品：file＝素材／dw＝画面での幅（ドット）／ratio＝高さ÷幅／weight＝重さ／grip＝掴みにくさ／fric＝摩擦／roll＝転がりやすさ／shape／strap＝ストラップの取り付け位置（景品の中での 0〜1。ax＝横、ay＝縦（0が上））
      prizes: {
        piyo_normal: { name: 'ピヨぬい', file: 'assets/crane/piyo_normal.webp', big: 'assets/crane/piyo_normal_big.webp', crop: [0, 0, 43, 39], dw: 30, ratio: 0.89, weight: 9.0, grip: 1.0, fric: 1.0, roll: 0.15, damp: 3.2, rest: 0.02, shape: 'bulky', rare: false, strap: null },
        piyo_ribbon: { name: 'ピヨぬいリボン', file: 'assets/crane/piyo_ribbon.webp', big: 'assets/crane/piyo_ribbon_big.webp', crop: [0, 0, 44, 39], dw: 30, ratio: 0.89, weight: 9.0, grip: 1.0, fric: 1.0, roll: 0.15, damp: 3.2, rest: 0.02, shape: 'bulky', rare: false, strap: null },
        piyo_crown:  { name: 'ピヨぬい王冠', file: 'assets/crane/piyo_crown.webp', big: 'assets/crane/piyo_crown_big.webp', crop: [0, 0, 44, 46], dw: 30, ratio: 1.05, weight: 9.4, grip: 1.0, fric: 1.0, roll: 0.15, damp: 3.2, rest: 0.02, shape: 'bulky', rare: true, strap: null },
        s_baby:    { name: 'ベビー スライム',   file: 'img/slimes/baby.webp', crop: [198, 351, 857, 657],    dw: 20, ratio: 0.77, weight: 0.8, grip: 0.5, fric: 0.85, roll: 0.5, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_aqua:    { name: 'アクア スライム',   file: 'img/slimes/aqua.webp', crop: [218, 288, 820, 745],    dw: 20, ratio: 0.9,  weight: 0.9, grip: 0.5, fric: 0.85, roll: 0.5, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_leaf:    { name: 'リーフ スライム',   file: 'img/slimes/leaf.webp', crop: [225, 265, 772, 783],    dw: 20, ratio: 1.02, weight: 0.9, grip: 0.5, fric: 0.85, roll: 0.5, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_fire:    { name: 'ファイア スライム', file: 'img/slimes/fire.webp', crop: [191, 215, 906, 848],    dw: 20, ratio: 0.95, weight: 0.9, grip: 0.5, fric: 0.85, roll: 0.5, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_thunder: { name: 'サンダー スライム', file: 'img/slimes/thunder.webp', crop: [186, 207, 895, 871], dw: 20, ratio: 0.97, weight: 0.9, grip: 0.5, fric: 0.85, roll: 0.5, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_metal:   { name: 'メタル スライム',   file: 'img/slimes/metal.webp', crop: [105, 493, 1026, 520],   dw: 22, ratio: 0.5,  weight: 1.4, grip: 0.65, fric: 0.8, roll: 0.35, shape: 'flat', strap: { ax: 0.5, ay: 0.05 } },
        s_poison:  { name: 'ポイズン スライム', file: 'img/slimes/poison.webp', crop: [37, 252, 1164, 805],  dw: 22, ratio: 0.7,  weight: 1.0, grip: 0.55, fric: 0.85, roll: 0.45, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_dark:    { name: 'ダーク スライム',   file: 'img/slimes/dark.webp', crop: [63, 232, 1096, 837],    dw: 22, ratio: 0.78, weight: 1.0, grip: 0.55, fric: 0.85, roll: 0.45, shape: 'round', strap: { ax: 0.5, ay: 0.05 } },
        s_devil:   { name: 'デビル スライム',   file: 'img/slimes/devil.webp', crop: [30, 352, 1213, 682],   dw: 24, ratio: 0.57, weight: 1.1, grip: 0.6, fric: 0.8, roll: 0.35, shape: 'flat', strap: { ax: 0.5, ay: 0.05 } },
        s_crystal: { name: 'クリスタル スライム', file: 'img/slimes/crystal.webp', crop: [111, 278, 1053, 798], dw: 22, ratio: 0.76, weight: 1.1, grip: 0.6, fric: 0.8, roll: 0.4, shape: 'round', rare: true, strap: { ax: 0.5, ay: 0.05 } },
        s_gold:    { name: 'ゴールド スライム', file: 'img/slimes/gold.webp', crop: [104, 277, 1021, 822],    dw: 24, ratio: 0.81, weight: 1.2, grip: 0.6, fric: 0.8, roll: 0.4, shape: 'round', rare: true, strap: { ax: 0.5, ay: 0.05 } },
        s_king:    { name: 'キング スライム',   file: 'img/slimes/king.webp', crop: [54, 113, 1144, 1044],    dw: 26, ratio: 0.91, weight: 1.4, grip: 0.65, fric: 0.8, roll: 0.35, shape: 'round', rare: true, strap: { ax: 0.5, ay: 0.05 } },
        s_rainbow: { name: 'レインボー スライム', file: 'img/slimes/rainbow.webp', crop: [77, 285, 1115, 814], dw: 24, ratio: 0.73, weight: 1.2, grip: 0.6, fric: 0.8, roll: 0.4, shape: 'round', rare: true, strap: { ax: 0.5, ay: 0.05 } },
        d_takuan:   { name: 'たくあん',   file: 'assets/duck-race/takuan.webp', crop: [0, 0, 795, 702],   dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        d_penguin:  { name: 'ぺんぎん',   file: 'assets/duck-race/penguin.webp', crop: [0, 0, 792, 708],  dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        d_torimomo: { name: 'トリモモ',   file: 'assets/duck-race/torimomo.webp', crop: [0, 0, 796, 754], dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        d_konbu:    { name: 'コンブ',     file: 'assets/duck-race/konbu.webp', crop: [0, 0, 795, 703],    dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        d_violet:   { name: 'バイオレット', file: 'assets/duck-race/violet.webp', crop: [0, 0, 798, 718], dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        d_kuromame: { name: 'クロマメ',   file: 'assets/duck-race/kuromame.webp', crop: [0, 0, 798, 719], dw: 24, ratio: 1.0, weight: 1.2, grip: 0.55, fric: 0.8, roll: 0.3, shape: 'bulky', strap: { ax: 0.55, ay: 0.2 } },
        h_cha:   { name: 'ハムちゃん（茶）',   file: 'assets/ham-chan/cha_success.webp', crop: [1, 8, 366, 364],   dw: 24, ratio: 1.0, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_gray:  { name: 'ハムちゃん（グレー）', file: 'assets/ham-chan/gray_success.webp', crop: [1, 5, 367, 366],  dw: 24, ratio: 1.0, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_shiro: { name: 'ハムちゃん（白）',   file: 'assets/ham-chan/shiro_success.webp', crop: [1, 2, 366, 369], dw: 24, ratio: 1.0, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_cha_z2: { name: 'ハムちゃん（茶）きょとん',   file: 'assets/ham-chan/cha_zone2.webp', crop: [1, 10, 366, 361],   dw: 24, ratio: 0.99, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_gray_z2: { name: 'ハムちゃん（グレー）きょとん', file: 'assets/ham-chan/gray_zone2.webp', crop: [1, 8, 366, 363],  dw: 24, ratio: 0.99, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_shiro_z2: { name: 'ハムちゃん（白）きょとん',   file: 'assets/ham-chan/shiro_zone2.webp', crop: [1, 7, 365, 364], dw: 24, ratio: 1.0, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_cha_z45: { name: 'ハムちゃん（茶）うるうる',   file: 'assets/ham-chan/cha_zone45.webp', crop: [1, 2, 366, 370],   dw: 24, ratio: 1.01, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_gray_z45: { name: 'ハムちゃん（グレー）うるうる', file: 'assets/ham-chan/gray_zone45.webp', crop: [1, 7, 366, 364],  dw: 24, ratio: 0.99, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        h_shiro_z45: { name: 'ハムちゃん（白）うるうる',   file: 'assets/ham-chan/shiro_zone45.webp', crop: [1, 6, 366, 365], dw: 24, ratio: 1.0, weight: 1.0, grip: 0.5, fric: 0.6, roll: 0.9, shape: 'round', strap: { ax: 0.5, ay: 0.06 } },
        g_white:  { name: 'ゴースト（白）',   file: 'assets/cosmo/ghost_white.webp', crop: [0, 0, 36, 38],  dw: 18, ratio: 1.05, weight: 0.8, grip: 0.4, fric: 0.9, roll: 0.1, shape: 'long', strap: { ax: 0.5, ay: 0.04 } },
        g_purple: { name: 'ゴースト（紫）', file: 'assets/cosmo/ghost_purple.webp', crop: [0, 0, 41, 38], dw: 20, ratio: 0.93, weight: 0.8, grip: 0.62, fric: 0.9, roll: 0.1, shape: 'long', strap: { ax: 0.5, ay: 0.04 } },
        g_green:  { name: 'ゴースト（緑）', file: 'assets/cosmo/ghost_green.webp', crop: [0, 0, 29, 38],  dw: 15, ratio: 1.3, weight: 0.8, grip: 0.35, fric: 0.9, roll: 0.1, shape: 'long', strap: { ax: 0.5, ay: 0.04 } },
        p_pumpkin: { name: 'ダミーパンプキン', file: 'assets/cosmo/pumpkin.webp', crop: [0, 0, 40, 38], dw: 20, ratio: 0.95, weight: 1.0, grip: 0.5, fric: 0.7, roll: 0.8, shape: 'round', rare: true, strap: { ax: 0.5, ay: 0.06 } },
        f_small:  { name: '魚（青）',   file: 'assets/cosmo/fish_small.webp', crop: [0, 0, 22, 15],  dw: 18, ratio: 0.68, weight: 0.7, grip: 0.45, fric: 0.9, roll: 0.15, shape: 'flat', strap: { ax: 0.55, ay: 0.3 } },
        f_normal: { name: 'クマノミ',         file: 'assets/cosmo/fish_normal.webp', crop: [0, 0, 26, 21], dw: 20, ratio: 0.8,  weight: 0.8, grip: 0.85, fric: 0.9, roll: 0.15, shape: 'flat', strap: { ax: 0.55, ay: 0.3 } },
        f_gold:   { name: 'きんぎょ',         file: 'assets/cosmo/fish_gold.webp', crop: [0, 0, 28, 19],   dw: 22, ratio: 0.68, weight: 0.8, grip: 0.45, fric: 0.9, roll: 0.15, shape: 'flat', strap: { ax: 0.55, ay: 0.3 } },
        f_puffer: { name: 'フグ',             file: 'assets/cosmo/fish_puffer.webp', crop: [0, 0, 24, 21], dw: 19, ratio: 0.88, weight: 0.9, grip: 0.85, fric: 0.8, roll: 0.7, shape: 'round', strap: { ax: 0.55, ay: 0.25 } },
        f_octo:   { name: 'タコ',             file: 'assets/cosmo/fish_octo.webp', crop: [0, 0, 26, 22],   dw: 20, ratio: 0.85, weight: 0.9, grip: 0.5, fric: 0.85, roll: 0.3, shape: 'bulky', strap: { ax: 0.5, ay: 0.05 } },
        f_golden: { name: 'ゴールデンフィッシュ', file: 'assets/cosmo/fish_golden.webp', crop: [0, 0, 34, 27], dw: 24, ratio: 0.79, weight: 0.9, grip: 0.85, fric: 0.9, roll: 0.15, shape: 'flat', rare: true, strap: { ax: 0.55, ay: 0.3 } }
      }
    },

    // ---- HAPPY BEAT（音楽ゲーム）。判定の幅・速さ・ランクの境目などは、ここで調整します ----
    happyBeat: {
      price: 100,                    // 1 PLAY の料金（MONEYから。曲と難易度を決めて「あそぶ」を押したときに、はらう）
      perfect: 0.06, good: 0.13,     // 判定の幅（秒）：PERFECT ±60ms／GOOD ±130ms。これをこえると MISS
      globalOffset: 0,               // 全体の判定オフセット（秒）。端末の音の遅れを合わせる。曲ごとの musicOffset は、曲データに
      approach: 1.6,                 // ノーツが、上から判定ラインまで流れる時間（秒）。見た目の速さだけ。判定の時刻は変わらない（下の speeds で、プレイ中に変えられます）
      speeds: [3.0, 2.6, 2.3, 2.0, 1.8, 1.6, 1.45, 1.3, 1.15, 1.0], speedDefault: 6,       // ノーツ速度 1〜10 に対する、流れる時間（秒）。数字が大きいほど、はやい
      musicVolume: 0.9, seVol: 0.025,// 音源の音量／ノーツのSEの音量（曲をじゃましない小ささ）
      goodRate: 0.7,                 // GOOD の得点の割合（PERFECT＝1）
      tickEvery: 0.125, tickUnit: 0.12, maxTickUnits: 14, checkUnit: 0.5, tailUnit: 0.5,    // ホールド・スライドの途中の得点（長いホールド1本で、スコアが極端に有利にならないよう、上限つき）
      glide: 0.2, pathTol: 0.85, holdTol: 0.9, touchLane: 0.8, tailEarly: 0.22, tickGrace: 2, liftGrace: 0.4,// スライドの、レーンの移りかた／帯からのズレの許容（レーン幅の割合）／タッチのレーン判定の広さ／終端の早はなしの許容／途中の許容回数／スライド中に、一瞬ゆびをはなしても つづけられる時間（秒）
      rank: { S: 950000, A: 850000, B: 700000, C: 500000 }                                  // ランクの境目（これ未満は D）
    },

    // ---- SPARK TAP（パネル音楽ゲーム）。判定の幅・予告の長さ・ランクの境目は、ここで調整します ----
    sparkTap: {
      price: 100,                    // 1 PLAY の料金（MONEYから。曲と難しさを決めて「遊ぶ」を押したときに、はらう）
      perfect: 0.07, good: 0.14,     // 判定の幅（秒）：PERFECT ±70ms／GOOD ±140ms。これをこえると MISS
      globalOffset: 0,               // 全体の判定オフセット（秒）。端末の音の遅れを合わせる。曲ごとの musicOffset は、曲データに
      preview: 0.75,                 // SPARK などが、判定の何秒まえから光りはじめるか（見た目の予告だけ。判定の時刻は、変わらない）
      chainPreview: 1.1,             // CHAIN の色と数字が、最初の判定の何秒まえから見えるか
      chainRing: 0.6,                // CHAIN の各色の、色つきの「集まる光」が、その色の判定の何秒まえから動くか（見た目だけ）
      musicVolume: 0.9, seVol: 0.025,// 音源の音量／効果音の音量（ピアノをじゃましない小ささ）
      goodRate: 0.7,                 // GOOD の得点の割合（PERFECT＝1）
      chargeTick: 0.125, chargeTickUnit: 0.1, chargeMaxTicks: 12, chargeTailUnit: 0.5, tailEarly: 0.25,   // CHARGE：途中の得点（長い1本だけで有利にならないよう上限つき）／終端の早はなしの許容（秒）
      colors: ['#ff3b3b', '#ffd83a', '#3a8cff', '#3aff7a', '#b45aff', '#ff8a2a'],                  // CHAIN の色（order 1〜6：赤・黄・青・緑・紫・オレンジ）。全曲・全難易度で共通
      rank: { S: 950000, A: 850000, B: 700000, C: 500000 }                                       // ランクの境目（これ未満は D）
    },

    // ---- KAWAII CLUB（プリントシール機）。背景の色・ペンの色と太さ・スタンプの大きさ などは、ここで調整します ----
    kawaiiClub: {
      price: 100,                    // PHOTO 1回の料金（MONEYから。「撮影する」を決めたときに、はらう）
      photoAspect: 1.12,             // 写真の たてよこの比（たて ÷ よこ）
      stampBase: 0.24,               // スタンプの、ふつうの大きさ（写真のよこ幅に対する割合）
      stampMax: 80, strokeMax: 150,  // 1枚の写真に つけられる、スタンプと線の数（ふつうに遊んでいて、いっぱいにならない多さ）
      minDist: 0.006,                // 手書きの線の点を まびく間隔（写真の幅に対する割合。保存の大きさをおさえる）
      backgrounds: [                 // 背景（単色）。色は、ここだけで管理
        { id: 'dustyBlue', label: 'くすみブルー', color: '#8aa6c1' }, { id: 'dustyPink', label: 'くすみピンク', color: '#d9a3ae' }, { id: 'brown', label: 'ブラウン', color: '#7a5a48' }, { id: 'black', label: 'ブラック', color: '#1c1a20' },
        { id: 'white', label: 'ホワイト', color: '#f4f2ee' }, { id: 'sageGreen', label: 'セージグリーン', color: '#a3b59a' }, { id: 'pastelPurple', label: 'パステルパープル', color: '#b9a4d6' }, { id: 'ivory', label: 'アイボリー', color: '#efe6cf' }
      ],
      penColors: ['#ffffff', '#222222', '#ff7ab8', '#6ad0ff', '#ffe04a', '#ff4a4a', '#4acb6a', '#a56aff'],   // 白・黒・ピンク・水色・黄色・赤・緑・紫
      penWidths: [0.007, 0.014, 0.026]                                                          // 細・中・太（写真のよこ幅に対する割合）。最初は「中」
    },

    // ---- TOP DRIVER（レースゲーム）。速さ・ハンドル・ぶつかったときの減速・CPUの個性・コースは、ここで調整します ----
    topDriver: {
      price: 100,                      // 1 PLAY の料金（MONEYから）
      speedKmh: 150,                   // 画面に出す「km/h」（ふだんの最高速のときの数字。演出用）。スピードUP中は 約207、DOWN中は 約83
      lengthScale: 1.19,               // コースの長さの倍率（速くなったぶん、のばして、レースの時間を、いままでと同じ約33秒に保つ）
      curveScale: 0.00046,             // 道路のカーブの見えかた（大きいほど、カーブが強く見える）
      camFollow: 0.8,                  // カメラが、プレイヤーの横の位置に、どれだけ ついていくか（のこりぶんは、車が画面の横へ動く）
      cpuCurvePenalty: 0.28,           // CPU がカーブで落とす速さ（かんたん・個性 curveSkill で変わる）
      physics: {
        maxSpeed: 2680,                // 最高速（コース上の距離／秒）。ふだんは、これを保つ（前の2250と、スピードUP中の3105の、中間あたり）
        acceleration: 1370,            // 加速（スタート・草地や衝突のあとの回復）
        coast: 830,                    // 速さが、ターゲットより高いときの、落ちかた
        grassSpeedMultiplier: 0.55,    // 草地での最高速の割合
        grassDecel: 1790,              // 草地に入ったときの、減速の強さ
        wallX: 1.55,                   // 壁・ガードレールの位置（道路のはしが ±1.0）
        wallSpeedLoss: 0.2,            // 壁に当たったときに、減る速さの割合（一度だけ）
        cpuCollisionSpeedLoss: 0.1,    // CPU車にぶつかったとき、減る速さの割合
        steeringStrength: 2.2,         // ハンドルいっぱいで、1秒に動く横の距離（道路の幅＝2）
        curveDriftStrength: 0.9,       // カーブで、無操作だと外へ流れる強さ
        grassX: 1.10,                  // 草地とみなす位置（道路のはしが ±1.0。赤白の縁石の外はし＝約1.09）。車の中心が、緑のところへ入ったときだけ、遅くなる
        steerScrub: 0,                 // ハンドルを切ったときの減速。0＝なし（草地・壁・CPU車・DOWNアイテムのとき以外は、遅くならない）
        collisionPush: 2.4,            // CPU車に、おし出される強さ
        carHalf: 0.14, hitZ: 150, hitX: 0.26   // 車のよこ幅の半分（道路の幅＝2 のうち）／ぶつかる前後の距離／ぶつかる左右のはば（見た目より、少し小さめ）
      },
      steering: { maxAngle: 180, curve: 1.3, sensitivity: 1.0, autoCenterSpeed: 7 },        // ハンドル：最大角度（±）／中央付近を、こまかく（1より大きいほど）／感度／はなしたときに中央へ戻る早さ
      cpus: [                          // CPU 3台（個性）：speedMul＝最高速に対する割合（プレイヤーが ミスなく走れば、ぬける）／lineBias＝走る位置／wobble＝ふらつき／curveSkill＝カーブの上手さ
        { name: 'A', color: '#3a8cff', startDz: 520, startX: -0.45, speedMul: 0.975, lineBias: -0.35, wobble: 0.05, curveSkill: 0.9 },
        { name: 'B', color: '#ffd83a', startDz: 260, startX: 0.45, speedMul: 0.945, lineBias: 0.3, wobble: 0.22, curveSkill: 0.6 },
        { name: 'C', color: '#3aff7a', startDz: -240, startX: -0.05, speedMul: 0.91, lineBias: 0.0, wobble: 0.1, curveSkill: 0.3 }
      ],
      items: { count: 3, duration: 3, upMul: 1.38, downMul: 0.55, hitZ: 130, hitX: 0.12, upCount: 1 },    // コースの アイテム：毎回 count 個を、まばらに（ばらばらの場所に）置く。upCount 個だけ スピードUP、のこりは スピードDOWN。効果は duration 秒
      looks: {                         // 背景（昼・夕暮れ・夜）。dark＝ぜんたいを暗くする量
        day: { name: '昼', skyTop: '#4aa8ff', skyBot: '#bfe8ff', sea: '#2a78d8', hill: '#4a8a9a', grassA: '#3fb04a', grassB: '#36a042', roadA: '#6a6a78', roadB: '#62626e', cloud: '#ffffff', dark: 0, stars: false, sun: { x: 150, y: 44, c: '#fff3a0', r: 5, glow: 0.3 } },
        dusk: { name: '夕方', skyTop: '#3a3a8a', skyBot: '#ffa060', sea: '#b0546e', hill: '#4a3a62', grassA: '#33803c', grassB: '#2c7436', roadA: '#585868', roadB: '#515162', cloud: '#ffc09a', dark: 0.22, stars: false, sun: { x: 112, y: 74, c: '#ffd070', r: 9, glow: 0.4 } },
        night: { name: '夜', skyTop: '#04061a', skyBot: '#1a2a5e', sea: '#0a1c40', hill: '#0e1830', grassA: '#12301c', grassB: '#0f2818', roadA: '#2e2e3c', roadB: '#292936', cloud: '#26366a', dark: 0.5, stars: true, sun: { x: 150, y: 40, c: '#f4f4d8', r: 5, glow: 0.25 } }
      },
      courses: [                       // コースのデータ（6種類）。1つ足すと、コース選択に出る。length＝区間の数（1区間＝200）／curve＝曲がり（＋が右）。となりあう区間が反対向きなら S字カーブ
        { id: 'seaside', name: 'SEASIDE COURSE',               // 海沿い：明るい海と ヤシの木
          theme: { band: 'sea', grassA: '#3fb04a', grassB: '#36a042', roadA: '#6a6a78', roadB: '#62626e', hill: '#4a8a9a', ground: '#2a78d8' },
          objs: [['palm', 34], ['lamp', 10], ['sign', 6], ['rock', 6]],
          sections: [ { length: 30, curve: 0 }, { length: 30, curve: 0.5 }, { length: 10, curve: 0 }, { length: 32, curve: -0.65 }, { length: 14, curve: 0 },
            { length: 22, curve: 0.8 }, { length: 22, curve: -0.8 },                                  // S字カーブ①（右→左）
            { length: 14, curve: 0 }, { length: 28, curve: 0.95 }, { length: 10, curve: 0 },
            { length: 18, curve: -0.85 }, { length: 18, curve: 0.85 }, { length: 18, curve: -0.85 },   // S字カーブ②（左→右→左）
            { length: 16, curve: 0 }, { length: 28, curve: -1.0 }, { length: 10, curve: 0 }, { length: 32, curve: 0.72 }, { length: 38, curve: 0 } ] },
        { id: 'city', name: 'CITY COURSE',                      // 街：ビルと街灯。直角に近い、きびしめのカーブ
          theme: { band: 'city', grassA: '#76867a', grassB: '#6c7c70', roadA: '#4c4c5a', roadB: '#464654', hill: '#5a6a92', ground: '#3a3a4c' },
          objs: [['building', 40], ['lamp', 22], ['sign', 10]],
          sections: [ { length: 34, curve: 0 }, { length: 26, curve: 0.7 }, { length: 16, curve: 0 }, { length: 26, curve: -0.75 }, { length: 12, curve: 0 },
            { length: 26, curve: 0.9 }, { length: 26, curve: -0.9 }, { length: 16, curve: 0 }, { length: 30, curve: -0.85 }, { length: 14, curve: 0 },
            { length: 22, curve: 1.0 }, { length: 22, curve: -1.0 }, { length: 22, curve: 0.9 }, { length: 18, curve: 0 }, { length: 34, curve: 0.65 }, { length: 50, curve: 0 } ] },
        { id: 'mountain', name: 'MOUNTAIN COURSE',              // 山：松の木と岩。曲がりつづける、山道
          theme: { band: 'mountain', grassA: '#2f8a4a', grassB: '#287a40', roadA: '#686870', roadB: '#60606a', hill: '#5c7ca0', ground: '#2a6a3a' },
          objs: [['pine', 40], ['rock', 20], ['sign', 4], ['lamp', 4]],
          sections: [ { length: 26, curve: 0 }, { length: 30, curve: 0.6 }, { length: 24, curve: -0.8 }, { length: 24, curve: 0.8 }, { length: 12, curve: 0 }, { length: 34, curve: 1.0 }, { length: 16, curve: 0 },
            { length: 28, curve: -1.0 }, { length: 28, curve: 1.0 }, { length: 12, curve: 0 }, { length: 30, curve: -0.9 }, { length: 24, curve: 0.9 }, { length: 24, curve: -0.9 }, { length: 16, curve: 0 }, { length: 36, curve: 0.8 }, { length: 46, curve: 0 } ] },
        { id: 'desert', name: 'DESERT COURSE',                  // 砂漠：サボテンと砂丘。ゆったり大きなカーブ
          theme: { band: 'dune', grassA: '#d8b868', grassB: '#cfae5a', roadA: '#7c7472', roadB: '#746c6a', hill: '#c8985a', ground: '#d8b868' },
          objs: [['cactus', 30], ['rock', 20], ['sign', 8], ['lamp', 6]],
          sections: [ { length: 40, curve: 0 }, { length: 40, curve: 0.45 }, { length: 22, curve: 0 }, { length: 40, curve: -0.55 }, { length: 30, curve: 0 },
            { length: 26, curve: 0.85 }, { length: 26, curve: -0.85 }, { length: 30, curve: 0 }, { length: 44, curve: 0.6 }, { length: 18, curve: 0 }, { length: 30, curve: -0.9 }, { length: 40, curve: 0 } ] },
        { id: 'forest', name: 'FOREST COURSE',                  // 森：木がいっぱい。S字が3つつづく
          theme: { band: 'forest', grassA: '#2a7a3a', grassB: '#236e32', roadA: '#5e5e66', roadB: '#56565e', hill: '#1f5a34', ground: '#1a4a2a' },
          objs: [['pine', 50], ['rock', 8], ['lamp', 6], ['sign', 4]],
          sections: [ { length: 30, curve: 0 }, { length: 34, curve: 0.55 }, { length: 18, curve: 0 }, { length: 34, curve: -0.6 }, { length: 12, curve: 0 },
            { length: 28, curve: 0.8 }, { length: 28, curve: -0.8 }, { length: 28, curve: 0.8 }, { length: 14, curve: 0 }, { length: 36, curve: -0.7 }, { length: 14, curve: 0 }, { length: 34, curve: 0.75 }, { length: 16, curve: 0 }, { length: 44, curve: 0 } ] },
        { id: 'snow', name: 'SNOW COURSE',                      // 雪原：雪をかぶった木。つよいカーブが、たまに
          theme: { band: 'snow', grassA: '#e8f0ff', grassB: '#dce6f8', roadA: '#7a8090', roadB: '#727888', hill: '#b8c8e8', ground: '#f0f6ff' },
          objs: [['snowpine', 44], ['rock', 10], ['lamp', 8], ['sign', 4]],
          sections: [ { length: 30, curve: 0 }, { length: 40, curve: 0.6 }, { length: 20, curve: 0 }, { length: 26, curve: -0.9 }, { length: 26, curve: 0.9 }, { length: 16, curve: 0 },
            { length: 38, curve: -0.8 }, { length: 12, curve: 0 }, { length: 24, curve: 1.0 }, { length: 24, curve: -1.0 }, { length: 16, curve: 0 }, { length: 40, curve: 0.7 }, { length: 18, curve: 0 }, { length: 46, curve: 0 } ] }
      ]
    },

    // ---- BASKET RUSH（6F）。物理・投げかた・ゴールの動きは、ここで調整します（すべて 画面の論理ピクセル／秒） ----
    basketRush: {
      price: 100, timeSec: 30, ballCount: 6,                    // 1 PLAY の料金／プレイ時間（秒）／ボールの数（5〜7で調整できる）
      physics: { gravity: 700, ballRadius: 9, airDamping: 0.05, wallRest: 0.45, floorRest: 0.5, ringRest: 0.55, boardRest: 0.55, ballBallRest: 0.35, rollFriction: 1.4, minScoreVy: 10 },        // 重力／ボールの半径／空気ていこう／かべ・床・リング・ボード・ボールどうしの反発／床でころがるときの摩擦／得点に必要な、下向きの速さ
      throw: { mul: 0.9, minSpeed: 600, maxSpeed: 760, minFlick: 110, window: 0.09, touchPad: 9, aimAssist: 0.5, assistRange: 110 },                     // フリック→投球：速さの倍率／さいていの投げる速さ／さいこうの速さ／これより ゆっくり はなすと、投げずに落とす／指のうごきを見る時間（秒）／ボールをつかむ判定の、ひろげる量
      goal: { moveStartAt: 10, moveSpeed: 34, moveDir: -1, hoopW: 44, rimR: 2.5, sensorW: 32, sensorH: 4, sensorOffset: 3, boardW: 70, bankSpeed: 200, bankKeep: 0.35 }       // ゴールが動きはじめる残り時間／さいだいの速さ／さいしょに動く向き（-1＝左）／リングの内側のはば／リングのふちの半径／得点センサーのはば・高さ・リングからの位置／バックボードのはば／板に当たる（バンク）ようになる、上向きの速さ／当たったあとに のこる速さの割合
    },

    // ---- NICE BATTING（6F）。ここの数字で、むずかしさ・打球・的の位置を調整します（画面の論理ピクセル／秒） ----
    niceBatting: {
      price: 100, ballCount: 10, windTime: 0.75, nextPitchDelay: 0.9,                      // 1 PLAY の料金／球数／ピッチングマシンの作動時間／結果を見せてから、つぎの球までの間
      pitch: { baseTime: 1.15, timeVariance: 0.12, heightVariance: 1.0, horizontalVariance: 1.0 },       // 球が、とどくまでの時間（秒）／その±のはば（割合）／高さのばらつき（±10px）／よこのばらつき（±8px）
      swing: { minDistance: 22, minSpeed: 200, maxSpeed: 900, durMax: 0.36, durMin: 0.22, contactAt: 0.58, slantTolerance: 0.9, batLen: 46, flatten: 0.5, readyAngle: -1.2, endAngle: -4.3 },       // スワイプと認める最小のきょり・最小/最大の速さ・スイングの長さ（ゆっくり/はやい）・バットがゾーンを通る割合・斜めの許容・バットの長さ
      hit: { window: 0.14, perfectCenter: 0, niceQual: 0.8, nicePower: 0.8, foulQual: 0.12, powerQual: 0.4, powerSpeed: 0.6 },            // 当たるはば（±秒）／ジャストの時刻のずれ／NICE HITになる「うまさ」と「強さ」／これより下手だとファウル
      flight: { time: 0.75, arc: 26, landSx: 62, baseY: 150, topY: 46, rise: 98, pLow: 0.4, hBias: 7, wBias: 0.06 },     // 打球が飛ぶ時間／ふくらみ／タイミングで左右に動くはば／ネット上の高さ（強さ pLow〜1 で、baseY から rise だけ上がる）／高い球の影響
      targets: [ { score: 100, dx: 0, y: 64, r: 14 }, { score: 30, dx: -46, y: 98, r: 17 }, { score: 50, dx: 0, y: 98, r: 18 }, { score: 30, dx: 46, y: 98, r: 17 }, { score: 10, dx: -46, y: 142, r: 17 }, { score: 10, dx: 46, y: 142, r: 17 } ]       // 的：点数・中心からの横・高さ・半径
    },

    // ---- POWER PUNCH（6F）。ここの数字で、むずかしさ・点数の出かたを調整します（座標・速さは、画面の高さに対する割合） ----
    powerPunch: {
      price: 100, maxPower: 999, inputTimeout: 5, rollDuration: 1.6,                           // 1 PLAY の料金／最大値／PUNCH!! のあと、スワイプを待つ時間（秒）／数字が上がる時間（秒）
      swipe: { minDistance: 0.26, minSpeed: 0.9, maxSpeed: 3.2, window: 0.1, speedCurve: 0.9, maxAngle: 55 },       // さいてい距離（高さ比）／さいていの速さ・これ以上は ぜんぶMAX（高さ／秒）／速さを見る時間（秒）／速さのカーブ／これより横にたおれたスワイプは、無効（度）
      speedExp: 0.85, qFloor: 0.30, accWeight: 0.8, dirWeight: 0.2,                            // POWER＝999×速さの点^speedExp×（qFloor＋残り×命中の質）。命中の質＝精度×accWeight＋方向×dirWeight
      padHit: 1.12, accPlateau: 0.06, accCurve: 1.15, dirPlateau: 3, dirRange: 32,              // パッドの当たり範囲（半径比）／これ以内なら精度MAX／精度のカーブ／方向がこの角度以内ならMAX／方向が0点になる角度
      startZone: { x: 0.2, y: 0.835, w: 0.6, h: 0.115, tol: 14 },                                // START領域（ゲーム領域に対する割合）。tol＝まわりの、のりしろ（px）
      pad: { cx: 0.5, cy: 0.42, r: 0.23 }                                                       // パッドの中心・半径（幅に対する割合）
    },

    // ---- AIR SMASH（6F）。ここの数字で、パック・CPUの強さを調整します（長さは、盤の幅に対する割合／px・秒） ----
    airSmash: {
      price: 100, winScore: 5, safetyTime: 270, goalResetDelay: 1.0, stuckTime: 2.5, stuckRadius: 24,       // 1 PLAY の料金／勝ちの点数／見えない安全タイマー（秒。270＝4分30秒）／ゴール後の間（秒）／パックが「同じ場所から動けない」と見なす時間・はんい（px）
      puckRadius: 0.04, puckMaxSpeed: 620, puckFriction: 0.16, wallRest: 0.96, malletRest: 0.85, postRadius: 2.5,        // パックの半径（盤の幅比）／さいだい速度／摩擦（小さい）／かべの反発／マレットの反発／ポストの半径
      malletRadius: 0.08, playerMaxSpeed: 1100, fingerOffset: 10, goalWidth: 0.32, homeY: 0.15,                       // マレットの半径（同じ半径で、プレイヤーもCPUも）／プレイヤーの最大速度／指より、マレットを上にずらす量／ゴールのはば（盤の幅比）／CPUの基本位置（盤の高さ比）
      cpuLevelWeights: [10, 20, 40, 20, 10],                                                                          // CPU LEVEL 1〜5 の出る確率（%）。毎試合のはじめに、1回だけ抽選する
      cpuProfiles: {                                                                                                  // 5段階のCPU。reaction＝パックの情報が、これだけ前のもの（秒）／speed・accel＝さいだい速度・加速度／prediction＝軌道予測のたしかさ／aggression＝攻めたがり／error＝位置どり・ねらいのズレ（px）／attackSpeed＝これより遅いパックなら、打ちにいく
        1: { reaction: 0.36, speed: 190, accel: 750, prediction: 0.05, aggression: 0.3, error: 32, attackSpeed: 130 },
        2: { reaction: 0.28, speed: 260, accel: 1100, prediction: 0.28, aggression: 0.5, error: 22, attackSpeed: 170 },
        3: { reaction: 0.2, speed: 340, accel: 1500, prediction: 0.5, aggression: 0.65, error: 14, attackSpeed: 210 },
        4: { reaction: 0.16, speed: 385, accel: 1850, prediction: 0.62, aggression: 0.75, error: 11, attackSpeed: 235 },
        5: { reaction: 0.12, speed: 435, accel: 2250, prediction: 0.76, aggression: 0.85, error: 8, attackSpeed: 255 }
      },
      botProfile: { reaction: 0.16, speed: 420, accel: 2000, prediction: 0.6, aggression: 0.7, error: 12, attackSpeed: 230 }       // テスト専用：プレイヤーの代わりに動く、ふつうの腕前のボット（ゲームでは、使わない）
    },

    // ---- STRIKE ZONE（6F）。ここの数字で、ボール・スワイプ・ピンのうごきを調整します（長さは、レーンの世界の単位。レーンのはば＝100）----
    strikeZone: {
      price: 100, frames: 5,                                                                       // 1 PLAY の料金／フレーム数（最終フレームは ボーナス投球つき。ストライクが続けば、さいだい150点）
      lane: { width: 100, gutter: 16, length: 380, pinRowDz: 22, pinSpacing: 26, pitDepth: 70 },   // レーンのはば／ガターのはば／ピンまでの長さ／ピンの列のあいだ（おく）／ピンのあいだ（よこ）／ピットの深さ
      view: { horizon: 96, near: 332, focal: 360 },                                                // 疑似3D：地平線の高さ／手前（ボールの位置）の高さ／遠近の強さ
      ball: { radius: 10, hitRadius: 8.5, mass: 7, minSpeed: 250, maxSpeed: 640, friction: 0.16, minRoll: 120 },   // ボールの半径・ピンに当たる半径（見た目より少し小さい）・重さ／さいていの速さ（これより遅い球にならない）・さいだい／ころがる摩擦／ピンまで必ず とどく、さいていのすすむ速さ
      swipe: { minDistance: 0.15, minSpeed: 0.3, maxSpeed: 3.2, speedCurve: 0.7, dirScale: 0.55, maxAngle: 0.3, spinScale: 6.0, jitterDeadzone: 0.05, spinMax: 1.0, curveStrength: 140, curveSpeedExp: 1.5, modeDistance: 9, adjustRatio: 1.25 },       // スワイプ：さいてい距離（高さ比）／さいていの速さ・さいだい（高さ／秒。これより遅い入力は、投球にしない）・速さのカーブ／向きの強さ／さいだい角（rad）／弧→回転の強さ／指のブレを無視するはば／回転のさいだい／カーブの強さ／位置調整か投球か決める距離・比
      guard: { restitution: 0.45 },                                                                // ガードの反発（低〜中）
      pin: { radius: 5.7, collideRadius: 7.8, mass: 1.6, restitution: 0.55, pinRestitution: 0.7, knock: 130, maxLinear: 520, maxAngular: 9, downAngle: 0.62, tipCrit: 0.28, fallAngle: 0.7, restore: 60, fallAccel: 46, tipDamp: 2.2, tipImpulse: 0.012, tipFallSpeed: 50, slideFriction: 2.6, jitter: 0.12, angJitter: 0.12, settleTime: 1.0, resultTimeout: 3.4 }       // ピン：半径・ぶつかる円の半径・重さ・反発（ボールとの／ピン同士）／これ以上の速さで当てると たおれてすべる／さいだい速度・角速度／たおれた判定の角度／ぐらぐら→パタンの境目・はやさ／すべるときの摩擦／ゆらぎ（強さ・向き）／おちつく時間・待つ限界
    },

    // ---- PING PONG RALLY（6F・卓球）。ここの数字で、球の速さ・打てるタイミングのはば・CPUの強さを調整します（台の長さ＝180、はば＝100の単位／秒） ----
    pingPong: {
      price: 100, winScore: 5, safetyTime: 270, pointDelay: 1.0,                              // 1 PLAY の料金／勝ちの点／見えない安全タイマー（秒）／得点のあとの間（秒）
      ball: { gravity: 330, tableRest: 0.82, minSpeed: 120, maxSpeed: 380, playerScale: 1.0, cpuScale: 1.0, netClearance: 5 },                       // ボール：重力／台のはずみ／水平の さいていの速さ・さいだい（ここをこえない）／プレイヤー・CPUの球速の倍率／ネットの上を とおる、さいていの高さ
      window: { cpuWindow: 0.2 },                                                                                         // CPUの打つタイミングの許容（秒）。プレイヤーは、タイミングを問われない（ラケットを合わせるだけ）
      input: { minY: 0.35 },                                                                                              // ゆびを うけつける、画面の上のライン（高さ比）。このラインより下なら、どこをさわっても、ラケットが動く
      racket: { halfW: 14, fingerGain: 1.4, maxSpeed: 650, hitZ: -2, maxH: 60, lateral: 40, edgeMax: 46, moveBonus: 0.03, moveMax: 5, baseSn: 0.45, perRally: 0, snCap: 0.8, moveSpeedBonus: 0.12, serveAim: 0.8 },       // ラケット：（ふるい設定は そのまま）ラケットの当たった場所（−1〜1）に、なめらかに比例する「返球の よこ位置」＝lateral。いちばん端でも edgeMax まで（台の中に収まる）       // ラケット：はんぶんの はば／ゆびへの追従の さいだい速度／ボールを うける線（台のはしからの きょり）／うける、さいだいの高さ／コースの はば（1.0＝台のはし）／動きながら当てたときの おまけ（左右の向き・さいだい）／はじめの球の強さ／ラリー1回ごとに ふえる強さ・さいだい／動きながらの おまけの強さ／サーブの向き（ラケット位置の割合）
      serve: { startH: 18, tossV: 70, maxH: 30, hitH: 12 },
      fair: { speed: 150, reaction: 0.3, minTime: 0.6, maxH: 48, tries: 10 },                                              // フェアな球だけを打つ：CPUが打つとき、プレイヤーが「人間の速さ（speed）で、反応（reaction秒）のあとに」ラケットを 動かして とどくか 計算する。とどかない球は、コースをラケットがわへ寄せ、球を 少しおそくする（ミスショットは 対象外）。CPUの強さは 変えない
      smash: { minH: 14, highH: 28, maxOff: 0.62, speed: 0.95, counterSn: 0.74, shake: 0.2, popT: 0.75 },                      // SMASH：ボールが ふさわしい高さ（minH以上）で、ラケットのまんなか寄り（maxOff以内）に当たり、「甘い球」（相手がくずれて返した球）か 高い球（highH以上）のとき、自動で出る。speed＝SMASHの球の強さ（0〜1）
      sweet: { stressMin: 0.4, slow: 0.45, center: 0.6, lift: 28, travelDiv: 60 },                                           // 甘い球：CPUが 大きく走らされた／ぎりぎりで返した とき（くずれ度 stress）、球を おそく・まんなか寄りに・ふわっと（lift）返す。travelDiv＝この きょりを走ると くずれ度が 0.7 になる
      tempo: [1.0, 1.06, 1.12, 1.18],                                                                                     // ラリーのテンポ：0〜4回／5〜9回／10〜14回／15回以上（上限つき。得点が入ると もどる）
      cpuLevelWeights: [10, 20, 40, 20, 10],                                                                              // CPU LEVEL 1〜5 の出る確率（%）。毎試合のはじめに、1回だけ抽選
      cpuProfiles: {                                                                                                      // reaction＝球の情報の遅れ（秒）／speed＝ラケットの最高速／timingError＝打つタイミングのズレ（秒）／aimError＝ねらいのズレ／moveError＝予想位置のズレ／mistakeChance＝ミスの確率／aggression＝左右にふる確率／smashChance＝甘い球を 強打する確率／reach＝ラケットが とどくはば
        1: { reaction: 0.21, speed: 108, timingError: 0.068, aimError: 10, moveError: 6.5, mistakeChance: 0.07, aggression: 0.12, smashChance: 0.04, smashReturn: 0.1, reach: 11 },
        2: { reaction: 0.17, speed: 124, timingError: 0.058, aimError: 7.5, moveError: 5, mistakeChance: 0.045, aggression: 0.32, smashChance: 0.1, smashReturn: 0.25, reach: 11.5 },
        3: { reaction: 0.14, speed: 150, timingError: 0.05, aimError: 6, moveError: 4, mistakeChance: 0.045, aggression: 0.55, smashChance: 0.28, smashReturn: 0.48, reach: 11.5 },
        4: { reaction: 0.115, speed: 172, timingError: 0.046, aimError: 5, moveError: 3.5, mistakeChance: 0.038, aggression: 0.68, smashChance: 0.38, smashReturn: 0.62, reach: 12 },
        5: { reaction: 0.1, speed: 190, timingError: 0.042, aimError: 4.5, moveError: 3.2, mistakeChance: 0.032, aggression: 0.8, smashChance: 0.5, smashReturn: 0.78, reach: 12 }
      },
      botProfile: { reaction: 0.14, speed: 300, moveError: 5, wideChance: 0.5 }                                              // テスト専用：プレイヤーの代わりに ラケットを動かす、ふつうの腕前のボット（ゲームでは 使わない）
    },

    // ---- JEWEL CHAIN（7F・落ちものパズル）。数字は仮値です。遊びながら調整してください ----
    seaAttack: {
      price: 100, cols: 5, rows: 5, lives: 3, shotMode: 'manual', maxBullets: 3, pbulletSpeed: 260, playerSpeed: 95, autoInterval: 0.25,   // 1PLAY料金／敵の列・行／残機／SHOT方式（manual＝1タップ1発・auto＝長押しで連射）／自弾の同時数・速度／自機の速さ／auto時の間隔
      baseStep: 0.85, minStep: 0.07, minWaveBase: 0.5, waveStepUp: 0.04, stepDx: 3, stepDown: 6, invuln: 1.8,                              // 隊列の1歩の間隔（秒・WAVE1）／最後の1匹の間隔／WAVEが進んでも これ以下には ならない／WAVEごとの短縮／横の歩幅／下降量／復帰後の無敵（秒）
      fire: { base: 2.1, min: 0.5, perWave: 0.1 }, ebullet: { base: 70, perWave: 4, max: 125 }, maxEb: { base: 2, max: 5 },              // 敵弾の間隔（秒）／敵弾の速さ（上限あり）／同時に出る敵弾の数
      shield: { count: 4, enabled: true, playerHits: true, repair: 'partial', repairRatio: 0.5, repairEvery: 3 },                          // 防壁：数／ダメージ有無／自弾も当たる／WAVEごとの回復（partial・full・none・every）
      gold: { minGap: 14, maxGap: 26, speed: 55, scores: [100, 150, 200, 300] },                                                           // 金色の魚：出る間隔（秒）／速さ／点数の候補
      score: { jelly: 30, squid: 20, crab: 10 }                                                                                            // 敵の点数
    },
    mystery: {
      // MYSTERY HOUSE（旧 HORROR HOUSE を改装中）：背景画像の上に 家具の透過PNGを重ねる一人称の探索。まだ「寝室→クローゼット」まで
      //   画像は assets/mystery/<部屋>/ に置く。画像サイズは 1064x1478 のまま（縮小・変形しない）。画面には縦横比を保って はめこむ
      //   layers：下から順に重ねる（z が小さいほど奥）／ x,y：画像上の位置のずれ（画像ピクセル）／ ph：画像がない時の仮表示 [x,y,w,h,色,ラベル]
      //   hits：タップ判定 rect=[x,y,w,h]（画像ピクセル）。DEV の「判定を表示」で緑の枠が出る。action：{zoom:'ズーム名'}
      //   zooms：アップ画面（全面画像）。扉の開き差分などは ここに足す
      playCost: 100, fadeTime: 0.22,
    fx: { dipTime: 0.15, dipAlpha: 0.85, textTime: 1.5 },      // 操作の暗転（秒・濃さ0〜1）と、操作テキストを出す秒数
      viewMode: 'panorama',                                       // 'panorama'＝360°を見回す試作／'walls'＝従来の3方向（西・東・南）。DEV の「360/3方向」でも切り替え
      rooms: {
        bedroom: {
          name: 'BEDROOM', dir: 'assets/mystery/bedroom/', size: [1064, 1478], start: 'west', wallOrder: ['west', 'east', 'south'],
          walls: {
            west: {
              label: 'WEST', bg: 'west_bg.webp',
              layers: [
                { id: 'painting', file: 'west_painting.webp', z: 10, x: 0, y: 0, ph: [555, 454, 338, 189, '#5a4a3a', 'PAINTING'] },
                { id: 'closet', file: 'west_closet.webp', z: 20, x: 0, y: 0, ph: [0, 317, 350, 843, '#4a2e1a', 'CLOSET'] },
                { id: 'bed', file: 'west_bed.webp', z: 30, x: 0, y: 0, ph: [0, 1254, 563, 224, '#6a2a3a', 'BED'] }
              ],
              hits: [{ id: 'closet', rect: [0, 317, 350, 843], action: { zoom: 'closetOpen' } }]
            },
            east: {
              label: 'EAST', bg: 'east_bg.webp',
              layers: [
                { id: 'window', file: 'east_window.webp', z: 10, x: 0, y: 0, ph: [227, 214, 593, 555, '#3a4a6a', 'WINDOW'] },
                { id: 'pendulum', file: 'east_pendulum.webp', z: 20, x: 0, y: 0, ph: [0, 239, 166, 453, '#4a2e1a', 'CLOCK'] },
                { id: 'bed', file: 'east_bed.webp', z: 30, x: 0, y: 0, ph: [513, 922, 551, 317, '#6a2a3a', 'BED'] }
              ],
              hits: []
            },
            south: {
              label: 'SOUTH', bg: 'south_bg.webp',
              layers: [
                { id: 'mirror', file: 'south_mirror.webp', z: 10, x: 0, y: 0, ph: [616, 273, 341, 769, '#4a5a6a', 'MIRROR'] },
                { id: 'closet', file: 'south_closet.webp', z: 20, x: 0, y: 0, ph: [963, 313, 101, 861, '#4a2e1a', 'CLOSET'] },
                { id: 'bed', file: 'south_bed.webp', z: 30, x: 0, y: 0, ph: [0, 818, 294, 567, '#6a2a3a', 'BED'] },
                { id: 'sidetable', file: 'south_sidetable.webp', z: 40, x: 0, y: 0, ph: [343, 914, 232, 228, '#4a2e1a', 'TABLE'] },
                { id: 'lamp', file: 'south_lamp.webp', z: 50, x: 0, y: 0, ph: [358, 754, 107, 185, '#8a7a4a', 'LAMP'] },
                { id: 'clock', file: 'south_clock.webp', z: 60, x: 0, y: 0, ph: [463, 817, 103, 123, '#6a5a3a', 'CLOCK'] }
              ],
              hits: []
            }
          },
          // 360°パノラマ（Equirect＝2:1の正距円筒図法PNG）。画像の中心が yaw=0 の正面。無い時は 向きの確認用テスト画像が出る
          //   fov：たての視野角（度）。小さいほどズーム／yaw0・pitch0：最初に向く方向（度。yawは右が＋）／pitchMin・pitchMax：上下に見られる範囲（度）
          //   sens：スワイプの感度（1＝指の動きと景色が1:1）／pitchSens：上下の感度／quality：描画の細かさ（1＝画面の論理解像度 ×1.5 ぐらい。重い時は下げる）
          panorama: { file: 'panorama.jpg', fov: 75, yaw0: 0, pitch0: 0, pitchMin: -35, pitchMax: 35, sens: 1, pitchSens: 0.7, quality: 1.5, maxSrcW: 4096, layers: [], tapW: 2000, tapH: 1000, taps: [{ id: 'closet', action: { zoom: 'closet' }, poly: [[1196, 458], [1235, 432], [1320, 426], [1400, 440], [1408, 560], [1402, 712], [1372, 752], [1212, 738], [1204, 690]] }, { id: 'bed', action: { zoom: 'bedClose' }, poly: [[755, 548], [895, 552], [897, 660], [860, 742], [830, 770], [700, 810], [500, 832], [300, 835], [228, 828], [238, 715], [385, 620], [660, 640], [752, 600]] }], marks: [{ id: 'windowCircle', lon: -82.8, lat: 16.2, r: 4, color: '#fff2b0' }], pixel: { level: 2, scan: 0.3, levels: [{ name: 'なめらか', k: 0 }, { name: '細かい', k: 2 }, { name: 'ふつう', k: 3 }, { name: 'あらい', k: 4 }, { name: 'ごく粗い', k: 6 }] } },
          zooms: { bedClose: { file: 'bed_close.jpg', label: 'BED', ph: 'BED CLOSE', keepState: false, dipTime: 0, cover: true, anchorY: 0.85, flags: ['pillow', 'blanket'], states: { normal: 'bed_close.jpg', pillow: 'bed_close_pillow.jpg', blanket: 'bed_close_blanket.jpg', 'pillow+blanket': 'bed_close_both.jpg' }, hits: [
            { id: 'pillow', flag: 'pillow', say: '枕をどかした。', polys: { normal: [[318, 570], [810, 688], [578, 922], [44, 742]], blanket: [[241, 589], [809, 690], [578, 920], [56, 736]] } },
            { id: 'blanket', flag: 'blanket', say: '掛け布団をめくった。', polys: { normal: [[0, 745], [380, 880], [700, 1100], [765, 1430], [600, 1490], [500, 1647], [0, 1647]], pillow: [[9, 760], [386, 895], [704, 1101], [758, 1479], [610, 1546], [513, 1647], [19, 1647]] } }] },
          closet: { file: 'closet_close.jpg', label: 'CLOSET', ph: 'CLOSET', keepState: false, cover: true, anchorY: 0.85, flags: ['open'], states: { normal: 'closet_close.jpg', open: 'closet_open.jpg' }, toggle: { flag: 'open', label: '閉める', say: 'クローゼットを閉めた。' }, hits: [
            { id: 'handle', flag: 'open', say: 'クローゼットを開けた。', polys: { normal: [[430, 700], [610, 700], [610, 920], [430, 920]] } }] },
          closetOpen: { file: 'west_closet_open.webp', wall: 'west', label: 'CLOSET', ph: 'CLOSET OPEN' } }
        }
      }
    },
    horror: {
      // HORROR HOUSE：洋館を進む短編ホラー。¥100。戦わない。数値・イベントはここで調整（部屋ごとの eventPool は [イベント, 重さ]）
      playCost: 100, targetPlayTime: [150, 210],                 // 1PLAY の料金／めやすの プレイ時間（秒）
      fakeEventRate: 0.16, rareScareRate: 0.08,                  // フェイク音の割合／クローゼットの レアイベント（寝室）の確率
      hideTimingWindow: 0.9, entityMoveSpeed: 1, hideMin: 4.5,   // 足音のあと 隠れられる ゆうよ（秒）／足音の速さ倍率／何もない時に隠れたとき 出られるまで（秒）
      steps: { woman: { n: 6, gap: 0.95 }, doll: { n: 9, gap: 0.45 }, man: { n: 4, gap: 1.8 }, boy: { n: 6, gap: 0.9 } },   // 足音の数と間隔（つかまえに来るまで）
      eventDwell: [5.5, 10],                                    // 部屋に入ってから 何かが 起きるまで（秒）
      pools: {
        corrA: [['none', 3], ['corrMan', 2], ['corrBoy', 2], ['corrWoman', 1.5], ['fake', 1]],
        corrB: [['none', 2], ['corrMan', 2], ['corrBoy', 2], ['corrWoman', 2.5], ['fake', 1]],
        corrC: [['none', 2], ['corrMan', 1.5], ['corrWoman', 2], ['corrDoll', 2], ['fake', 1]],
        study: [['none', 2], ['hideWoman', 4], ['hideMan', 1.5], ['hideBoy', 1], ['fake', 1.5]],
        dining: [['none', 2], ['hideWoman', 3.5], ['hideMan', 2], ['hideDoll', 1.5], ['fake', 1.5]],
        bedroom: [['none', 1.5], ['hideWoman', 5], ['hideBoy', 1.5], ['hideMan', 1]],
        doll: [['dollScript', 1]], hall: [['none', 1]], back: [['none', 1]]
      }
    },
    hyakki: {
      // 百鬼夜行（HYAKKI YAKO）：霊銃のレールシューティング。¥100・LIFE・6発マガジン。数値はここで調整
      playCost: 100, maxLife: 3, magazineSize: 6, reloadTime: 0.75, hitPad: 3, phaseTransitionTime: 1.4,
      enemy: {
        hitotsume: { hp: 1, atk: 2.6, h: 62, sc: 100 }, karakasa: { hp: 1, atk: 4.2, h: 70, sc: 100 }, chochin: { hp: 1, atk: 4.2, h: 46, sc: 150 }, neko: { hp: 1, atk: 0, h: 58, sc: 500 },
        kappa: { hp: 2, atk: 3.8, h: 64, sc: 200 }, rokuro: { hp: 1, atk: 4.4, h: 46, sc: 250 }, nurikabe: { hp: 5, atk: 6.5, h: 120, sc: 300 },
        tengu: { hp: 2, atk: 3.6, h: 76, sc: 300 }, kitsune: { hp: 2, atk: 5.2, h: 58, sc: 300 }, oni: { hp: 6, atk: 3.4, h: 112, sc: 500 }
      },
      weakBonus: 100, comboEvery: 5, comboBonus: 100, bossClearBonus: 3000, mouthOneMagBonus: 1000,
      rank: { S: 18000, A: 14000, B: 9000, C: 5000 }, stepGapAdd: 0.6,
      oniFlinchHits: 2, oniWalk: 3.0, oniRaise: 1.8,
      gashadokuro: { clawCount: 5, clawHP: 1, clawAttackDelay: 12, eyeHP: 3, eyeAttackDelay: 8, mouthHP: 10, mouthAttackDelay: 11, weakPointHitboxScale: 1.15, clawWheelSpeed: 3.2, eyeShakeAmp: 26, eyeShakeFreq: 16, miniDelay: 3, miniHP: 3, miniSpread: 135, miniFreq: 2.6, clawScore: 200, eyeScore: 500, mouthScore: 150 },
      // 出現パターン：[種類, x(0〜1), 足元y, 遅れ秒]。stage ごとに steps を順番に。gap＝全部かたづいたあとの間
      stages: [
        { id: 'machi', no: 'STAGE 1', steps: [
          { s: [['hitotsume', .5, 292, 0]], gap: .5 }, { s: [['hitotsume', .25, 288, 0], ['hitotsume', .75, 290, .5]], gap: .4 }, { s: [['karakasa', .5, 300, 0]], gap: .4 },
          { s: [['chochin', .5, 175, 0]], gap: .4 }, { s: [['neko', .5, 215, 0], ['hitotsume', .3, 290, .6]], gap: .3 }, { s: [['karakasa', .3, 300, 0], ['chochin', .72, 160, .7]], gap: .4 },
          { s: [['hitotsume', .2, 290, 0], ['hitotsume', .5, 295, .5], ['hitotsume', .8, 290, 1]], gap: .4 }, { s: [['neko', .5, 200, 0], ['karakasa', .6, 300, .5]], gap: .4 }, { s: [['chochin', .3, 150, 0], ['chochin', .72, 185, .4], ['hitotsume', .5, 295, .9]], gap: .6 } ] },
        { id: 'kawabe', no: 'STAGE 2', steps: [
          { s: [['kappa', .5, 300, 0]], gap: .4 }, { s: [['hitotsume', .3, 290, 0], ['karakasa', .7, 300, .6]], gap: .4 }, { s: [['rokuro', .5, 250, 0]], gap: .4 },
          { s: [['nurikabe', .5, 318, 0]], gap: .5 }, { s: [['kappa', .28, 295, 0], ['kappa', .74, 300, .7]], gap: .4 }, { s: [['rokuro', .35, 250, 0], ['hitotsume', .75, 290, .8]], gap: .4 },
          { s: [['nurikabe', .5, 318, 0], ['karakasa', .25, 300, 2]], gap: .5 }, { s: [['kappa', .3, 295, 0], ['rokuro', .7, 250, .8]], gap: .6 } ] },
        { id: 'yama', no: 'STAGE 3', steps: [
          { s: [['chochin', .3, 150, 0], ['chochin', .72, 175, .5]], gap: .4 }, { s: [['neko', .5, 205, 0], ['tengu', .5, 210, .6]], gap: .4 }, { s: [['kitsune', .5, 290, 0]], gap: .5 },
          { s: [['tengu', .3, 190, 0], ['chochin', .72, 160, .6]], gap: .4 }, { s: [['kitsune', .5, 290, 0]], gap: .5 }, { s: [['oni', .5, 320, 0]], gap: .6 },
          { s: [['tengu', .7, 200, 0], ['neko', .5, 200, .5]], gap: .4 }, { s: [['oni', .5, 320, 0]], gap: .6 } ] },
        { id: 'final', no: 'FINAL', steps: [
          { s: [['hitotsume', .25, 292, 0], ['karakasa', .7, 300, .5]], gap: .3 }, { s: [['chochin', .5, 160, 0], ['kappa', .3, 300, .6]], gap: .3 }, { s: [['tengu', .5, 200, 0], ['hitotsume', .78, 290, .5]], gap: .3 },
          { s: [['rokuro', .5, 250, 0], ['chochin', .25, 150, .5]], gap: .3 }, { s: [['kitsune', .5, 290, 0], ['neko', .5, 205, 1]], gap: .3 }, { s: [['karakasa', .3, 300, 0], ['tengu', .72, 200, .5], ['hitotsume', .5, 292, 1]], gap: .6 } ] }
      ]
    },
    goRocket: {
      // GO! GO! ROCKET：連打→飛距離。連打数(POWER)→距離は distanceCurve（[POWER, km] を対数で なめらかに つなぐ）。ランクは rankThresholds（POWER）
      playCost: 100, tapDuration: 10, readyText: 1.1, countStep: 0.6, stopTime: 0.55, launchAnimationTime: 0.8,
      flightAnimationTime: { min: 6, max: 10 },
      rankThresholds: { C: 40, B: 60, A: 85, S: 100, SS: 110 },
      distanceCurve: [[0, 0.004], [8, 0.03], [20, 2], [40, 12], [60, 100], [85, 384400], [100, 78000000], [110, 9460000000000], [135, 3.0e19]],
      tapFeedbackStrength: 1, rocketShakeStrength: 1, smokeAmount: 1, tapMinGap: 0.02, gaugeMax: 130
    },
    ghostRush: {
      price: 100, gameTime: 45, rushAt: 20, readyTime: 1.0, goTime: 0.6, timeUpTime: 1.6,                                                // 1PLAY料金／制限時間（秒）／GHOST RUSH が始まる残り秒／READY・GO!・TIME UP の長さ
      score: { normal: 100, gold: 500, big: 1000 }, comboBonuses: { 5: 100, 10: 300, 20: 500 },                                         // 点数／COMBO ボーナス（コンボ数: 点）
      earlySpawnInterval: [0.85, 1.3], lateSpawnInterval: [0.26, 0.48], earlyMaxEnemies: 3, lateMaxEnemies: 8, rushLifeMul: 0.75, tapGrace: 0.5,                           // 出現の間隔（秒・最小〜最大）／同時に出る数
      goldSpawnRate: 0.03, goldSpawnRateLate: 0.055, bigSpawnRate: 0.17, bigMax: 4, bigGap: 5.5, bigGhostHP: 3,                          // GOLD の出る確率（前半・後半）／BIG の出る確率（残り30秒から）／1プレイの最大数／BIG どうしの最小間隔（秒）／BIG のタップ回数
      pumpkinRate: 0.12, pumpkinRateLate: 0.22, pumpkinPenalty: 300,                                                                      // ラッシュ中：通常・GOLD・カボチャの出ている時間にかける倍率（小さいほど すぐ消える）／倒した直後に同じ場所を連打しても ミスにしない時間（秒）
      // ダミーのカボチャ：出る確率（前半・後半）／タップしたときの減点（スコアは0より下がらない。COMBOも切れる）
      life: { normal: [1.7, 2.3], gold: [1.2, 1.2], big: [3.6, 3.6], pumpkin: [1.6, 2.1] },                                                                   // 出ている時間（秒）。GOLD は短め
      size: { normal: { w: 45, h: 47 }, gold: { w: 44, h: 47 }, big: { w: 74, h: 94 }, pumpkin: { w: 40, h: 40 } }, hitPad: 4                                       // 見た目の大きさ（論理px。BIG は ふつうの約2倍）／タップ判定の ゆとり（px）
    },
    nineBreak: {
      price: 100, r: 6, felt: { w: 128, h: 228, y: 49, rail: 9 }, footY: 0.30, headY: 0.74,                                        // 1PLAY料金／玉の半径／フェルトの大きさ・位置／ラックの先頭位置（上から割合）／手玉の初期位置
      power: { speed: 0.6, min: 0.03 },                                                                                             // POWERゲージの往復の速さ（往復/秒。0→100→0 で1往復）／ゲージ0のときの最小POWER
      vmax: 420, vmin: 45, powerCurve: 1.2,                                                                                         // 最大・最小の初速（px/s）／POWER→初速のカーブ（大きいほど弱いほうが細かい）
      roll: 40, drag: 0.3, vStop: 3,                                                                                                // 転がり抵抗：一定ぶん（px/s²）＋速さに比例ぶん（1/s）。高速はよく減速し、低速はゆっくり止まる／停止速度（px/s）
      eBall: 0.95, eWall: 0.8, eWallFast: 0.6, wallMu: 0.15, wallStick: 0.3,                                                                        // 玉どうしの反発／クッション反発（遅い球）／クッション反発（最高速の球）／クッションの接線摩擦の上限（係数）と、横すべりを止める割合
      pocket: {
        cornerCap: 9, sideCap: 7.5, cOut: 2, sOut: 3,                                                                               // ポケットの落ちる半径（コーナー・サイド）／ポケット中心の外へのずれ
        cornerGap: 17, sideGap: 11, jawR: 1.3, eJaw: 0.55, eJawFast: 0.8,                                                           // 口の広さ（jawの先端がカドから離れる距離。サイドは中央から）／jawの先端の丸み／jawの反発（遅い・速い）
        assistR: 1.12, slowV: 40,                                                                                                   // ポケット吸い込み補助：半径の倍率（1.0で無効）／これより遅い球だけ（ほぼ無効）
        entryMin: 0.25, entryFast: 0.5, slowSp: 70, eBack: 0.45,                                                                    // 進入角度：ポケットへ向かう成分がこれ未満だとjawに蹴られて戻る（遅い球）／最高速で さらに必要な量／これより遅い球は角度を問わない／蹴られた反発
        fastShrink: 0.3, fastV: 200, jawFastR: 2.2                                                                                                 // 強い球ほど、落ちる円が小さくなる割合／強い球とみなす速さ／強い球ほど jaw が大きく当たる分（px）= 強い球のポケット許容度
      },
      spin: { maxR: 0.85, follow: 0.6, draw: 0.85, sideV: 300, tauV: 0.25, tauS: 0.5, sideKeep: 0.5 },                                  // 撞点：選べる範囲（手玉の半径に対する割合）／押し球・引き球が的球の衝突後に足す量（衝突直前の速さに対する割合）／横回転の強さ（px/s）／時間とともに回転が弱まる速さ（縦・横）／クッション後に残る横回転の割合
      step: 240, maxShotTime: 25, maxStepsPerFrame: 16,                                                                             // 物理の細かい刻み（回/秒）／1ショットの安全上限（秒）／1フレームの最大ステップ
      aim: { slow: 6, fast: 30, orbitGain: 0.6, minRadius: 60 },                                                                    // ◀▶ボタンの角速度（度/秒）／ドラッグ感度／ドラッグ感度の最小半径
      lucky: 4, bannerTime: 1.0, clearTime: 2.0, guideLen: 12, guideCue: 7                                                          // 9番でクリアしたとき、まだ これ以上残っていれば LUCKY 9!／バナー時間／ガイド：的球の短線／手玉の短線の長さ
    },
    bullDarts: {
      price: 100, numbers: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],                                  // 1PLAY料金／ボードの数字の並び（本物と同じ・上から時計回り）
      ring: { bullIn: 6, bullOut: 13, tripIn: 44, tripOut: 54, dblIn: 66, dblOut: 76 }, numR: 88, stickR: 3, zoneY: 250,                // 各リングの半径（論理px）／数字の位置／刺さった矢の太さ／なげる範囲の上端
      countUpRounds: 8, safetyRounds: 40, flyTime: 0.22, landTime: 0.8, roundTime: 1.1,                                               // COUNT-UPのラウンド数／301の安全上限／飛ぶ時間／刺さり表示／ラウンド切替（秒）
      assist: 0.5, jitter: 1.0,                                                                                                       // 入力補正の強さ（0〜1）／ぶれ（px）
      flick: { minDist: 24, window: 90, ahead: 126, dirBlend: 0.6, wobbleDead: 6, wobbleSens: 0.5, vIdeal: 700, vSoft: 350, vHard: 1400, speedGain: 6, weakDrop: 14, strongLift: 14, aheadSpeed: 0.3 }   // フリック判定：最小距離／速度を見る時間(ms)／先の距離／方向補正／ふらつき／理想速度ほか
    },
    blockCrash: {
      price: 100, cols: 8, blockH: 9, ballR: 3, startBalls: 3, maxBalls: 3,                 // 1PLAYの料金／ブロックの列数・高さ／ボールの半径／最初のBALL数／MULTIの同時ボール数
      paddleW: 36, wideMul: 1.7, wideTime: 10, powerTime: 7, slowTime: 8, slowMul: 0.7,     // パドル幅／WIDE倍率・時間／POWER時間／SLOW時間・倍率
      maxSpeed: 260, maxBounceAngle: 1.05, paddleLenient: 4, followRate: 38,                // ボール最高速（px/秒）／パドルの打ち返し最大角（rad）／パドル当たり判定のおまけ（px）／指への追従の速さ
      minVertical: 0.3, minHorizontal: 0.06, itemFall: 55, comboWindow: 0.8,                // 水平すぎ防止／垂直すぎ防止／アイテムの落下速度／連続破壊の受付（秒）
      assistRemain: 4, assistAfter: 4, assistRate: 0.7,                                    // 残りブロック数以下で、何秒あたらないと 軌道補正するか／補正の強さ（rad/秒・ごく弱い）
      stallAfter: 12, stallMax: 0.3, stallRate: 0.02, stallRecover: 0.15,                   // 停滞対策：何秒 壊れないと じわじわ 速くするか／最大加速／増える・もどる速さ
      itemWeights: { WIDE: 30, SLOW: 28, BONUS: 20, MULTI: 12, POWER: 10 },                 // アイテムの出やすさ
      score: { normal: 100, hardHit: 50, hardBreak: 150, steelPower: 200, item: 50, bonus: 1000, combo: 10, stageClear: 1000, ballLeft: 500, allClear: 5000 },   // 点数
      stages: [
        { stageId: 1, name: 'BASIC', baseBallSpeed: 170, layout: ['nnnnnnnn', 'nninnnin', 'nnnnnnnn', 'nnnhhnnn', 'nnnnnnnn'] },
        { stageId: 2, name: 'WALL', baseBallSpeed: 180, layout: ['hnnnnnnh', 'nn.nn.nn', 'nn.ii.nn', 'hn.nn.nh', 'nn.nn.nn'] },
        { stageId: 3, name: 'STEEL', baseBallSpeed: 190, layout: ['nnnnnnnn', 'nnhnnhnn', 'nssinssn', 'nnnhhnnn', 'ninnnnin'] },
        { stageId: 4, name: 'SPLIT', baseBallSpeed: 200, layout: ['hhn..nhh', 'hnn..nnh', 'hni..inh', 'hnn..nnh', 'hhn..nhh'] },
        { stageId: 5, name: 'FINAL', baseBallSpeed: 210, layout: ['snhhhhns', 'nnnnnnnn', 'hninninh', 'nhnssnhn', 'nnhnnhnn', 'snnhhnns', 'hnninnnh'] }
      ]
    },
    jewelChain: {
      price: 100, boardW: 6, boardH: 12, colors: 5, clearCount: 3,                          // 1PLAYの料金／盤面の幅・高さ（BOARD_WIDTH・BOARD_HEIGHT）／宝石の色数（COLOR_COUNT）／消える個数（CLEAR_COUNT）
      soloTime: 300, vsSafety: 600,                                                          // ひとりモードの時間（秒）／対戦の見えない安全タイマー（秒。時間切れは 危険度→スコア→消した数で判定、同じなら引き分け）
      fall: { soloStart: 1.5, soloEnd: 3.6, soloCurve: 1.2, vsStart: 1.7, vsEnd: 3.0, vsRampSec: 300, fast: 22 },   // 落下の速さ（段/秒・FALL_SPEED）：ひとりは 0:00→5:00で soloStart→soloEnd へ（カーブ）／対戦は 5分で vsStart→vsEnd／下スワイプ中の速さ（FAST_FALL_SPEED）
      lockDelay: 0.5, lockDelayFast: 0.12, maxLockResets: 15,                                // 固定猶予（秒・LOCK_DELAY）／下スワイプ中の猶予／猶予のやり直しの上限（ずっと動かして 固定させない 対策）
      input: { dragThreshold: 15, swipeThreshold: 26, tapMax: 10, tapTime: 0.35 },          // 左右ドラッグ：何px動かすと1マス（DRAG_THRESHOLD）／下スワイプと見なす きょり（SWIPE_THRESHOLD）／タップと見なす 動きの上限（px）・時間（秒）
      score: { perJewel: 100, chainPower: [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256], groupBonus: [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 10] },   // 点：消した数×perJewel×倍率。倍率＝max(1, 連鎖の倍率＋大きな同時消しボーナス)。連鎖が 大きく勝つ
      garbage: { table: [0, 0, 1, 3, 6, 10, 15, 21], step: 6, maxDrop: 12, bigClear: [{ min: 6, add: 1 }, { min: 9, add: 2 }] },   // お邪魔石（GARBAGE_TABLE）：連鎖数→合計の数（1連鎖=0／2=1／3=3／4=6…／8連鎖以上は 前の段階＋6ずつ）／1回に降る上限（MAX_GARBAGE_DROP）／大きな同時消しの ちいさなおまけ
      pinchHeight: 9, anim: { flash: 0.3, fall: 0.15, garbageFall: 0.26, spawnDelay: 0.14, gap: 0.05 },   // ピンチになる高さ（段・PINCH_HEIGHT）／アニメの時間（秒）
      cpu: {                                                                                  // CPU：think＝置くまでの考える時間／actionDelay＝1操作ごとの間／errorRate＝最善でない手を選ぶ確率／topN＝上位いくつから選ぶか／plan＝連鎖の可能性を見る（0〜2）／look＝NEXTを使った先読み／softDrop＝高速落下を使う
        easy:   { think: 0.85, actionDelay: 0.2, errorRate: 0.38, topN: 5, plan: 0, look: 0, softDrop: false, adjW: 0.8, heightW: 0.8, attackW: 20, planW: 0, dangerSense: 0.3 },
        normal: { think: 0.5, actionDelay: 0.13, errorRate: 0.12, topN: 3, plan: 1, look: 0, softDrop: true, adjW: 4, heightW: 1.3, attackW: 40, planW: 70, dangerSense: 0.8 },
        hard:   { think: 0.28, actionDelay: 0.085, errorRate: 0.04, topN: 2, plan: 2, look: 1, softDrop: true, adjW: 5, heightW: 1.6, attackW: 60, planW: 140, dangerSense: 1.0 }
      }
    },

    // ---- 全館ワイド化 ----
    //   true ＝ 画面（キャンバス）の幅を、スマホの横幅の約94%まで広げる（拡大率は、そのまま）。false にすると、これまでの細い画面へ戻ります
    wide: { enabled: true },
    piyoWideTune: { pocketHalf: 1, lostW: 1, jitter: 2.3 },   // ワイド化の補正（旧版と同じ入りやすさ・❌の落ちやすさに合わせる）：1＝盤面と同じ割合で広げる／0＝広げない（旧幅のまま）。計測して決めた値
    piyoWide: true,              // ピヨちゃん：盤面・CRT・プッシャーそのものを、広い画面に合わせる（false で、これまでの幅の配置＋左右の飾りへ戻る）

    // ---- 店長のおすすめ！ ----
    //   何度か遊ぶと、特定の筐体に「店長のおすすめ！」の張り紙が付きます。次に1回その台を遊ぶと、払い出しがUP（負けても罰はなし）
    recommend: {
      enabled: true,
      maxPerDay: 3,               // 1DAYに出る回数
      interval: [5, 10],          // 次のおすすめが出るまでのプレイ回数（ランダム）
      newBias: 3,                 // まだ遊んでいない台の、選ばれやすさ（1＝同じ）
      bonusMul: 1.5,              // 払い出しの倍率（仮）。払い出しが1枚以上のときだけ、増えた分（切り上げ）が加わります
      piyoBonus: 3                // ピヨちゃんは、コインを入れたら +3メダル
    },

    // ---- ゲームセンター（ゲーム全体） ----
    arcade: {
      startMoney: 700,         // はじめの所持金（DAY 1 のおこづかいと同じ）
      dailyAllowance: 700,     // 毎日もらえる おこづかい（前日の残金に足す）。¥500セットは買えるが、¥1000セットには届かない
      exchange: [              // メダル貸出機の交換レート
        { yen: 100, medals: 10 },
        { yen: 500, medals: 55 },
        { yen: 1000, medals: 120 }
      ],
      leaveRequires: { bought: true, played: true },   // 「今日は帰る」に必要なこと（無限貯金の防止）
      saveKey: 'kyoumo_geesen_save',
      autosaveEvery: 5,        // 自動保存の間隔（秒）
      zoomTime: 0.6            // 筐体に座る・立つときのズーム（秒）
    },

    // ---- ゲーム全体 ----
    game: {
      restartCoins: 50,      // 再スタートしたときのメダル
      aidAmount: 10,         // 「おたすけメダル」の枚数
      aidPerWorld: 1,        // おたすけメダルを使える回数（無限救済にはしない）
      zeroWait: 8            // メダル0枚で、最後のWINからこの秒数たったら「もうWINは来ない」とみなす
    },

    // ---- 冒険（通常時） ----
    adventure: {
      // 試遊用のテンポ改善：true ＝ 通常時は、ポケットに入った時点で、すぐに HUNT／EXPLORE／TREASURE が起きる（ゲージ蓄積なし・ゲージ表示なし）
      //   false にすると、従来のゲージ方式（CONFIG.gauges の回数ためてから発生）に戻ります
      sugoroku: true,          // true ＝ すごろく版（50マス）／ false ＝ RPG版（HP・ATK・LV・ゲージ）
      instantEvents: true,
      area: 'forest',          // いまのエリア（AREAS の名前）
      reactTime: 0.9,          // 通常入賞のときのピヨちゃんのリアクション（秒）
      introTime: 2.2,          // HUNT! などの導入の演出（秒）
      exploreTime: 3.2,        // EXPLORE の発見演出（秒）
      endTime: 2.4,            // 勝ち・負けを見せる時間（秒）
      nextEventDelay: 0.8,     // イベントが続くときの間（秒）
      idleEvery: [2.5, 5]      // ピヨちゃんの待ち時間アニメの間隔（秒）
    },

    // ---- すごろく版（WORLD 1）の調整用 ----
    sugoroku: {
      chanceTime: 10,             // CHANCE TIME の制限時間（秒）
      bossChance: 8,              // ボス戦の ATTACK／DEFENSE CHANCE の制限時間（秒）
      chanceBonus: [6, 10],       // CHANCE 成功の払い出し
      feverEnabled: false,        // FEVER を一旦なし（true にすると、宝箱・CHANCE 成功からの FEVER が復活します）
      feverChance: 0.1,           // CHANCE 成功のとき、FEVER になる確率（feverEnabled が true のとき）
      feverTime: 12,              // FEVER の時間（秒）
      feverPay: [1, 2],           // FEVER 中、ポケットに入るたびの払い出し
      feverCap: 30,               // FEVER 1回の払い出しの上限（これに届いたら、あとは払い出さない）
      worldClearPay: 30,          // WORLD CLEAR の払い出し（10枚ずつ分けて落とす）
      enemyChance: { time: 5, bigTime: 4, intro: 1.0, countdown: 1.5 },     // 敵のATTACK CHANCE：制限時間／BIG ATTACK CHANCE（💥・少し難しい）の制限時間／ルール説明の秒数／3,2,1の秒数
      // 共通の「チャンス」形式：制限時間のあいだに ⭐ へ need回 入れる。成功した回数（0 / 1 / 2）で、ごほうびの段階が変わる（失敗しても最低保証）
      chance2: { time: 6, need: 2, gap: 0.6, intro: 1.2, countdown: 2.1 },
      introTime: 2.4,             // 時間制限つき CHANCE の「イベント名 ＋ ルール説明」を見せる時間（秒）。そのあと 3,2,1,START！
      // ---- WORLD 1 の報酬（メダルが増えるイベントは嬉しいが、頻繁には起きない） ----
      rewards: {
        // ---- 共通チャンス（戦闘・宝箱・CHANCE TIME）の報酬：成功0回／1回／2回 ----
        battle: { normal: [1, 2, 5], strong: [1, 3, 8] },        // 敵を倒したときの払い出し（[0回, 1回, 2回]）。通常敵・強敵とも、チャンスのあと必ず撃破
        bossMid: { dmg: [0, 1, 3], pay: [1, 2, 3] },             // 中ボス：チャンス1回ごとの ダメージ／払い出し（HP0で撃破、撃破ボーナスは midBoss）
        bossDragon: { dmg: [0, 2, 4], pay: [0, 1, 2] },          // ドラゴン：同上（撃破は WORLD CLEAR）
        // 宝箱：⭐に入れた回数が 0回（通常宝箱）／1回（⭐宝箱）／2回（⭐⭐宝箱）の、払い出し（メダル）。小宝箱も大宝箱も同じ
        chestFixed: { small: [3, 5, 8], big: [3, 5, 8] },
        chestOne: 2, chestZero: 1, chestZeroBig: 2,              // 宝箱：1回成功＝小宝箱は2枚（大宝箱は小宝箱の表）／0回＝最低保証（小1枚・大2枚）。2回成功は chestSmall / chestBig の表
        chance: { one: 3, zero: 1 },                             // CHANCE TIME：1回成功／0回（2回成功は chanceBonus）
        luckySquares: [4, 12, 22, 32, 42],        // 🍀ラッキーマス：「もう1回！」（無料でもう一度サイコロ。その先がラッキーマスでも、続けては発動しない）
        blankLines: ['ピヨちゃんは辺りを見回した。', 'かぜが気持ちいい！', 'ちょうちょを見つけた！', 'お日様がぽかぽか……', 'どこかで鳥が鳴いている。', '……何もな勝った！'],      // 何もないマスの、一言イベント（報酬なし）
        medalSquares: {},                         // 止まるだけでもらえる固定メダルのマス（マス番号: 枚数）。いまは なし（例：{ 15: 3 }）
        battleNormal: [3, 3],                     // 通常敵（撃破）
        battleStrong: [2, 4],                     // 強敵
        midBoss: [5, 5],                          // 中ボス（撃破）
        door: 0,                                  // 森の扉・鍵つき扉（いまは報酬なし。[3, 5] のように入れれば復活）
        color: { 23: 0, 39: 0, 48: 0 },           // 色合わせ・城門・最終扉（いまは報酬なし）
        fire: 0,                                  // 炎イベント（いまは報酬なし）
        // 宝箱：[種類, 値, 重み]。medal＝その枚数／gold＝GOLD DICE／special＝特殊サイコロ／fever＝FEVER
        chestSmall: [['medal', 2, 40], ['medal', 4, 25], ['medal', 8, 6], ['gold', 0, 26], ['fever', 0, 3]],
        chestBig: [['medal', 5, 35], ['medal', 8, 25], ['medal', 15, 6], ['gold', 0, 14], ['special', 0, 14], ['fever', 0, 6]]
      }
    },

    // ---- ピヨちゃんの成長（PIYO_INITIAL_HP / LEVEL_*_TABLE） ----
    piyo: {
      initialHp: 10,
      initialAtk: 1,
      // LEVEL_EXP_TABLE：そのLVから次のLVまでに必要なEXP（LV1→2 が 5）
      expTable: [5, 10, 18, 30, 45, 65],
      // LEVEL_HP_TABLE / LEVEL_ATK_TABLE：LVごとの最大HPとATK（先頭が LV1）
      hpTable:  [10, 12, 14, 16, 18, 20, 22],
      atkTable: [1, 2, 2, 3, 3, 4, 4],
      // HEAL_AMOUNT：❤️の回復量（最大HPの割合、最低回復量）
      healRate: 0.3,
      healMin: 3,
      loseHp: 1                // 負けたあとのHP
    },

    // ---- 戦闘の演出 ----
    battle: {
      turnTime: 0.55,          // ピヨちゃんの行動 → 敵の行動 までの間（秒）
      enemyTime: 0.5           // 敵の行動を見せる時間（秒）
    },

    // ---- ゲージ（HUNT_GAUGE_MAX など） ----
    gauges: { hunt: 5, explore: 5, treasure: 5 },

    // ---- ポケットが変身する演出 ----
    pocketChange: { dark: 0.35, step: 0.14 },   // 一度暗くなる時間 → 1つずつ点灯する間隔

    payout: { interval: 0.07 },               // 払い出し1枚ごとの間隔（秒）


    // ---- コインプッシャー ----
    pusher: {
      left: 22, right: 158, top: 266, edge: 350,
      pushMin: 284, pushMax: 300, speed: 1.4,   // 押し板の動く範囲（差が押し出し量）と速さ
      initialFill: 0.97,     // 最初に敷き詰める割合
      initialStacked: 22,    // 最初から重なっているメダル
      initialOnPusher: 10,   // 最初からプッシャーの上にあるメダル
      lostWidth: 15          // PUSHER_LOST_WIDTH：手前の左右の ×ゾーンの幅（残りの真ん中が WIN ゾーン。以前は12）
    },

    // ---- プッシャー盤面のメダルの物理（落ちにくさの調整） ----
    pusherPhysics: {
      iterations: 1,         // 押し合いの計算回数（少ないほど、押す力が奥から手前へ伝わりにくい。以前は4）
      pairStiffness: 0.04,    // 重なったメダルを1回の計算で何割押し戻すか（小さいほど力が伝わりにくい。以前は0.25）
      staticFriction: 0.3,  // 静止摩擦：1フレームの動きがこれ（ピクセル）より小さいと、その場に止まる
      kineticFriction: 0.8, // 動摩擦：動き出したメダルの勢いが、1フレームで何割残るか（大きいほど崩れたときに滑る）
      stopSpeed: 0.04,       // この速さより遅くなったら止まる（また静止摩擦が効く）
      lateralSpread: 0.45,   // 押されたとき、前ではなく左右へ逃げる割合
      outwardDrift: 0.8,     // 押されたメダルが外側（左右の ×ゾーン側）へ流れる割合
      climbAt: 0.2,          // 重なりがメダルの直径のこの割合を超えると、後ろのメダルが前のメダルへ乗り上げる
      maxTopCoins: 120,       // 乗り上げたメダルの上限（多すぎると盤面が見づらくなるため）
      dropOver: 0.8,         // 崖からメダルの半径のこの割合まで越えたら落ちる（大きいほど落ちにくい）
      pusherStiffness: 1     // 押し板がメダルを押す強さ（1＝めりこませない）
    }
  };

  // =====================================================================
  //  ポケットの役割（アイコンと色）
  //  ポケットそのものと効果を分けて、状態ごとに役割を差し替えます
  // =====================================================================
  const ROLES = {
    // 通常時（冒険のコントローラー）
    hunt:     { icon: 'sword',    color: '#c8d0f0', gauge: 'hunt' },
    explore:  { icon: 'map',      color: '#7dd0ff', gauge: 'explore' },
    treasure: { icon: 'bag',      color: '#ffd040', gauge: 'treasure' },
    event:    { icon: 'question', color: '#ff8ef0' },
    // 戦闘
    attack:   { icon: 'sword',    color: '#c8d0f0' },
    power:    { icon: 'burst',    color: '#ff9a30' },
    heal:     { icon: 'heart',    color: '#ff6080' },
    critical: { icon: 'star',     color: '#ffd040' },
    // 宝箱
    empty:    { icon: 'miss',     color: '#8a80b8' },
    atkUp:    { icon: 'sword',    color: '#c8d0f0' },
    medal:    { icon: 'bag',      color: '#ffd040' },
    fullHeal: { icon: 'heart',    color: '#ff6080' },
    // すごろく版
    dice:     { icon: 'dice',     color: '#fff8d8' },
    skull:    { icon: 'skull',    color: '#c8d0f0' },
    key:      { icon: 'key',      color: '#ffd040' },
    leaf:     { icon: 'leaf',     color: '#5ce870' },
    water:    { icon: 'water',    color: '#5ca8ff' },
    fire:     { icon: 'fire',     color: '#ff6030' },
    shield:   { icon: 'shield',   color: '#5ca8ff' },
    // 予備
    ring:     { icon: 'ring',     color: '#8a80b8' },
    red:      { icon: 'orb',      color: '#ff4060' },
    blue:     { icon: 'orb',      color: '#5ca8ff' },
    yellow:   { icon: 'orb',      color: '#ffd040' },
    green:    { icon: 'orb',      color: '#5ce870' }
  };

  const GAUGES = [
    { id: 'hunt',     label: 'HUNT',     icon: 'sword', color: '#e8ecff' },
    { id: 'explore',  label: 'EXPLORE',  icon: 'map',   color: '#7dd0ff' },
    { id: 'treasure', label: 'TREASURE', icon: 'bag',   color: '#ffd040' }
  ];

  // ---- 戦闘のポケット（4つの役割と効果） ----
  //   effect: attack（ATK×mul のダメージ）/ heal（回復）
  const BATTLE_POCKETS = {
    normal: ['attack', 'attack', 'power', 'heal'],
    boss:   ['attack', 'heal', 'power', 'critical']
  };
  const BATTLE_EFFECTS = {
    attack:   { type: 'attack', mul: 1 },
    power:    { type: 'attack', mul: 2 },
    critical: { type: 'attack', mul: 3 },
    heal:     { type: 'heal' }
  };

  // ---- モンスター（ENEMY_HP / ATK / EXP / REWARD / SPAWN_RATE） ----
  const MONSTERS = {
    slime:    { name: 'スライム', label: 'SLIME',    sprite: 'slime',    hp: 4,  atk: 1, exp: 2, reward: [3, 5],  rate: 50 },
    mushroom: { name: 'キノコ',   label: 'KINOKO', sprite: 'mushroom', hp: 7,  atk: 2, exp: 4, reward: [5, 8],  rate: 35 },
    wolf:     { name: 'オオカミ', label: 'WOLF',     sprite: 'wolf',     hp: 12, atk: 3, exp: 7, reward: [8, 12], rate: 15 }
  };

  // ---- エリアボス（BOSS_HP / ATK / REWARD） ----
  const BOSSES = {
    forestLord: {
      name: '森の主', label: 'FOREST LORD', sprite: 'treant', hp: 30, atk: 4, exp: 0,
      reward: [10, 10, 10, 10, 10]      // 10枚ずつ5回に分けて払い出し
    }
  };

  // ---- TREASURE CHANCE（TREASURE_REWARD）：1回入れたら結果が決まる ----
  const TREASURE = {
    pockets: ['empty', 'atkUp', 'medal', 'fullHeal'], shuffle: true,
    results: {
      empty:    { text: '空っぽだった……' },
      atkUp:    { text: '力のタネを見つけた！ ATK +1', atk: 1 },
      medal:    { text: 'メダルを見つけた！', medal: [10, 20] },
      fullHeal: { text: '薬草を見つけた！ HP 全回復！', fullHeal: true }
    }
  };

  // ---- ❓ のランダムイベント（EVENT_RATE。w は出やすさ％） ----
  const RANDOM_EVENTS = [
    { w: 30, text: '特に何もな勝った。' },
    { w: 20, text: '木の実を食べた！ HP 回復', healRate: 0.3 },
    { w: 15, text: 'モンスターの足跡を見つけた！ HUNT +1', gauge: 'hunt' },
    { w: 15, text: '古い地図を見つけた！ EXPLORE +1', gauge: 'explore' },
    { w: 10, text: '宝の匂いがする…… TREASURE +1', gauge: 'treasure' },
    { w: 5,  text: 'LUCKY！メダルを見つけた！', medal: [3, 5] },
    { w: 5,  text: '敵襲！モンスターが飛び出してきた！', battle: true }
  ];

  // ---- EXPLORE の段階（4回でボス発見） ----
  const EXPLORE_STEPS = [
    { text: '大きな足跡を見つけた……', sprite: 'track' },
    { text: '折れた大きな木を見つけた……', sprite: 'brokenTree' },
    { text: '森の奥から巨大な鳴き声が聞こえる……', sprite: 'roar' },
    { text: '巨大な巣を見つけた！ BOSS DISCOVERED!', sprite: 'nest', discover: true }
  ];

  // ---- エリア ----
  const AREAS = {
    forest: {
      name: '始まりの森', label: 'FOREST', theme: 'forest',
      normal: ['hunt', 'explore', 'treasure', 'event'],   // 通常時の4ポケット
      monsters: ['slime', 'mushroom', 'wolf'],
      boss: 'forestLord'
    }
    // 次のエリアは、ここに同じ形で追加できます
  };

  // =====================================================================
  //  基本の定数
  // =====================================================================
  let W = 180;                                                   // ゲームの配置の論理幅（通常は180。DUCK RACEだけ、画面いっぱいの配置）
  let CW = 180;                                                  // キャンバスの論理幅（ワイドのときは広がる。W より広いぶんは、左右を飾りで埋めて、ゲームは中央に置く）
  let WIDEW = 180;
  const H = 384;
  const R = 6;              // プッシャー盤面でのメダル半径（ピクセル）
  const D = R * 2;
  const STEP = 1 / 60;
  const STACK_H = 3;        // 重なったメダルの浮き上がり
  const LIFT = 2;           // プッシャーの上のメダルの浮き上がり
  const FACE = 3;           // プッシャー前面の厚み

  const FIELD = {
    left: CONFIG.pusher.left, right: CONFIG.pusher.right,
    top: CONFIG.pusher.top, edge: CONFIG.pusher.edge,
    pushMin: CONFIG.pusher.pushMin, pushMax: CONFIG.pusher.pushMax, speed: CONFIG.pusher.speed,
    front: 0, prevFront: 0
  };
  const PH = CONFIG.pusherPhysics;
  let LOST_W = CONFIG.pusher.lostWidth;
  const BOARD = CONFIG.board;
  const POCKETS = CONFIG.pockets;
  // ポケットの口の柱の位置（メダルの直径＋すき間ぶん空ける）
  POCKETS.half = BOARD.ballR + CONFIG.pins.radius + POCKETS.clearance;
  POCKETS.width = POCKETS.half * 2;
  const RAIL_Y = 41;                     // 投入レールの高さ
  const GUTTER_Y = 148;                  // 盤面の一番下（左右のシュートへ流れる）
  const CHUTES = [{ l: 22, r: 36 }, { l: 144, r: 158 }]; // 左右のシュート
  const TV = { x: 39, y: 149, w: 102, h: 105 };        // すごろくテレビ
  const SLOT_Y = 257;                    // 払い出し口（テレビの下）
  const TRAY_Y = FIELD.edge + 14;        // 獲得口

  // レトロな配色
  const C = {
    bg: '#0d0b1e',
    frame: '#2b1d4f',
    frameLight: '#4a3486',
    floorA: '#1b1f4a',
    floorB: '#22285c',
    boardA: '#1d2758',
    boardB: '#243068',
    wall: '#7a3fb0',
    wallLight: '#b77ae0',
    wallDark: '#3e1d66',
    pusher: '#6b6fa8',
    pusherLight: '#a5a9dd',
    pusherDark: '#3b3d6e',
    pin: '#e4e2f6',
    pinDark: '#5a5888',
    gold: '#f0b030',
    goldLight: '#ffe070',
    goldDark: '#b06a10',
    goldEdge: '#5a3008',
    white: '#fff8d8',
    pink: '#ff5ca8',
    cyan: '#5ce8ff',
    yellow: '#ffd040',
    green: '#7dff8a',
    black: '#05030c',
    text: '#fff4d0',
    dim: '#7d74a8',
    tvBody: '#c9bde6',
    tvLight: '#efe8ff',
    tvDark: '#7d6fa8',
    tvScreen: '#0e1c2a'
  };

  // ================= DOM =================
  const canvas = document.getElementById('game');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const screenEl = document.getElementById('screen');
  const stage = document.getElementById('stage');
  const retryBtn = document.getElementById('retry');
  const soundBtn = document.getElementById('sound');
  ctx.imageSmoothingEnabled = false;

  // ================= 状態 =================
  let coins = [];          // プッシャーの床の上のメダル
  let pusherCoins = [];    // プッシャーの上に乗っているメダル
  let balls = [];          // スマートボール盤面を落ちているメダル
  let falling = [];        // 移動中のメダル（シュート・払い出し・獲得口）
  let particles = [];
  let floaters = [];
  let orbs = [];           // ポケットからテレビへ飛ぶ光
  let won = 0;
  let time = 0;
  let lastActivity = 0;
  let lastInsertTime = -10;
  let gameOver = false;
  let gameOverTime = 0;
  let holding = false;
  let guideX = W / 2;
  let flash = 0;
  let sparkle = null;
  let sparkleTimer = 0;
  let payoutQueue = 0;
  let payoutTimer = 0;
  let lastPayoutT = 0;
  let frameCount = 0;
  let fever = 0;
  const stats = { inserted: 0, pocketed: 0 };

  const tv = { flash: 0 };   // テレビの光

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const px = (v) => Math.round(v);

  let lastPinSfx = -1;
  let lastPayoutSfx = -1;

  const sfx = {
    change(back) {                               // ポケットが変身する「デデン！」／戻る「ピカッ」
      if (back) { beep(1568, 0.35, 0.06, 0.04); beep(2093, 0.42, 0.12, 0.04); }
      else { beep(196, 0, 0.12, 0.06, 'square'); beep(147, 0.16, 0.22, 0.06, 'square'); }
    },
    ouch() { beep(300, 0, 0.1, 0.05, 'square', 160); noise(0.06, 0.04); },
    lose() { [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.18, 0.16, 0.05, 'triangle')); },
    levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.09, 0.1, 0.05)); },
    payoutBig() { beep(1047, 0, 0.05, 0.04); beep(1568, 0.05, 0.08, 0.04); },
    insert() { beep(660, 0, 0.04, 0.05); beep(990, 0.04, 0.05, 0.04); },
    pin() {
      if (time - lastPinSfx < 0.035) return;
      lastPinSfx = time;
      beep(rand(2400, 3200), 0, 0.015, 0.012, 'triangle');
    },
    land() {
      if (time - lastLandSfx < 0.05) return;
      lastLandSfx = time;
      noise(0.03, 0.05);
      beep(1760, 0, 0.02, 0.02);
    },
    pocket() {
      beep(784, 0, 0.06, 0.05);
      beep(1047, 0.06, 0.06, 0.05);
      beep(1319, 0.12, 0.06, 0.05);
      beep(1568, 0.18, 0.14, 0.045);
    },
    tv() { beep(1200, 0, 0.03, 0.04); beep(1800, 0.05, 0.03, 0.04); },
    hop() { beep(420, 0, 0.12, 0.05, 'square', 980); },
    payout() {
      if (time - lastPayoutSfx < 0.05) return;
      lastPayoutSfx = time;
      beep(rand(1900, 2300), 0, 0.03, 0.03);
      noise(0.02, 0.03);
    },
    event() {
      [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.07, 0.08, 0.04));
    },
    fever() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.08, 0.08, 0.045));
    },
    roulette() { beep(1500, 0, 0.02, 0.03); },
    encounter() { [392, 523, 392, 659].forEach((f, i) => beep(f, i * 0.07, 0.07, 0.045)); },
    hit(big) { noise(0.06, 0.06); beep(big ? 220 : 330, 0, 0.08, 0.05, 'square', big ? 90 : 160); },
    heal() { beep(880, 0, 0.06, 0.04); beep(1175, 0.06, 0.1, 0.04); },
    good() { beep(1319, 0, 0.05, 0.045); beep(1760, 0.05, 0.08, 0.04); },
    open() { [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.06, 0.08, 0.045)); },
    victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.08, 0.09, 0.05)); },
    block() { noise(0.1, 0.06); beep(1568, 0.02, 0.15, 0.05, 'triangle'); },
    count() { beep(880, 0, 0.08, 0.05); },
    go() { beep(1760, 0, 0.2, 0.05); },
    hurry() { beep(1320, 0, 0.05, 0.05); beep(1320, 0.1, 0.05, 0.05); },
    roar() { noise(0.6, 0.08); beep(110, 0, 0.8, 0.07, 'sawtooth', 55); beep(165, 0.1, 0.7, 0.05, 'square', 70); },
    fanfare() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.12, 0.11, 0.05)); },
    aid() { [659, 784, 988].forEach((f, i) => beep(f, i * 0.09, 0.09, 0.045)); },
    throwDice() { beep(300, 0, 0.15, 0.05, 'square', 900); noise(0.08, 0.04); },
    diceResult() { beep(1319, 0, 0.08, 0.05); beep(1760, 0.08, 0.2, 0.05); },
    step(n) { beep(660 + n * 110, 0, 0.06, 0.04); },
    jackpot() {
      [784, 784, 784, 1047, 1319, 1568, 2093].forEach((f, i) => beep(f, i * 0.1, 0.1, 0.05));
    },
    miss() { beep(440, 0, 0.1, 0.04, 'square', 330); },
    win() {
      if (time - lastWinSfx < 0.06) return;
      lastWinSfx = time;
      beep(1047, 0, 0.05, 0.05);
      beep(1568, 0.05, 0.05, 0.05);
      beep(2093, 0.1, 0.16, 0.045);
    },
    lost() { beep(330, 0, 0.12, 0.05, 'square', 140); },
    gameOver() {
      const notes = [523, 440, 349, 262];
      notes.forEach((f, i) => beep(f, i * 0.16, 0.15, 0.05, 'square'));
    }
  };

  // ================= ドット絵スプライト =================
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // コインのドット絵（12×14。下2行は厚み）
  const COIN_MAP = [
    '...oooooo...',
    '.oolllllloo.',
    '.olwlgggggo.',
    'ollggggggggo',
    'olggglggggdo',
    'olgggldgggdo',
    'olgggldgggdo',
    'olgggldgggdo',
    'olggggdgggdo',
    'olggggggggdo',
    '.ogggggggddo',
    '.oddddddddo.',
    '..oddddddo..',
    '...oooooo...'
  ];
  const COIN_COLORS = { o: C.goldEdge, l: C.goldLight, w: C.white, g: C.gold, d: C.goldDark };

  function makeCoinSprite() {
    const c = makeCanvas(D, COIN_MAP.length);
    const g = c.getContext('2d');
    COIN_MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = COIN_COLORS[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return c;
  }

  // 横につぶして、くるくる回って見えるコマを作る
  function makeSpinSprite(full, w) {
    const c = makeCanvas(D, full.height);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(full, Math.round((D - w) / 2), 0, w, full.height);
    return c;
  }

  const coinFull = makeCoinSprite();
  const spinFrames = [coinFull, makeSpinSprite(coinFull, 8), makeSpinSprite(coinFull, 4),
    makeSpinSprite(coinFull, 2), makeSpinSprite(coinFull, 4), makeSpinSprite(coinFull, 8)];

  function drawCoinSprite(sprite, x, y) {
    ctx.drawImage(sprite, px(x - R), px(y - R));
  }

  // 床（ディザ模様）を事前に描いておく
  let floorCanvas = null;
  const build_floorCanvas = () => {
    const w = FIELD.right - FIELD.left;
    const h = FIELD.edge - FIELD.top;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.fillStyle = C.floorA;
    g.fillRect(0, 0, w, h);
    g.fillStyle = C.floorB;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x + y) % 2 === 0 && (Math.floor(y / 8) % 2 === 0)) g.fillRect(x, y, 1, 1);
      }
    }
    // 前へ向かう矢印
    g.fillStyle = '#2c3474';
    for (let i = 0; i < 4; i++) {
      const ax = Math.round((17 + i * 34) * (w / 136));
      for (let k = 0; k < 5; k++) {
        g.fillRect(ax - 5 + k, h - 40 + k, 2, 1);
        g.fillRect(ax + 4 - k, h - 40 + k, 2, 1);
      }
    }
    return c;
  };
  floorCanvas = build_floorCanvas();

  // ================= ドット文字（3×5） =================
  const GLYPHS = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010',
    '8': '111101111101111', '9': '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
    E: '111100111100111', F: '111100110100100', G: '111100101101111', H: '101101111101101',
    I: '111010010010111', K: '101110100110101', L: '100100100100111', M: '101111111101101',
    N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
    W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    '+': '000010111010000', '!': '010010010000010', ':': '000010000010000', '-': '000000111000000',
    '.': '000000000000010', ' ': '000000000000000',
    J: '001001001101111', Q: '010101101110011', '/': '001001010100100', '>': '100010001010100', '?': '111001011000010'
  };

  function textWidth(str, scale) {
    return str.length * 4 * scale - scale;
  }

  function drawText(str, x, y, color, scale, shadow) {
    scale = scale || 1;
    if (shadow) drawText(str, x + scale, y + scale, shadow, scale, null);
    ctx.fillStyle = color;
    let cx = px(x);
    for (const ch of str) {
      const gl = GLYPHS[ch] || GLYPHS[' '];
      for (let i = 0; i < 15; i++) {
        if (gl[i] === '1') ctx.fillRect(cx + (i % 3) * scale, px(y) + Math.floor(i / 3) * scale, scale, scale);
      }
      cx += 4 * scale;
    }
  }

  function drawTextCenter(str, cx, y, color, scale, shadow) {
    drawText(str, cx - textWidth(str, scale) / 2, y, color, scale, shadow);
  }

  // ================= 物理 =================
  function newCoin(x, y, level) {
    return { x, y, px: x, py: y, vx: 0, vy: 0, level: level || 0, hy: (level || 0) * STACK_H };
  }

  function pusherFront(t) {
    const mid = (FIELD.pushMin + FIELD.pushMax) / 2;
    const amp = (FIELD.pushMax - FIELD.pushMin) / 2;
    return mid + amp * Math.sin(t * FIELD.speed);
  }

  function solvePairs(arr) {
    const n = arr.length;
    const minD2 = D * D;
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD2) continue;
        if (d2 < 0.0001) {
          dx = rand(-0.3, 0.3);
          dy = rand(-0.3, 0.3);
        }
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const push = (D - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // プッシャー盤面用の押し合い：力が弱まりながら伝わり、左右へ逃げ、重なりすぎると乗り上げる
  function solveFieldPairs(arr, climb) {
    const n = arr.length;
    const minD2 = D * D;
    for (let i = 0; i < n; i++) {
      const a = arr[i];
      if (a.level !== 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = arr[j];
        if (b.level !== 0) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD2) continue;
        if (d2 < 0.0001) { dx = rand(-0.3, 0.3); dy = 0.2; }
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const overlap = D - d;
        // 重なりすぎたら、奥側のメダルが乗り上げて力が逃げる
        if (climb && overlap > D * PH.climbAt && climb.count < PH.maxTopCoins) {
          const back = a.y < b.y ? a : b;
          back.level = 1;
          back.climbX = (back === a ? -1 : 1) * Math.sign(dx || rand(-1, 1));
          climb.count++;
          continue;
        }
        let nx = dx / d;
        let ny = dy / d;
        // 前後に押し合うときは、左右へ逃げる向きを足す
        const side = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
        nx += side * Math.abs(ny) * PH.lateralSpread;
        const len = Math.hypot(nx, ny);
        nx /= len;
        ny /= len;
        const push = overlap * 0.5 * PH.pairStiffness;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        // 押されたメダルは、少しずつ外側（左右の ×ゾーン側）へ流れる
        const front = a.y > b.y ? a : b;
        const cx = (FIELD.left + FIELD.right) / 2;
        front.x += Math.sign(front.x - cx || 1) * Math.abs(ny) * push * PH.outwardDrift;
      }
    }
  }

  function solveBounds(arr) {
    const minX = FIELD.left + R;
    const maxX = FIELD.right - R;
    const minY = FIELD.front + FACE + R; // プッシャーの前面より奥には入れない
    for (const c of arr) {
      if (c.x < minX) c.x = minX;
      else if (c.x > maxX) c.x = maxX;
      if (c.y < minY) c.y = c.y + (minY - c.y) * PH.pusherStiffness;
    }
  }

  // 重なったコインを支える下のコイン
  function findSupport(c, base) {
    let best = null;
    let bestD2 = (R * 1.45) * (R * 1.45);
    for (const b of base) {
      const dx = b.x - c.x;
      const dy = b.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = b;
      }
    }
    return best;
  }

  // プッシャーの上のコイン：板と一緒に動き、奥の固定板で止められる。
  // 板が下がるとき前の縁から押し出されて床へ落ちる
  function stepPusherCoins() {
    const dy = FIELD.front - FIELD.prevFront;
    const stopY = FIELD.top + R;
    for (const c of pusherCoins) c.y += dy;
    for (let k = 0; k < 6; k++) {
      solvePairs(pusherCoins);
      for (const c of pusherCoins) {
        c.x = clamp(c.x, FIELD.left + R, FIELD.right - R);
        if (c.y < stopY) c.y = stopY;
      }
    }
    for (let i = pusherCoins.length - 1; i >= 0; i--) {
      const c = pusherCoins[i];
      if (c.y <= FIELD.front) continue;
      pusherCoins.splice(i, 1);
      landCoin(c.x, c.y, LIFT);
      lastActivity = time;
    }
  }

  function stepField() {
    const base = [];
    const top = [];
    for (const c of coins) (c.level === 0 ? base : top).push(c);

    for (const c of base) {
      c.px = c.x;
      c.py = c.y;
      c.x += c.vx;
      c.y += c.vy;
    }
    base.sort((a, b) => b.y - a.y);   // 手前から順に解く（奥の力が一気に手前まで届かない）
    const climb = { count: top.length };
    for (let k = 0; k < PH.iterations; k++) {
      solveFieldPairs(base, climb);
      solveBounds(base);
    }
    const minY = FIELD.front + FACE + R;
    for (const c of base) {
      if (c.level !== 0) continue;               // いま乗り上げたメダル
      // 静止摩擦：止まっているメダルは、小さな力では動き出さない（押す力がここで止まる）
      const mx = c.x - c.px;
      const my = c.y - c.py;
      const m2 = mx * mx + my * my;
      if (!c.moving && m2 < PH.staticFriction * PH.staticFriction) {
        c.x = c.px;
        c.y = Math.max(c.py, minY);              // 押し板にはめりこませない
        c.vx = 0;
        c.vy = 0;
        continue;
      }
      // 動き出したメダルは、動摩擦で少しずつ止まる（崩れるときは一気に動く）
      c.moving = true;
      c.vx = (c.x - c.px) * PH.kineticFriction;
      c.vy = (c.y - c.py) * PH.kineticFriction;
      if (c.vx * c.vx + c.vy * c.vy < PH.stopSpeed * PH.stopSpeed) {
        c.vx = 0;
        c.vy = 0;
        c.moving = false;
      }
    }
    // 乗り上げたメダルは「2枚目」として扱う
    for (const c of base) {
      if (c.level === 1) {
        c.vx = 0;
        c.vy = 0;
        c.x += (c.climbX || 0) * 1.5;
        top.push(c);
      }
    }

    // 2枚目：下のコインに乗って運ばれる。支えがなくなったら落ちる
    const stillTop = [];
    for (const c of top) {
      const s = findSupport(c, base);
      if (s) {
        c.x += s.x - s.px;
        c.y += s.y - s.py;
        stillTop.push(c);
      } else {
        c.level = 0;
        c.vx = 0;
        c.vy = 0.1;
      }
    }
    for (let k = 0; k < 4; k++) {
      solvePairs(stillTop);
      solveBounds(stillTop);
    }
    for (const c of coins) c.hy += (c.level * STACK_H - c.hy) * 0.35;
  }

  function landCoin(x, y, fromHeight) {
    x = clamp(x, FIELD.left + R, FIELD.right - R);
    y = Math.max(y, FIELD.front + FACE + R);
    let level = 0;
    for (const c of coins) {
      if (c.level !== 0) continue;
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < (R * 0.75) * (R * 0.75)) {
        level = 1;
        break;
      }
    }
    const c = newCoin(x, y, level);
    if (fromHeight) c.hy = fromHeight + level * STACK_H;
    coins.push(c);
    sfx.land();
  }

  function landOnPusher(x, y) {
    x = clamp(x, FIELD.left + R, FIELD.right - R);
    y = clamp(y, FIELD.top + R, FIELD.front - 1);
    pusherCoins.push({ x, y, hy: LIFT, level: 0 });
    sfx.land();
  }

  // 手前の縁から落ちたメダルは、左右の位置に関係なくすべて獲得
  function checkEdge() {
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.y <= FIELD.edge + R * PH.dropOver) continue;   // 重心が十分に崖を越えたら落ちる
      coins.splice(i, 1);
      lastActivity = time;
      const lost = c.x < FIELD.left + LOST_W || c.x > FIELD.right - LOST_W;   // 左右の ×ゾーン
      falling.push({
        kind: lost ? 'lost' : 'win', x: c.x, y: FIELD.edge, y0: FIELD.edge, y1: TRAY_Y + rand(-2, 3), t: 0, dur: 0.22
      });
      if (lost) { stats.lost = (stats.lost || 0) + 1; sfx.lost(); }
      else onWin(c.x);
    }
  }


