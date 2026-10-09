'use strict';
  // =====================================================================
  //  記録（ARCADE RECORD）
  // =====================================================================
  function noteMedals() {
    const d = D_();
    const r = P_().records;
    if (hand > d.bestMedal) d.bestMedal = hand;
    if (hand > r.arcade.bestMedal) r.arcade.bestMedal = hand;
    if (scene === 'machine' && currentMachine && currentMachine.machineId === 'piyo' && hand > r.piyo.bestMedal) {
      const first = r.piyo.bestMedal;
      r.piyo.bestMedal = hand;
      if (first > 0 && !noteMedals.told) { noteMedals.told = true; toast('NEW RECORD! 最高メダル'); }
    }
  }
  function recordPiyoLevel(lv) {
    const st = D_().stats.piyo;
    const r = P_().records.piyo;
    st.maxLv = Math.max(st.maxLv, lv);
    if (lv > r.bestLv) { r.bestLv = lv; toast('NEW RECORD! 最高LV ' + lv); }
  }
  function recordHuntWin() {
    const st = D_().stats.piyo;
    const r = P_().records.piyo;
    st.huntWins++;
    if (st.huntWins > r.bestHuntWins) {
      const prev = r.bestHuntWins;
      r.bestHuntWins = st.huntWins;
      if (prev > 0 && st.huntWins === prev + 1) toast('NEW RECORD! HUNT勝利 ' + st.huntWins + '回');
    }
  }
  function recordBoss() {
    const st = D_().stats.piyo;
    const r = P_().records.piyo;
    st.bossDefeated = true;
    r.bossDefeats++;
    if (!r.bossDefeated) {
      r.bossDefeated = true;
      r.bossFirstDay = P_().day;
      toast('NEW RECORD! 森の主初討伐！');
    }
    writeSave();
  }

  function jcRecLines() { const r = P_().jewelChain; return [{ text: '💎 JEWEL CHAIN　BEST ' + (r.soloBestScore || '---') + '（連鎖 ' + (r.soloBestChain || 0) + '）', cls: r.soloBestScore >= 100000 ? 'gold' : '' }, { text: '　対戦　' + r.vsWins + '勝 ' + r.vsLosses + '敗', cls: 'dim' }]; }
  function szRecLines() { const r = P_().strikeZone; return [{ text: '🎳 STRIKE ZONE　BEST ' + (r.bestScore || '---') + ' 点', cls: r.bestScore >= 100 ? 'gold' : '' }]; }
  function ppRecLines() { const r = P_().powerPunch; return [{ text: '🥊 POWER PUNCH　BEST ' + (r.bestPower || '---'), cls: r.bestPower >= 900 ? 'gold' : '' }]; }
  function nbRecLines() { const r = P_().niceBatting; return [{ text: '⚾ NICE BATTING　BEST ' + (r.bestScore || '--') + ' 点', cls: r.bestScore >= 300 ? 'gold' : '' }]; }
  function brRecLines() { const r = P_().basketRush; return [{ text: '🏀 BASKET RUSH　BEST ' + (r.bestScore || '--') + ' 本', cls: r.bestScore >= 20 ? 'gold' : '' }]; }
  function tdRecLines() {                                                                    // RECORD：TOP DRIVER の BEST TIME・BEST PLACE（コースごと）
    const out = [{ text: '🏎️ TOP DRIVER', cls: 'head' }]; const t = P_().topDriver;
    for (const c of TDC.courses) { const r = t.courses[c.id]; out.push({ text: c.name + '　BEST TIME ' + (r && r.bestTime ? r.bestTime.toFixed(2) : '--.--') + '　BEST ' + (r && r.bestPlace ? r.bestPlace + '位' : '---'), cls: r && r.bestPlace === 1 ? 'gold' : '' }); }
    out.push({ text: 'PLAY ' + t.playCount, cls: 'dim' }); return out;
  }
  function openRecords() {
    const r = P_().records;
    showDialog({
      title: 'ARCADE RECORD',
      wide: true,
      lines: [
        { text: 'DAY ' + P_().day + '　💴 ' + yen(P_().money), cls: '' },
        { text: '最高メダル（ゲームセンター）　' + r.arcade.bestMedal, cls: '' },
        { text: '🐥 PIYO MEDAL ADVENTURE', cls: 'head' },
        { text: SGM() ? 'すごろく　最高' + r.piyo.bestLv + 'マス / 50' : '最高LV　LV ' + r.piyo.bestLv, cls: '' },
        { text: '最高所持メダル　' + r.piyo.bestMedal, cls: '' },
        { text: SGM() ? 'WORLD 1 をクリア　' + (r.piyo.worldClears || 0) + '回' : 'HUNT最高勝利数　' + r.piyo.bestHuntWins, cls: '' },
        { text: '森の主　' + (r.piyo.bossDefeated ? '🏆 DEFEATED（' + r.piyo.bossDefeats + '回）' : '？？？'), cls: r.piyo.bossDefeated ? 'gold' : '' },
        { text: r.piyo.bossDefeated ? 'ボス初討伐　DAY ' + r.piyo.bossFirstDay : '', cls: 'dim' },
        { text: '⚔️ SLIME HUNT', cls: 'head' },
        { text: 'PLAY ' + r.slime.plays + '　WIN ' + r.slime.wins + '　LOSE ' + r.slime.losses, cls: '' },
        { text: 'BEST WIN　' + r.slime.bestWin + ' MEDAL', cls: r.slime.bestWin >= 30 ? 'gold' : '' }
      ].concat(['rainbow', 'king', 'gold', 'crystal'].map((id) => ({
        text: SLIME_BY_ID[id].label + ' SLIME　' + (r.slime.defeated[id] ? '🏆 DEFEATED（DAY ' + r.slime.firstDay[id] + '）' : '？？？'),
        cls: r.slime.defeated[id] ? 'gold' : 'dim'
      }))).concat([
        { text: '🦆 DUCK RACE', cls: 'head' },
        { text: 'RACE ' + r.duck.plays + '　WIN ' + r.duck.wins + '　3連単 ' + r.duck.trifectaWins + '回', cls: '' },
        { text: '最高払い出し　' + r.duck.bestPayout + ' MEDAL', cls: r.duck.bestPayout >= 50 ? 'gold' : '' },
        { text: '最高的中オッズ　' + (r.duck.bestOdds > 0 ? '×' + fmtOdds(r.duck.bestOdds) : '？？？'), cls: r.duck.bestOdds >= 50 ? 'gold' : 'dim' }
      ]).concat([
        { text: '🐹 HAM-CHAN PANIC!', cls: 'head' },
        { text: 'PLAY ' + r.ham.plays + '　SAFE ' + r.ham.safes + '　CRASH ' + r.ham.crashes, cls: '' },
        { text: '最高獲得　' + r.ham.bestPayout + ' MEDAL　／　FINAL到達 ' + r.ham.finalReached + '回', cls: r.ham.bestPayout >= 30 ? 'gold' : '' },
        { text: '×' + HM_STAGES[HM_N - 1].payout + ' 獲得　' + r.ham.finalClears + '回', cls: r.ham.finalClears > 0 ? 'gold' : 'dim' }
      ]).concat([
        { text: '🎰 LUCKY SLOT', cls: 'head' },
        { text: 'SPIN ' + r.slot.plays + '　WIN ' + r.slot.wins + '　777 ' + r.slot.red7 + '回　💎 ' + r.slot.diamond + '回', cls: r.slot.red7 > 0 ? 'gold' : '' },
        { text: '最高払い出し　' + r.slot.bestPayout + ' MEDAL', cls: r.slot.bestPayout >= 15 ? 'gold' : '' },
        { text: '🍒 ' + r.slot.sym.cherry + '　🍋 ' + r.slot.sym.lemon + '　🔔 ' + r.slot.sym.bell + '　⭐ ' + r.slot.sym.star, cls: 'dim' }
      ]).concat(mgRecLines()).concat([{ text: '🎟️ STICKER　' + stkOwned() + ' / ' + stkTotal(), cls: 'head' }, { text: '📷 PHOTO　' + P_().photos.length + '枚', cls: 'head' }]).concat(tdRecLines()).concat(brRecLines()).concat(nbRecLines()).concat(ppRecLines()).concat(szRecLines()).concat(jcRecLines()),
      buttons: [{ label: 'シール帳（' + stkOwned() + ' / ' + stkTotal() + '）', onClick: () => setTimeout(openStickerBook, 0) }, { label: 'PHOTO を見る（' + P_().photos.length + '枚）', onClick: () => setTimeout(openAlbum, 0) }, { label: '閉じる', primary: true }]
    });
  }

