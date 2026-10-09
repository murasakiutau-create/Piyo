/* ドット絵メダルゲーム「ピヨちゃんのメダルアドベンチャー」（試作版）
 *
 *   上段：ピンが並ぶスマートボール盤面（4つの入賞ポケット）
 *   中段：ADVENTURE TV（ピヨちゃんの冒険画面）
 *   下段：コインプッシャー
 *
 * 180×384 ピクセルの小さなキャンバスに描いて、拡大表示しています。
 * 素の JavaScript + Canvas のみ。外部ライブラリなし。
 * 調整したい数値は、すぐ下の CONFIG にまとめてあります。
 */
'use strict';
  // =====================================================================
  //  画面サイズ
  // =====================================================================
  const WIDE_NATIVE = { jewelChain: () => true, blockCrash: () => true, seaAttack: () => true, bullDarts: () => true, nineBreak: () => true, ghostRush: () => true, goRocket: () => true, hyakki: () => true, horror: () => true, mystery: () => true, pingPong: () => true, strikeZone: () => true, airSmash: () => true, powerPunch: () => true, niceBatting: () => true, basketRush: () => true, topDriver: () => true, kawaiiClub: () => true, sparkTap: () => true, happyBeat: () => true, craneGame: () => true, piyoAdventure: () => CONFIG.piyoWide, duckRace: () => CONFIG.duckRace.wide, fishCatch: () => true, balloonShoot: () => true, starFlight: () => true, stopTrain: () => true, ghostPanic: () => true, bingo: () => true, pirateTreasure: () => true, superCosmo: () => true, slimeHunt: () => true, hamPanic: () => true, luckySlot: () => true };      // ゲームの領域そのものを、画面いっぱいに広げた台
  const dkWantWide = () => !!(CONFIG.wide.enabled && ((scene === 'b1') || scene === 'b2' || scene === 'b3' || scene === 'b4' || scene === 'b5' || scene === 'album' || scene === 'photoView' || scene === 'vending' || scene === 'gacha' || scene === 'sbook' || scene === 'elev' || scene === 'shelf' || scene === 'detail' || (scene === 'machine' && currentMachine && WIDE_NATIVE[currentMachine.gameType] && WIDE_NATIVE[currentMachine.gameType]()) || scene === 'title' || scene === 'seq' || scene === 'center'));
  function setLayoutWidth(w) {                                   // ゲームの配置幅を切り替える（DUCK RACE のワイド配置のときだけ、広い）
    if (W === w) return;
    W = w;
    buildBulbs();
    dkRelayout();
    mgRelayout();
  }
  const wideOff = () => Math.round((CW - W) / 2);                // キャンバスの中で、ゲームを中央に置くための左右の余白
  function resize() {
    const fhBlock = fhEl ? fhEl.offsetHeight + 14 : 0;                // 茶色い枠の外のヘッダーのぶん（いつも あけておく：画面の大きさが、場面で かわらないように）
    const sw = stage.clientWidth - 28;   // 枠線ぶんを引く
    const sh = stage.clientHeight - 28 - fhBlock;
    {                                                            // いまの拡大率のまま、使える横幅の約94%まで広げた場合の論理幅（上限つき）
      let s0 = Math.min(sw / 180, sh / H);
      if (s0 >= 2) s0 = Math.floor(s0);
      s0 = Math.max(0.5, s0);
      const w2 = Math.min(240, Math.floor((0.94 * stage.clientWidth - 8) / s0));
      WIDEW = w2 - 180 >= 8 ? w2 : 180;
    }
    const wantCW = CONFIG.wide.enabled ? WIDEW : 180;
    if (CW !== wantCW) { CW = wantCW; canvas.width = CW; ctx.imageSmoothingEnabled = false; }
    document.body.classList.toggle('wide-mode', CW > 180);
    let s = Math.min(sw / CW, sh / H);
    if (s >= 2) s = Math.floor(s);       // 2倍以上なら整数倍にしてドットをくっきり
    s = Math.max(0.5, s);
    screenEl.style.width = Math.floor(CW * s) + 8 + 'px';
    screenEl.style.height = Math.floor(H * s) + 8 + 'px';
    if (fhEl) fhEl.style.width = Math.floor(CW * s) + 8 + 'px';
    layoutMessage();
  }
  // 左右の飾り：ゲームは中央（元の縦横比のまま）。広くなったぶんは、そのゲームの色の壁・電球・星空で埋める
  let wideActive = false;
  function drawWideSides(off) {
    const w = CW;
    let base = '#08051a'; let edge = '#2a1e48'; let glow = '#ffd040'; let starry = false;
    const m = scene === 'machine' ? currentMachine : null;
    if (m && m.theme) { base = mixHex(m.theme.body, '#000000', 0.62); edge = m.theme.side; glow = m.theme.sign; }
    else if (scene === 'center') { const L = FLOOR_LOOK[centerFloor]; base = L.wall; edge = L.base; glow = '#ff8ec8'; }
    else starry = true;
    rect(0, 0, w, H, starry ? '#05060f' : base);
    if (starry) {
      for (let k = 0; k < 90; k++) { ctx.globalAlpha = 0.4 + 0.5 * Math.sin(time * 1.1 + k); rect((k * 53) % w, (k * 37) % H, k % 9 === 0 ? 2 : 1, k % 9 === 0 ? 2 : 1, k % 5 === 0 ? '#fff3b0' : '#9fb0e0'); }
      ctx.globalAlpha = 1;
    } else {
      for (let x = 0; x < w; x += 6) rect(x, 0, 1, H, mixHex(base, edge, 0.3));
      for (const bx of [Math.round(off / 2) - 1, w - Math.round(off / 2) - 1]) {            // 左右の、電球の柱
        rect(bx - 2, 8, 6, H - 16, mixHex(base, edge, 0.5));
        for (let y = 14; y < H - 10; y += 10) { ctx.globalAlpha = 0.35 + 0.45 * Math.sin(time * 2 - y * 0.12); rect(bx, y, 2, 2, glow); }
        ctx.globalAlpha = 1;
      }
      rect(0, 0, w, 3, edge); rect(0, H - 3, w, 3, edge);
    }
  }
  function wideBegin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const off = wideOff();
    wideActive = off > 0;
    if (!wideActive) return;
    drawWideSides(off);
    ctx.save();
    ctx.translate(off, 0);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  }
  function wideEnd() { if (wideActive) { ctx.restore(); wideActive = false; } }
  window.addEventListener('resize', resize);

  // =====================================================================
  //  入力
  // =====================================================================
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    const border = 4;
    return {
      x: ((e.clientX - r.left - border) / (r.width - border * 2)) * CW - wideOff(),
      y: ((e.clientY - r.top - border) / (r.height - border * 2)) * H
    };
  }
  const clampGuide = (x) => clamp(x, BOARD.left + BOARD.ballR, BOARD.right - BOARD.ballR);

  canvas.addEventListener('pointerdown', (e) => {
    ensureAudio();
    e.preventDefault();
    if (dialogOpen) return;
    if (scene === 'title') return;
    if (scene === 'seq') { seqTap(toLogical(e)); return; }
    if (scene === 'center') { centerTap(toLogical(e)); return; }
    if (scene === 'b1') { b1Tap(toLogical(e)); return; }
    if (scene === 'b2') { b2Tap(toLogical(e)); return; }
    if (scene === 'b3') { b3Tap(toLogical(e)); return; }
    if (scene === 'b4') { b4Tap(toLogical(e)); return; }
    if (scene === 'b5') { b5Tap(toLogical(e)); return; }
    if (scene === 'shelf') { shelfDown(toLogical(e)); return; }
    if (scene === 'album') { kaDown(toLogical(e)); return; }
    if (scene === 'vending' || scene === 'gacha') return;
    if (scene === 'elev') { elevTap(toLogical(e)); return; }
    if (scene === 'sbook') { bkDown(toLogical(e)); return; }
    const gt = currentMachine && GAME_TYPES[currentMachine.gameType];
    if (gt && gt.pointer && !zoom) gt.pointer(e, toLogical(e));
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());                          // 長押しメニューを出さない（音ゲーの途中で、じゃまをしない）
  canvas.addEventListener('pointermove', (e) => {
    if (scene === 'shelf') { shelfMove(toLogical(e)); return; }
    if (scene === 'album') { kaMove(toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'kawaiiClub') { kcPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'topDriver') { tdPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'basketRush') { brPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'niceBatting') { nbPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'powerPunch') { ppPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'airSmash') { asPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'strikeZone') { szPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'pingPong') { ttPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'jewelChain') { jcPointerMoveTrack(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'blockCrash') { bcPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'bullDarts') { bdPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'nineBreak') { nkPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'seaAttack') { saPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'happyBeat') { hbPointerMove(e, toLogical(e)); return; }
    if (scene === 'machine' && currentMachine && currentMachine.gameType === 'mystery') { mhPointerMove(e, toLogical(e)); return; }
    if (!holding && e.pointerType !== 'mouse') return;
    guideX = clampGuide(toLogical(e).x);
  });
  const stopHold = (e) => {
    holding = false;
    if (scene === 'shelf') { shelfUp(toLogical(e)); return; }
    if (scene === 'album') { kaUp(toLogical(e)); return; }
    if (scene === 'sbook') { bkUp(toLogical(e)); return; }
    const gt = scene === 'machine' && currentMachine && GAME_TYPES[currentMachine.gameType];
    if (gt && gt.pointerUp) gt.pointerUp(e);
  };
  canvas.addEventListener('wheel', (e) => { if (scene === 'shelf') { SHF.scroll += e.deltaY * 0.4; e.preventDefault(); } else if (scene === 'album') { KC.album.scroll += e.deltaY * 0.4; e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('pointerup', stopHold);
  canvas.addEventListener('pointercancel', stopHold);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') guideX = clampGuide(guideX - 3);
    else if (e.key === 'ArrowRight') guideX = clampGuide(guideX + 3);
    else if (e.key === ' ' && document.activeElement === document.body && scene === 'machine' && !dialogOpen) {
      ensureAudio();
      const gt = currentMachine && GAME_TYPES[currentMachine.gameType];
      if (gt && gt.space) gt.space();
      e.preventDefault();
    } else if (scene === 'machine' && !dialogOpen && document.activeElement === document.body) {
      const gt = currentMachine && GAME_TYPES[currentMachine.gameType];
      if (gt && gt.key && gt.key(e.key)) e.preventDefault();
    }
  });

  retryBtn.addEventListener('click', () => { ensureAudio(); askStand(); });
  soundBtn.addEventListener('click', () => {
    ensureAudio();
    muted = !muted;
    soundBtn.textContent = muted ? '音 OFF' : '音 ON';
    soundBtn.setAttribute('aria-pressed', String(!muted));
  });

  // =====================================================================
  //  メインループ
  // =====================================================================
  let last = 0;
  let acc = 0;
  function frame(ts) {                                           // 左右の飾り＋ゲームを中央に置く、を包む
    wideBegin();
    frameInner(ts);
    wideEnd();
    if (!frame.shown) { frame.shown = true; canvas.style.visibility = ''; const bt = document.getElementById('boot'); if (bt) bt.remove(); }       // さいしょの1コマが描けるまで、からっぽの枠を見せない
  }
  function frameInner(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.1) dt = 0.1;
    setLayoutWidth(dkWantWide() ? CW : 180);                     // DUCK RACE のあいだだけ、画面いっぱいの配置
    fhUpdate();                                                  // 茶色い枠の外のヘッダー：フロアのときだけ見せる
    stepArcade(dt);
    if (scene === 'title') { drawTitle(); requestAnimationFrame(frame); return; }
    if (scene === 'b1') { drawB1(); requestAnimationFrame(frame); return; }
    if (scene === 'b2') { drawB2(); requestAnimationFrame(frame); return; }
    if (scene === 'b3') { drawB3(); requestAnimationFrame(frame); return; }
    if (scene === 'b4') { drawB4(); requestAnimationFrame(frame); return; }
    if (scene === 'b5') { drawB5(); requestAnimationFrame(frame); return; }
    if (scene === 'shelf') { drawShelf(); requestAnimationFrame(frame); return; }
    if (scene === 'album') { drawAlbum(); requestAnimationFrame(frame); return; }
    if (scene === 'vending') { drawVending(); requestAnimationFrame(frame); return; }
    if (scene === 'gacha') { drawGacha(); requestAnimationFrame(frame); return; }
    if (scene === 'elev') { drawElev(); requestAnimationFrame(frame); return; }
    if (scene === 'sbook') { drawSBook(); requestAnimationFrame(frame); return; }
    if (scene === 'photoView') { drawPhotoView(); requestAnimationFrame(frame); return; }
    if (scene === 'detail') { drawPrizeDetail(); requestAnimationFrame(frame); return; }
    if (scene === 'seq') {                                   // 閉店・開店の演出
      if (!dialogOpen) stepSeq(dt);
      drawSeq();
      requestAnimationFrame(frame);
      return;
    }
    const gt = scene === 'machine' && currentMachine ? GAME_TYPES[currentMachine.gameType] : null;
    if (gt && !dialogOpen && !zoom) gt.update(dt);      // 座っている筐体だけが動く
    else acc = 0;
    if (gt && !zoom) gt.draw();
    else drawCenter();
    requestAnimationFrame(frame);
  }

  // テスト用のフック（通常は使われません）
  if (typeof window.__COIN_DEBUG__ === 'function') {
    window.__COIN_DEBUG__({
      CONFIG, insertCoin, step, stats, tv, G, handlePocket, currentRoles, buildPins, addGauge, MONSTERS, startBattle,
      sg: { SG, SG_SQ, sgPocket, sgStep, sgArrive, sgRollDice, sgRoles, sgReset, sgFeverStart, sgSerialize, sgRestore },
      sh: { SH, SLIMES, SLIME_BY_ID, SLIME_SPR, rollOutcome, rollSlimeId, slimePointer, slimeUpdate, slimeTapInsert, beginBattle, startResult, slotXY, announceSpawn, makeSlot, slimeResetDay, slimeSerialize, slimeRestore, drawSlimeScreen },
      dk: { DK, DUCKS, dkNewRace, dkProb, dkOdds, dkPayoutOf, dkSampleOrder, dkPickOrder, dkPlan, dkPrepFns, dkProg, dkPointer, dkUpdate, dkBet, dkTogglePick, dkSetType, dkNextRace, dkSerialize, dkRestore, dkResetDay, drawDuckScreen, DK_SPR, BET_TYPES },
      hm: { HM, HM_STAGES, hmStart, hmGo, hmCashOut, hmUpdate, hmRoll, hmSerialize, hmRestore, hmResetDay, drawHamScreen, HM_IMG, hmPayout },
      sl: { SL, SL_STRIPS, SL_PAY, SL_KEYS, slSpin, slStop, slUpdate, slEvaluate, slPickSlip, slSymAt, drawSlotScreen },
      bg: { BG, BGC, BG_LINES, bgMakeCard, bgSample, bgHits, bgLineCount, bgReach, bgPay, bgSim, bgForceDraw, bgPickBet, bgSelect, bgStart, bgUpdate, bgFinish, bgBetRects, bgCardRects, bgStartRect, openBgDev, GHOST_MACHINE },
      mh: { MH, MHC, MH_MACHINE, MHP, mhPanoRender, mhPanoTap, mhZoomTap, mhLayerToggle, mhMarkToggle, mhPixelStep, mhScanStep, mhPx, mhPointerMove, mhSetMode, mhStart, mhInsert, mhPointer, mhUpdate, mhScene, mhZoomTo, mhBack, mhTurn, openMhDev },
      hh: { HH, HHC, HH_MACHINE, hhButtons, hhInsert, hhStart, hhEnter, hhAct, hhUpdate, hhCaught, hhDev, openHhDev, hhHideNow },
      hy: { HY, HYC, HY_MACHINE, hyPointer, hyUpdate, hyRect, hyInsert, hyStart, hyReload, hySpawn, hyBossStart, hyBossGo, hyBossTarget, hyFirePos, hyFinish, hyRec, openHyDev },
      rk: { RK, RKC, RK_MACHINE, rkPointer, rkUpdate, rkInsert, rkStart, rkRec, rkKm, rkRankOf, rkFinishTap, openRkDev },
      gp: { GP, GPC, GP_MACHINE, gpPointer, gpUpdate, gpInsert, gpStart, gpSpawn, gpRec, gpField, gpHit, openGpDev },
      nk: { NK, NKC, NK_MACHINE, nkPointer, nkPointerMove, nkPointerUp, nkUpdate, nkInsert, nkStart, nkShoot, nkRec, nkG, nkPockets, nkRay, nkStep, nkNewRack, nkTarget, nkFree, openNkDev },
      bd: { BD, BDC, BD_MACHINE, bdPointer, bdPointerMove, bdPointerUp, bdUpdate, bdInsert, bdStart, bdScoreAt, bdRec, bdGeo, bdAnalyze, openBdDev },
      sa: { SA, SAC, SA_MACHINE, SA_SPR, saUpdate, saStart, saInsert, saFire, saStepInterval, saFleetStep, saKill, saPointer, saPointerMove, saPointerUp, saRec, saDraw, openSaDev, saBuildShields, saCarve },
      bc: { BC, BCC, BC_MACHINE, bcUpdate, bcStart, bcInsert, bcLoadStage, bcIndex, bcStepBall, bcApplyItem, bcLaunch, bcGeo, bcFinish, bcRec, openBcDev, bcDevKill, bcDevStage, bcTargetSpeed, bcDraw },
      jc: { jcUpdate, jcGravity, jcNewBoard, jcLock, jcFitsPublic: (b, r, c, o) => jcFits(b, r, c, o), JC, JCC, JC_MACHINE, jcNewSide, jcSideUpdate, jcSimVs, jcResolve, jcFindGroups, jcChainBoard, jcPay, jcStartGame, jcFinish, jcMove, jcRotate, jcFastDrop, jcAttackApply, jcCpuAct, jcLeaveMid, b4Cabs, openJcDev, jcImg, JC_CHARS },
      tt: { TT, TTC, TTW, TT_MACHINE, ttProj, ttHit, ttStepBall, ttUpdate, ttBegin, ttSim, ttNewMatch, ttStartServe, ttPickLevel, ttServer, ttBallPoint, ttPlayerAutoHit, ttCpuPlan, ttPredictArrival, ttCalcShot, ttPointer, ttPointerMove, ttPointerUp, ttRacketMove, ttBotTarget, ttLeaveMid, openTtDev },
      sz: { SZ, SZC, SZ_MACHINE, szScore, szAnalyze, szCounts, szStep, szUpdate, szBegin, szChooseGuard, szSimThrow, szAnalyzeSwipe, szProj, szMakePins, szPointer, szPointerMove, szPointerUp, szBallScreen, szDevSet, openSzDev, szStanding, szLaunch },
      el: { elevOpen, elevClose, elevPanel, ELV, FLOOR_DEFS, floorDef, floorsEnabled, floorMax, floorGo, openElevator, elevPick, elevSkip, elevBack, elevCells, elevTap, ELEV_DOOR, navUp, navDown, applyFloor, openElevDev },
      as: { asLeaveMidMatch, AS, ASC, AS_MACHINE, asUpdate, asBegin, asSim, asGeo, asNewMatch, asStep, asPointer, asPointerMove, asPointerUp, asServe, asPickLevel, openAsDev },
      pp: { PP, PPC, PP_MACHINE, ppScore, ppUpdate, ppBegin, ppStart, ppPad, ppPointer, ppPointerMove, ppPointerUp, openPpDev },
      nb: { NB, NBC, NB_MACHINE, nbUpdate, nbBegin, nbSwing, nbResolve, nbBallScreen, nbTargets, nbPointer, nbPointerMove, nbPointerUp, openNbDev },
      br: { BR, BRC, BRL, BR_MACHINE, brAssist, brStep, brUpdate, brBegin, brLaunch, brMakeBalls, brReset, brPointer, brPointerMove, brPointerUp, brFloorY, brAmp, openBrDev, b3Cabs, enterB3 },
      gc: { GCH, BK, STK, STK_CATS, GACHA_RECT, gcSpin, gcCoin, gcTurn, gcOpen, gcPick, gcGrant, enterGacha, openStickerBook, bkGoto, bkPageIdx, stkOwned, stkTotal, openGcDev },
      vm: { vmTake, vmCoin, VM_BENCH_RECT, VM, VM_MACHINES, VM_DRINK_RECT, VM_ICE_RECT, vmCell, vmTapProduct, vmBuy, enterVending, openVmDev },
      td: { tdCardRect, tdPickCourse, carScreen: () => { const pl = TD.player; const half = TD.halfRow[TD_CAR_ROW]; return { carX: TD.cxRow[TD_CAR_ROW] + pl.x * half, roadX: TD.cxRow[TD_CAR_ROW], half, rel: pl.x }; }, TD, TDC, TDV, TD_MACHINE, tdBegin, tdUpdate, tdStep, tdNewRace, tdBuildCourse, tdPointer, tdPointerMove, tdPointerUp, tdInput, tdWheel, tdProject, tdCurveAt, openTdDev },
      kc: { openKcDev, KC, KCC, KC_AVATARS, KC_STAMPS, KC_MACHINE, kcPointer, kcPointerMove, kcPointerUp, kcUpdate, kcPhotoRect, kcToolRects, kcAvGrid, kcBgGrid, kcStorageInfo, kcTestPhoto, kcDrawCheki, kcPack, openAlbum, kaLayout },
      st: { ST, STC, stNow, stBegin, stUpdate, stPointer, stPointerUp, stStopAudio, stTutStart, stFlatten, stRect, stPanelAt, stSongs, ST_MACHINE, stTutEnd, ST_TUT, b2c: () => b2Cabs() },
      hb: { HB, HBC, hbNow, hbBegin, hbPrepare, hbUpdate, hbPress, hbPointer, hbPointerMove, hbPointerUp, hbFinishPlay, hbReqLane, hbSongs, hbL, HB_MACHINE, hbAskQuit, hbOpenSettings, hbCloseSettings, b2Cabs, enterB2, leaveB2, b2Down, hbSetSpeed, hbSpeedLevel, hbLoadBuf, hbPause, hbResume },
      cr: { enterB1Now: () => { scene = 'b1'; currentMachine = null; updateSceneUi(); }, SHF, CRS, CRC, crState, crInsert, crUpdate, crHoldStart, crHoldEnd, crNextDay, crDecideGrip, crPhys, crDim, crInitMachine, crP, enterB1, b1Cabs, openShelf },
      ng: { SF, GH, PT, TR, BL, fcOverlap, fcResolve, fcMove, FCfn: { fcCatch }, CS, csTheory, csStart, csTake, csChallenge, csAmt, helpData, showHelp, titleGo: () => { const b = titleEl.querySelector('.title-btn'); if (b) b.click(); }, recSpawn, recCheck, recBonus, totalPlays, openDev, beginLoaded, blMore, fcCatch, slRollRole, slControl, dkBetFn: () => dkBet(), DK, GAME_TYPES, NGC, SF, FC, GH, PT, TR, BL, MG_MEM, sfInsert, ghInsert, ptInsert, blInsert, trInsert, trBrake, trStopDistance, blFire, fcCatch, ptChoose, ghTap, sfMax, SF_PAT, GH_HOLE, FLOORS, startClosing, startOpening, stepSeq, seqTap, changeFloor, todaySummary, mgRecLines, getSeq: () => seq, getFloor: () => centerFloor, centerTapFn: centerTap, slotMachine },
      arc: { floorGo: (n) => floorGo(n), stairBoxes: () => ({ up: stairUpBox(), down: stairDownBox() }), exitRect: () => EXIT, recordRect: () => RECORD_BOARD, door: () => ({ open: DOOR.open, target: DOOR.target, busy: DOOR.busy }), goCenter: (f) => { scene = 'center'; centerFloor = f; updateSceneUi(); }, slotName: (f, i) => slotMachine(f, i).machineName, save: () => save, scene: () => scene, canGoHome, startClosing, startOpening, seqInfo: () => (seq ? { kind: seq.kind, step: seq.step, frozen: !!seq.frozen } : null), centerFloor: () => centerFloor, MACHINES, buyMedals, enterMachine, standUp, nextDay, askGoHome, showDayResult, centerTap, writeSave, dialogOpen: () => dialogOpen, closeDialog, stepArcade },
      setHand: (n) => { hand = n; },
      oldBalls: () => balls.filter((b) => b.age > 8).map((b) => [b.x.toFixed(1), b.y.toFixed(1)]),
      state: () => ({ hand, won, coins: coins.length, balls: balls.length, payoutQueue, gameOver,
        state: G.state, gauge: Object.assign({}, G.gauge), pending: G.pending.slice(),
        piyo: Object.assign({}, G.piyo), explore: G.exploreCount, bossFound: G.bossFound, bossCleared: G.bossCleared,
        ev: G.event ? ((G.event.def && G.event.def.name) || G.event.kind) : '', aid: G.aidUsed, lost: stats.lost || 0, msg: msgText })
    });
  }

  resize();
  startArcade();
  requestAnimationFrame(frame);
