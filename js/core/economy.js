'use strict';
  // =====================================================================
  //  お金とメダル：MONEY（¥）・MEDAL の 増減
  //    buyMedals …… 貸出機で ¥→MEDAL ／ chargeYen …… 1PLAYの ¥ 支払い ／ mgInsert・mgSettle …… メダルゲームの BET と 払い出し
  //    noteMedals（最高メダルの記録）は record.js
  // =====================================================================

  // 1PLAY の ¥ を はらう（MONEYのみ）。どのゲームも、同じ3行を 持っていたので、ここに 1つにまとめた（保存 writeSave は、呼ぶ側が これまで通り 行う）
  function chargeYen(price) { P_().money -= price; D_().played = true; D_().paid = true; }

  function buyMedals(e) {
    const p = P_();
    if (p.money < e.yen) return;
    p.money -= e.yen;
    hand += e.medals;
    D_().spent += e.yen;
    D_().bought = true;
    outOfMedalShown = false;
    // ジャラジャラ
    for (let i = 0; i < Math.min(12, e.medals); i++) beep(rand(1800, 2600), i * 0.05, 0.04, 0.03);
    noise(0.3, 0.03);
    noteMedals();
    writeSave();
    openMedalMachine();                       // 続けて買えるように画面を開いたまま
    toast('🪙 +' + e.medals + ' MEDAL');
  }

  function mgInsert(g, cost, extra) {                          // extra：追加購入（プレイ回数には数えません）
    if (cost === undefined) cost = NGC[g].betCost;
    MG_COST[g] = (MG_COST[g] || 0) + cost;
    hand -= cost;
    D_().played = true;
    if (!extra) mgDay(g).plays++;
    const r = mgRec(g);
    if (!extra) r.plays++;
    r.bet += cost;
    noteMedals();
    writeSave();
  }
  function mgSettle(g, pay, upd) {                             // 払い出しと記録。upd(o) は、今日の記録と永続記録の両方に適用します
    pay = recBonus(g, pay);
    hand += pay;
    const d = mgDay(g);
    const r = mgRec(g);
    if (pay > 0) { d.wins++; r.wins++; }
    d.bestWin = Math.max(d.bestWin, pay);
    r.bestWin = Math.max(r.bestWin, pay);
    r.paid += pay;
    if (upd) { upd(d); upd(r); }
    const m = MG_MEM[g] || (MG_MEM[g] = { plays: 0, bet: 0, pay: 0 });
    m.plays++; m.bet += MG_COST[g] || NGC[g].betCost; MG_COST[g] = 0; m.pay += pay;
    noteMedals();
    writeSave();
  }

