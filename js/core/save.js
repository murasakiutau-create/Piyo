'use strict';
  // =====================================================================
  //  セーブ（localStorage）：初期値・保存・読み込み・足りない項目の補い
  //    newRecords / newDaily / newSave …… 初期値 ／ writeSave …… 保存 ／ readSave …… 読み込み（mergeDefaults で、新しい項目を足しても 古いセーブが壊れない）
  //    P_() ＝ persistent ／ D_() ＝ daily。キーや形は、変えていません（ARC.saveKey）
  // =====================================================================

  function newRecords() {
    return {
      arcade: { bestMedal: 0, days: 0 },
      piyo: { bestLv: 1, bestMedal: 0, bestHuntWins: 0, bossDefeated: false, bossFirstDay: 0, bossDefeats: 0 },
      slime: {
        plays: 0, wins: 0, losses: 0, bestWin: 0,
        defeated: { crystal: false, gold: false, king: false, rainbow: false },     // レアスライムを倒したか
        firstDay: { crystal: 0, gold: 0, king: 0, rainbow: 0 }                      // 初めて倒した DAY
      },
      duck: { plays: 0, wins: 0, bestPayout: 0, bestOdds: 0, trifectaWins: 0 },      // DUCK RACE の永続記録
      ham: { plays: 0, safes: 0, crashes: 0, bestPayout: 0, finalReached: 0, finalClears: 0, best50: 0 },  // ハムちゃん危機一髪！
      slot: { plays: 0, wins: 0, bestPayout: 0, red7: 0, diamond: 0, sym: { cherry: 0, lemon: 0, bell: 0, star: 0, diamond: 0, red7: 0 } },   // LUCKY SLOT
      mg: mgDefaults(true)                                                     // 新6台の永続記録
    };
  }
  function newDaily() {
    return {
      medals: 0, spent: 0, bestMedal: 0, bought: false, played: false, paid: false, floor: 0,
      machines: {},                                // 各筐体のその日の状態（dailyState）
      rec: { active: null, done: 0, base: 0, next: 0, piyoBase: 0 },     // 店長のおすすめ
      stats: {
        piyo: { maxLv: 1, huntWins: 0, bossDefeated: false, coins: 0 },
        slime: { plays: 0, wins: 0, losses: 0, bestWin: 0 },
        duck: { races: 0, wins: 0, bestPayout: 0, bestOdds: 0 },
        ham: { plays: 0, safes: 0, crashes: 0, bestPayout: 0 },
        slot: { plays: 0, wins: 0, bestPayout: 0, red7: 0, diamond: 0 },
        mg: mgDefaults(false)
      }
    };
  }
  function newSave() {
    return {
      version: 1,
      persistent: { day: 1, money: ARC.startMoney, records: newRecords(), achievements: {}, crane: { v: 1, machines: {}, shelf: {}, plays: 0, gets: 0 }, happyBeat: { v: 1, playCount: 0, rec: {}, speed: 6 }, sparkTap: { v: 1, playCount: 0, tutorialSeen: false, rec: {} }, photos: [], topDriver: { v: 1, playCount: 0, courses: {}, tod: 'day' }, stickers: {}, stickerMeta: { completed: false }, basketRush: { v: 1, bestScore: 0, playCount: 0, seenHint: false }, niceBatting: { v: 1, bestScore: 0, playCount: 0, seenHint: false }, powerPunch: { v: 1, bestPower: 0, playCount: 0, seenHint: false }, airSmash: { v: 1, seenHint: false }, pingPongRally: { v: 1, tutorialSeen: false }, jewelChain: { v: 1, soloBestScore: 0, soloBestChain: 0, totalPlays: 0, vsWins: 0, vsLosses: 0, credit: 0, tutorialSeen: false }, blockCrash: { v: 1, high: 0, bestStage: 0, allClear: false, plays: 0 }, seaAttack: { v: 1, bestScore: 0, bestWave: 0, plays: 0 }, bullDarts: { v: 1, bestCountUp: 0, best301: 0, clears301: 0, plays: 0 }, nineBreak: { v: 1, plays: 0, clears: 0, bestShots: 0 }, ghostRush: { v: 1, plays: 0, bestScore: 0, bestCombo: 0 }, goRocket: { v: 1, plays: 0, bestKm: 0, bestPower: 0 }, hyakki: { v: 1, plays: 0, bestScore: 0, clears: 0 }, bingoSeen: false, strikeZone: { v: 1, bestScore: 0, playCount: 0, tutorialSeen: false } },
      daily: newDaily()
      // 将来メダルバンクなどを足すときは、ここに項目を追加します
    };
  }
  const P_ = () => save.persistent;
  const D_ = () => save.daily;

  function writeSave() {
    if (!save) return;
    if (!save) return;
    D_().medals = hand;
    // すべての筐体の「その日の状態」を保存する（座っていない台も、そのままの状態を残す）
    for (const m of MACHINES) {
      if (m.gameType) D_().machines[m.machineId] = GAME_TYPES[m.gameType].saveDaily();
    }
    try { localStorage.setItem(ARC.saveKey, JSON.stringify(save)); } catch (e) { /* 保存できない環境でも遊べる */ }
  }
  function mergeDefaults(def, obj) {
    if (def === null || typeof def !== 'object' || Array.isArray(def)) return obj === undefined ? def : obj;
    const out = {};
    const o = obj && typeof obj === 'object' ? obj : {};
    for (const k of Object.keys(def)) out[k] = mergeDefaults(def[k], o[k]);
    for (const k of Object.keys(o)) if (!(k in out)) out[k] = o[k];       // 知らない項目も消さずに残す
    return out;
  }
  function readSave() {
    try {
      const raw = localStorage.getItem(ARC.saveKey) || localStorage.getItem('piyo-arcade-save-v1');       // 前のセーブ名からも読めます
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.persistent || !s.daily) return null;
      // 足りない項目は初期値で補う（あとから項目や新台を増やしても壊れない）
      s.persistent = mergeDefaults(newSave().persistent, s.persistent);
      s.daily = mergeDefaults(newDaily(), s.daily);
      return s;
    } catch (e) { return null; }
  }

