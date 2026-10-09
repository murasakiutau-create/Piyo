'use strict';
  // =====================================================================
  //  💎 JEWEL CHAIN（ジュエルチェイン）：7F VIDEO CORNER
  //   5色の宝石を積み、同色3個以上をつなげて消す、落ちものパズル。連鎖でスコアが大きくのび、VSでは連鎖が お邪魔石になって 相手に降る
  //   ここは ゲームロジック（盤面・消去・重力・連鎖・スコア・お邪魔石）。描画・入力・CPU とは はなれていて、画面なしで テストできる
  //   盤面は board[row][col]：row 0＝いちばん上。0＝から／1〜5＝宝石の色／9＝お邪魔石
  //   gameId＝jewel_chain（階の番号は入れない）。報酬なし・MEDAL不使用・¥100
  // =====================================================================
  const JCC = CONFIG.jewelChain;
  const JC_GARBAGE = 9;
  const jcNewBoard = () => Array.from({ length: JCC.boardH }, () => new Array(JCC.boardW).fill(0));
  const jcCopy = (b) => b.map((r) => r.slice());
  function jcMakeRng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }          // seedを指定すれば、同じピース列を再現できる
  function jcMakeGen(seed) {                                                                                             // ピースの出しかた：bag方式（5色×2＝10個を シャッフルして、2個ずつ使う）。プレイヤーにもCPUにも 同じルール
    const rng = jcMakeRng(seed); let bag = [];
    const refill = () => { bag = []; for (let c = 1; c <= JCC.colors; c++) bag.push(c, c); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; } };
    return { rng, next() { if (bag.length < 2) refill(); return { a: bag.pop(), b: bag.pop() }; } };
  }
  // ---- 消去：上下左右に つながった 同色が3個以上（斜めは つながらない）----
  function jcFindGroups(b) {
    const H = JCC.boardH; const W = JCC.boardW; const seen = Array.from({ length: H }, () => new Array(W).fill(false)); const groups = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const col = b[r][c]; if (col < 1 || col > JCC.colors || seen[r][c]) continue; const cells = []; const st = [[r, c]]; seen[r][c] = true;
      while (st.length) { const [y, x] = st.pop(); cells.push([y, x]); for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = y + dy; const nx = x + dx; if (ny < 0 || ny >= H || nx < 0 || nx >= W || seen[ny][nx] || b[ny][nx] !== col) continue; seen[ny][nx] = true; st.push([ny, nx]); } }
      if (cells.length >= JCC.clearCount) groups.push({ color: col, cells });
    }
    return groups;
  }
  function jcClearCells(b, groups) {                                                                                     // 消える宝石＋その上下左右に となりあった お邪魔石（斜めは こわさない）を、ぜんぶ 出す
    const jewels = []; const mark = new Set(); for (const g of groups) for (const [r, c] of g.cells) { jewels.push([r, c]); mark.add(r * 100 + c); }
    const garb = new Set(); for (const [r, c] of jewels) for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = r + dy; const nx = c + dx; if (ny >= 0 && ny < JCC.boardH && nx >= 0 && nx < JCC.boardW && b[ny][nx] === JC_GARBAGE) garb.add(ny * 100 + nx); }
    return { jewels, garbage: [...garb].map((k) => [Math.floor(k / 100), k % 100]) };
  }
  function jcGravity(b) {                                                                                                // 重力：下へ つめる。動いた宝石（アニメーション用）を返す
    const moves = []; for (let c = 0; c < JCC.boardW; c++) { let w = JCC.boardH - 1; for (let r = JCC.boardH - 1; r >= 0; r--) { if (b[r][c] !== 0) { if (r !== w) { b[w][c] = b[r][c]; b[r][c] = 0; moves.push({ c, from: r, to: w, v: b[w][c] }); } w--; } } } return moves;
  }
  const jcGroupBonus = (n) => JCC.score.groupBonus[Math.min(n, JCC.score.groupBonus.length - 1)] || 0;
  function jcStepScore(totalJewels, groups, chain) {                                                                     // 点数：消した数 × 100 × 連鎖の倍率（＋大きな同時消しの ボーナス）。式は ここだけ
    const S = JCC.score; const cp = S.chainPower[Math.min(chain - 1, S.chainPower.length - 1)]; const gb = groups.reduce((a, g) => a + jcGroupBonus(g.cells.length), 0); const mult = Math.max(1, cp + gb); return { score: totalJewels * S.perJewel * mult, mult };
  }
  function jcAttackTotal(chain) {                                                                                        // 連鎖ごとの お邪魔石の数（この連鎖が ここまで つづいたときの 合計）
    const T = JCC.garbage.table; if (chain < T.length) return T[chain]; return T[T.length - 1] + JCC.garbage.step * (chain - (T.length - 1));
  }
  function jcBigClearAttack(groups) { let add = 0; for (const g of groups) for (const r of JCC.garbage.bigClear) if (g.cells.length >= r.min) add = Math.max(add, r.add); return add; }                   // 大きな同時消しの ちいさな おまけ（連鎖より ずっと小さい）
  function jcStepAttack(chain, groups) { return Math.max(0, jcAttackTotal(chain) - jcAttackTotal(chain - 1)) + jcBigClearAttack(groups); }
  // ---- 連鎖を、さいごまで 解く（テスト・CPUの 先読み用。画面の演出は 別に、1段ずつ 解く）----
  function jcResolve(b) {
    const out = { chain: 0, cleared: 0, score: 0, attack: 0, garbageBroken: 0, steps: [] };
    for (;;) {
      const groups = jcFindGroups(b); if (!groups.length) break; out.chain++; const cc = jcClearCells(b, groups); const n = cc.jewels.length;
      for (const [r, c] of cc.jewels) b[r][c] = 0; for (const [r, c] of cc.garbage) b[r][c] = 0; const sc = jcStepScore(n, groups, out.chain); const at = jcStepAttack(out.chain, groups);
      out.cleared += n; out.score += sc.score; out.attack += at; out.garbageBroken += cc.garbage.length; out.steps.push({ n, sizes: groups.map((g) => g.cells.length), score: sc.score, mult: sc.mult, attack: at, garbage: cc.garbage.length }); jcGravity(b);
    }
    return out;
  }
  // ---- ピース：宝石2個（axis＝回転の中心、sat＝まわる ほう）。o：0＝satが上／1＝右／2＝下／3＝左 ----
  const JC_DR = [-1, 0, 1, 0]; const JC_DC = [0, 1, 0, -1];
  const jcSatPos = (p) => ({ r: p.r + JC_DR[p.o], c: p.c + JC_DC[p.o] });
  function jcFits(b, r, c, o) {
    const sr = r + JC_DR[o]; const sc = c + JC_DC[o]; if (c < 0 || c >= JCC.boardW || sc < 0 || sc >= JCC.boardW || r >= JCC.boardH || sr >= JCC.boardH) return false; if (r >= 0 && b[r][c] !== 0) return false; if (sr >= 0 && b[sr][sc] !== 0) return false; return true;
  }
  function jcTryRotate(b, p) {                                                                                           // 右回転90°。かべや 宝石でぶつかったら、かんたんな ずらし（wall kick）
    const no = (p.o + 1) % 4; if (jcFits(b, p.r, p.c, no)) { p.o = no; return true; }
    const kicks = no === 1 ? [[0, -1], [0, -2]] : no === 3 ? [[0, 1], [0, 2]] : no === 2 ? [[-1, 0], [0, -1], [0, 1]] : [[0, -1], [0, 1]];
    for (const [dr, dc] of kicks) if (jcFits(b, p.r + dr, p.c + dc, no)) { p.r += dr; p.c += dc; p.o = no; return true; } return false;
  }
  function jcPlace(b, p) { const s = jcSatPos(p); if (p.r >= 0) b[p.r][p.c] = p.a; if (s.r >= 0) b[s.r][s.c] = p.b; }                                                  // ピースを 固定（そのあと 重力）
  const jcHeight = (b) => { for (let r = 0; r < JCC.boardH; r++) for (let c = 0; c < JCC.boardW; c++) if (b[r][c] !== 0) return JCC.boardH - r; return 0; };                                    // いちばん高い所（段）
  const jcSpawnPiece = (pair) => ({ r: 1, c: Math.floor(JCC.boardW / 2) - 1, o: 0, a: pair.a, b: pair.b });
  function jcColHeights(b) { const h = []; for (let c = 0; c < JCC.boardW; c++) { let r = 0; while (r < JCC.boardH && b[r][c] === 0) r++; h.push(JCC.boardH - r); } return h; }
  // ---- お邪魔石を ふらせる：列に ばらけさせる（ランダム。わざと 即死させる 列は えらばない）----
  function jcGarbageColumns(n, rng) {
    const W = JCC.boardW; const counts = new Array(W).fill(Math.floor(n / W)); let rem = n % W; const cols = [...Array(W).keys()]; for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; } for (let i = 0; i < rem; i++) counts[cols[i]]++; return counts;
  }
  function jcDropGarbage(b, counts) {                                                                                    // 各列の いちばん上に つむ（盤面の外へは あふれさせない）。置けた数を返す
    let placed = 0; const moves = []; for (let c = 0; c < JCC.boardW; c++) { for (let k = 0; k < counts[c]; k++) { let r = 0; while (r < JCC.boardH && b[r][c] === 0) r++; r -= 1; if (r < 0) break; b[r][c] = JC_GARBAGE; placed++; moves.push({ c, to: r }); } } return { placed, moves };
  }
  function jcAttackApply(me, foe, amount) {                                                                              // 相殺：自分への予告が あれば、まず 相殺。あまりを 相手へ
    let use = Math.min(me.pending, amount); me.pending -= use; const sent = amount - use; if (sent > 0) foe.pending += sent; return { offset: use, sent };
  }
  // ---- 1人ぶんの 進行（プレイヤーも CPU も、これを使う）。画面なしで 動く：演出用の「出来事」を side.ev に つむだけ ----
  const JCD = { easy: 'やさしい', normal: 'ふつう', hard: 'つよい' };
  function jcNewSide(opts) {
    const gen = jcMakeGen(opts.seed); const s = { id: opts.id, board: jcNewBoard(), gen, rng: jcMakeRng((opts.seed >>> 0) + 977), queue: [], piece: null, phase: 'wait', t: 0, fallAcc: 0, lockT: 0, lockResets: 0, fast: false, rate: 1.5, score: 0, chain: 0, maxChain: 0, cleared: 0, pending: 0, over: false, noMore: false, flash: null, anim: null, ev: [], cpu: null, chars: opts.char, state: 'normal', stateT: 0, pieces: 0, lastAttack: 0, totalAttack: 0, chainScore: 0, next: 'resolve', gDrop: null };
    for (let i = 0; i < 3; i++) s.queue.push(gen.next()); return s;
  }
  const jcLanded = (s) => !jcFits(s.board, s.piece.r + 1, s.piece.c, s.piece.o);
  function jcSpawn(s) {
    if (s.noMore) { s.phase = 'done'; s.ev.push({ t: 'done' }); return; }
    const pair = s.queue.shift(); while (s.queue.length < 3) s.queue.push(s.gen.next()); const p = jcSpawnPiece(pair);
    if (!jcFits(s.board, p.r, p.c, p.o)) { s.over = true; s.phase = 'over'; s.piece = null; s.ev.push({ t: 'over' }); return; }
    s.piece = p; s.phase = 'drop'; s.fallAcc = 0; s.lockT = 0; s.lockResets = 0; s.fast = false; s.pieces++; s.ev.push({ t: 'spawn' });
  }
  function jcResetLock(s) { if (jcLanded(s) && s.lockResets < JCC.maxLockResets) { s.lockT = 0; s.lockResets++; } }
  function jcMove(s, dir) { const p = s.piece; if (s.phase !== 'drop' || !p) return false; if (jcFits(s.board, p.r, p.c + dir, p.o)) { p.c += dir; jcResetLock(s); s.ev.push({ t: 'move' }); return true; } return false; }
  function jcRotate(s) { const p = s.piece; if (s.phase !== 'drop' || !p) return false; if (jcTryRotate(s.board, p)) { jcResetLock(s); s.ev.push({ t: 'rotate' }); return true; } return false; }
  function jcFastDrop(s, on) { if (s.phase === 'drop') { if (on && !s.fast) s.ev.push({ t: 'fast' }); s.fast = !!on; } }
  function jcAnimFrom(moves) { return moves.length ? { moves, t: 0, dur: JCC.anim.fall + 0.035 * Math.max(...moves.map((m) => m.to - m.from)) } : null; }
  function jcLock(s) {
    const p = s.piece; jcPlace(s.board, p); s.piece = null; s.fast = false; s.ev.push({ t: 'lock' }); const moves = jcGravity(s.board); s.anim = jcAnimFrom(moves); s.next = 'resolve'; s.chain = 0; s.chainScore = 0; s.chainAttack = 0;
    if (s.anim) { s.phase = 'fall'; s.t = 0; } else jcResolveNext(s);
  }
  function jcResolveNext(s, foe) {                                                                                       // 連鎖を 1段ずつ：消える宝石を さがす → 光る → 消える → 落ちる → 次の段
    const groups = jcFindGroups(s.board);
    if (!groups.length) { jcEndResolve(s); return; }
    s.chain++; const cc = jcClearCells(s.board, groups); s.flash = { groups, cc, t: 0, dur: JCC.anim.flash }; s.phase = 'flash'; s.t = 0; s.ev.push({ t: 'flash', chain: s.chain, n: cc.jewels.length });
  }
  function jcApplyClear(s, foe) {
    const f = s.flash; const cc = f.cc; const n = cc.jewels.length; for (const [r, c] of cc.jewels) s.board[r][c] = 0; for (const [r, c] of cc.garbage) s.board[r][c] = 0;
    const sc = jcStepScore(n, f.groups, s.chain); const at = jcStepAttack(s.chain, f.groups); s.score += sc.score; s.chainScore += sc.score; s.cleared += n; s.maxChain = Math.max(s.maxChain, s.chain);
    let offset = 0; let sent = 0; if (at > 0) { if (foe) { const r = jcAttackApply(s, foe, at); offset = r.offset; sent = r.sent; } s.lastAttack = at; s.totalAttack += at; s.chainAttack = (s.chainAttack || 0) + at; }
    s.ev.push({ t: 'clear', chain: s.chain, n, sizes: f.groups.map((g) => g.cells.length), cells: cc.jewels.map((q) => ({ r: q[0], c: q[1], v: f.groups.find((g) => g.cells.some((z) => z[0] === q[0] && z[1] === q[1])).color })), garbage: cc.garbage, score: sc.score, mult: sc.mult, attack: at, offset, sent });
    s.flash = null; const moves = jcGravity(s.board); s.anim = jcAnimFrom(moves); s.next = 'resolve'; if (s.anim) { s.phase = 'fall'; s.t = 0; } else { s.phase = 'gap'; s.t = 0; }
  }
  function jcEndResolve(s) {
    if (s.chain > 0) s.ev.push({ t: 'chainEnd', chain: s.chain, score: s.chainScore, attack: s.chainAttack || 0 }); s.chain = 0;
    if (s.pending > 0) {                                                                                                  // 自分の操作・連鎖が 一区切りした 安全なタイミングで お邪魔石を ふらせる（1回の上限あり・あまりは 次回）
      const n = Math.min(s.pending, JCC.garbage.maxDrop); s.pending -= n; const cols = jcGarbageColumns(n, s.rng); const r = jcDropGarbage(s.board, cols);
      s.gDrop = { moves: r.moves, t: 0, dur: JCC.anim.garbageFall }; s.phase = 'gdrop'; s.t = 0; s.ev.push({ t: 'garbage', n: r.placed }); return;
    }
    s.phase = 'wait'; s.t = 0;
  }
  function jcSideUpdate(s, foe, dt) {                                                                                    // 1フレームぶん すすめる
    s.t += dt; if (s.stateT > 0) { s.stateT -= dt; if (s.stateT <= 0 && (s.state === 'attack')) s.state = 'normal'; }
    const ph = s.phase;
    if (ph === 'wait') { if (s.t >= JCC.anim.spawnDelay) jcSpawn(s); }
    else if (ph === 'drop') {
      const p = s.piece; if (!p) return; const rate = s.fast ? JCC.fall.fast : s.rate; s.fallAcc += rate * dt;
      while (s.fallAcc >= 1) { if (jcFits(s.board, p.r + 1, p.c, p.o)) { p.r++; s.fallAcc -= 1; s.lockT = 0; } else { s.fallAcc = 0; break; } }
      if (jcLanded(s)) { s.lockT += dt; if (s.lockT >= (s.fast ? JCC.lockDelayFast : JCC.lockDelay)) jcLock(s); } else s.lockT = 0;
    }
    else if (ph === 'fall') { s.anim.t += dt; if (s.anim.t >= s.anim.dur) { s.anim = null; s.phase = 'gap'; s.t = 0; } }
    else if (ph === 'gap') { if (s.t >= JCC.anim.gap) jcResolveNext(s, foe); }
    else if (ph === 'flash') { s.flash.t += dt; if (s.flash.t >= s.flash.dur) jcApplyClear(s, foe); }
    else if (ph === 'gdrop') { s.gDrop.t += dt; if (s.gDrop.t >= s.gDrop.dur) { s.gDrop = null; s.phase = 'wait'; s.t = 0; } }
  }
  // ---- CPU：現在の盤面・ピース・NEXT を見て、置き場所を えらぶ。結果は 作らない（人と同じ 操作で 置く）----
  function jcSimLand(b, c, o, pair) {                                                                                    // c列・向きoで 落としたら どうなるか（盤面のコピーに、人と同じ ルールで）
    const p = { r: 1, c, o, a: pair.a, b: pair.b }; if (!jcFits(b, p.r, p.c, p.o)) return null; while (jcFits(b, p.r + 1, p.c, p.o)) p.r++; const bb = jcCopy(b); jcPlace(bb, p); jcGravity(bb); const res = jcResolve(bb); return { board: bb, res, p };
  }
  function jcCpuEval(side, sim, P) {
    const bb = sim.board; const res = sim.res; const hs = jcColHeights(bb); const H = JCC.boardH; let v = 0;
    v += res.attack * (P.attackW + (side.pending > 0 ? P.attackW * 0.8 : 0)); v += res.chain * 14 + res.cleared * 2;
    let hp = 0; for (const h of hs) hp += h * h; v -= hp * P.heightW * 0.35; const mid = Math.max(hs[Math.floor(JCC.boardW / 2) - 1], hs[Math.floor(JCC.boardW / 2)]); if (mid >= H - 3) v -= 400 * P.dangerSense; if (mid >= H - 1) v -= 4000;
    let bump = 0; for (let i = 0; i < hs.length - 1; i++) bump += Math.abs(hs[i] - hs[i + 1]); v -= bump * 1.2;
    let adj = 0; for (let r = 0; r < H; r++) for (let c = 0; c < JCC.boardW; c++) { const x = bb[r][c]; if (x < 1 || x > JCC.colors) continue; if (c + 1 < JCC.boardW && bb[r][c + 1] === x) adj++; if (r + 1 < H && bb[r + 1][c] === x) adj++; } v += adj * P.adjW;
    return v;
  }
  function jcChainPotential(b) {                                                                                         // 1個 足したら 何連鎖に なるか（さいだい）。CPUの「連鎖を組む」目安
    let best = 0; for (let col = 1; col <= JCC.colors; col++) for (let c = 0; c < JCC.boardW; c++) { const bb = jcCopy(b); let r = JCC.boardH - 1; while (r >= 0 && bb[r][c] !== 0) r--; if (r < 0) continue; bb[r][c] = col; const res = jcResolve(bb); if (res.chain > best) best = res.chain; } return best;
  }
  function jcCpuChoose(side) {
    const P = side.cpu.P; const pair = { a: side.piece.a, b: side.piece.b }; const cands = [];
    for (let c = 0; c < JCC.boardW; c++) for (let o = 0; o < 4; o++) { const sim = jcSimLand(side.board, c, o, pair); if (!sim) continue; cands.push({ c, o, sim, v: jcCpuEval(side, sim, P) }); }
    if (!cands.length) return { c: side.piece.c, o: 0 };
    cands.sort((x, y) => y.v - x.v); const K = P.plan || P.look ? 8 : cands.length;
    if (P.plan) {
      const hNow = jcHeight(side.board); const pot0 = jcChainPotential(side.board); const keep = P.plan >= 1 && pot0 >= 2 && hNow < JCC.boardH - 5;                                      // 連鎖の 種が あるときは、1連鎖だけで 崩さない（高く なりすぎる前まで）
      for (const cd of cands.slice(0, K)) {
        const pot = jcChainPotential(cd.sim.board); cd.pot = pot; cd.v += P.planW * (pot >= 2 ? (pot - 1) * (pot - 1) : 0);
        if (keep && cd.sim.res.chain === 1) cd.v -= P.planW * (pot0 - 1) * (pot0 - 1) * 0.9;
        if (P.plan >= 2 && cd.sim.res.chain >= 2) cd.v += P.planW * cd.sim.res.chain * 1.5;
      }
    }
    if (P.look) for (const cd of cands.slice(0, K)) { const nx = side.queue[0]; let bestN = -1e9; const sub = []; for (let c = 0; c < JCC.boardW; c++) for (let o = 0; o < 4; o++) { const s2 = jcSimLand(cd.sim.board, c, o, nx); if (!s2) continue; sub.push({ s2, v2: jcCpuEval(side, s2, P) }); } sub.sort((x, y) => y.v2 - x.v2); for (const q of sub.slice(0, 5)) { let v2 = q.v2; if (P.plan) { const pt = jcChainPotential(q.s2.board); v2 += P.planW * (pt >= 2 ? (pt - 1) * (pt - 1) : 0) + (q.s2.res.chain >= 2 ? P.planW * q.s2.res.chain * 1.2 : 0); } if (v2 > bestN) bestN = v2; } if (bestN > -1e9) cd.v += 0.6 * bestN; }
    cands.sort((x, y) => y.v - x.v); let pick = cands[0];
    if (Math.random() < P.errorRate) pick = cands[Math.min(cands.length - 1, Math.floor(Math.random() * Math.min(cands.length, 8)))];                          // 人間らしい ミス：最善でない手
    else if (P.topN > 1) { const n = Math.min(P.topN, cands.length); const w = []; for (let i = 0; i < n; i++) w.push(Math.pow(0.45, i)); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < n; i++) { if (r < w[i]) { pick = cands[i]; break; } r -= w[i]; } }
    return { c: pick.c, o: pick.o };
  }
  function jcCpuAct(side, dt) {                                                                                          // CPUの「指」：考えて、1操作ずつ（人間と同じ 移動・回転・高速落下）
    const cp = side.cpu; const P = cp.P; if (side.phase !== 'drop' || !side.piece) { cp.piece = null; return; }
    if (cp.piece !== side.piece) { cp.piece = side.piece; cp.plan = jcCpuChoose(side); cp.steps = []; for (let i = 0; i < cp.plan.o; i++) cp.steps.push('r'); const dc = cp.plan.c - side.piece.c; for (let i = 0; i < Math.abs(dc); i++) cp.steps.push(dc < 0 ? 'l' : 'R'); cp.t = P.think * (0.7 + 0.6 * Math.random()); cp.done = false; }
    cp.t -= dt; if (cp.t > 0) return;
    if (cp.steps.length) { const st = cp.steps.shift(); if (st === 'r') jcRotate(side); else jcMove(side, st === 'l' ? -1 : 1); cp.t = P.actionDelay * (0.8 + 0.4 * Math.random()); }
    else if (!cp.done) { cp.done = true; if (P.softDrop) jcFastDrop(side, true); }
  }
  function jcSimVs(lvA, lvB, seed, maxSec) {                                                                             // テスト用：CPU同士を 画面なしで たたかわせる（強さの ちがい・ハマり・クラッシュの 確認）
    const A = jcNewSide({ id: 'A', seed: seed * 2 + 1 }); const B = jcNewSide({ id: 'B', seed: seed * 2 + 2 }); A.cpu = { P: JCC.cpu[lvA] }; B.cpu = { P: JCC.cpu[lvB] }; const dt = 1 / 30; let t = 0; const stat = { chainA: [], chainB: [] };
    while (t < (maxSec || 600)) {
      t += dt; const rate = JCC.fall.vsStart + (JCC.fall.vsEnd - JCC.fall.vsStart) * Math.min(1, t / JCC.fall.vsRampSec); A.rate = rate; B.rate = rate;
      jcCpuAct(A, dt); jcCpuAct(B, dt); jcSideUpdate(A, B, dt); jcSideUpdate(B, A, dt);
      for (const e of A.ev) if (e.t === 'chainEnd') stat.chainA.push(e.chain); for (const e of B.ev) if (e.t === 'chainEnd') stat.chainB.push(e.chain); A.ev.length = 0; B.ev.length = 0;
      if (A.over || B.over) break;
    }
    return { winner: A.over && B.over ? 'draw' : A.over ? 'B' : B.over ? 'A' : 'time', time: +t.toFixed(1), A: { score: A.score, maxChain: A.maxChain, cleared: A.cleared, atk: A.totalAttack, pieces: A.pieces }, B: { score: B.score, maxChain: B.maxChain, cleared: B.cleared, atk: B.totalAttack, pieces: B.pieces }, stat };
  }
  // ---- 筐体・キャラクター・宝石の見た目 ----
  const JC_MACHINE = { machineId: 'jc_jewelchain', machineName: 'JEWEL CHAIN', label: 'JEWEL CHAIN', isUnlocked: true, gameType: 'jewelChain', jc: true };
  const JC_CHARS = [
    { id: 'ruby', name: 'RUBY', jp: 'ルビー', col: '#ff5a6a', desc: '元気いっぱいの 女の子。\nショートカットの 赤いリボン！' },
    { id: 'sapphire', name: 'SAPPHIRE', jp: 'サファイア', col: '#5a8aff', desc: 'クールで 知的な メガネの男の子。\n青いチェックの ズボン。' },
    { id: 'topaz', name: 'TOPAZ', jp: 'トパーズ', col: '#ffc84a', desc: 'おそろいの 幼い双子。\n明るくて 無邪気！' },
    { id: 'emerald', name: 'EMERALD', jp: 'エメラルド', col: '#4acf7a', desc: 'おっとり マイペースな 男の子。\n目が かくれてる…？' },
    { id: 'amethyst', name: 'AMETHYST', jp: 'アメジスト', col: '#b46aff', desc: 'ミステリアスで 大人っぽい 女の子。\nロングヘアが きれい。' }
  ];
  const JC_PAL = { 1: { base: '#e0283c', dark: '#5a0a18', light: '#ff9aa6' }, 2: { base: '#2c66e8', dark: '#0c2a78', light: '#9ec0ff' }, 3: { base: '#f4c424', dark: '#7a5806', light: '#fff3a0' }, 4: { base: '#22b85a', dark: '#0a5a2a', light: '#a0ffc0' }, 5: { base: '#a03ee8', dark: '#481a86', light: '#e0acff' } };
  const JC_SHAPE = {                                                                                                     // 色だけで 区別しない：宝石ごとに 形が ちがう（赤＝角ばった八角／青＝ひし形／黄＝まるい／緑＝四角寄り／紫＝たてながの六角）
    1: [[-0.5, -1], [0.5, -1], [1, -0.5], [1, 0.5], [0.5, 1], [-0.5, 1], [-1, 0.5], [-1, -0.5]],
    2: [[0, -1], [1, 0], [0, 1], [-1, 0]],
    3: [[0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7]],
    4: [[-0.7, -1], [0.7, -1], [0.95, -0.7], [0.95, 0.7], [0.7, 1], [-0.7, 1], [-0.95, 0.7], [-0.95, -0.7]],
    5: [[0, -1], [0.72, -0.5], [0.72, 0.5], [0, 1], [-0.72, 0.5], [-0.72, -0.5]]
  };
  const JC_IMG = {};
  function jcImg(id, st) { const k = id + '_' + st; if (!JC_IMG[k]) { const im = new Image(); im.src = 'assets/jewelchain/' + k + '.webp'; JC_IMG[k] = im; } return JC_IMG[k]; }
  function jcSprite(id, st, x, y, w, h, flip) {                                                                           // 立ち絵：枠の中に、たて横比を そのまま ひろげる
    const im = jcImg(id, st); if (!im.complete || !im.naturalWidth) return; const k = Math.min(w / im.naturalWidth, h / im.naturalHeight); const dw = im.naturalWidth * k; const dh = im.naturalHeight * k;
    ctx.save(); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; if (flip) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, y + h - dh, dw, dh); } else ctx.drawImage(im, x + (w - dw) / 2, y + h - dh, dw, dh); ctx.imageSmoothingEnabled = sm; ctx.restore();
  }
  const JC = { phase: 'select', t: 0, clock: 0, mode: 'solo', charIdx: 0, diff: 'normal', cpuIdx: 1, player: null, cpu: null, elapsed: 0, banner: '', bannerSub: '', bannerT: 0, chainPop: null, cutin: null, parts: [], inp: null, result: null, paying: false, newRecord: false, endKind: '', sel: 0, shake: 0, gallery: 0, simBusy: false,
    dev: { seed: 0, cpuChar: null, fallScale: 1, showNext: false, think: false, lock: null } };
  const jcFallRate = (t) => { const F = JCC.fall; if (JC.mode === 'solo') return (F.soloStart + (F.soloEnd - F.soloStart) * Math.pow(clamp(t / JCC.soloTime, 0, 1), F.soloCurve)) * JC.dev.fallScale; return (F.vsStart + (F.vsEnd - F.vsStart) * clamp(t / F.vsRampSec, 0, 1)) * JC.dev.fallScale; };
  // ---- 宝石の描画 ----
  function jcJewel(v, x, y, S, o) {
    o = o || {}; if (v === JC_GARBAGE) { jcStone(x, y, S, o); return; } const P = JC_PAL[v]; if (!P) return; const sc = o.scale == null ? 1 : o.scale; const h = (S / 2 - 0.5) * sc; const cx = Math.round(x + S / 2); const cy = Math.round(y + S / 2);
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha; ctx.translate(cx, cy); const poly = (pts, k, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach((p, i) => { const px2 = Math.round(p[0] * h * k * 2) / 2; const py2 = Math.round(p[1] * h * k * 2) / 2; if (i) ctx.lineTo(px2, py2); else ctx.moveTo(px2, py2); }); ctx.closePath(); ctx.fill(); };
    const mix = o.mix || 0; const base = mix ? mixHex(P.base, '#ffffff', mix) : P.base; const light = mix ? mixHex(P.light, '#ffffff', mix) : P.light; const sh = JC_SHAPE[v];
    poly(sh, 1, P.dark); poly(sh, S >= 12 ? 0.82 : 0.7, base);
    if (S >= 12) { poly(sh, 0.5, light); poly(sh, 0.3, base); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(-h * 0.45), Math.round(-h * 0.55), Math.max(1, Math.round(S / 9)), Math.max(1, Math.round(S / 9))); }
    else { ctx.fillStyle = light; ctx.fillRect(Math.round(-h * 0.4), Math.round(-h * 0.45), Math.max(1, Math.round(S / 6)), Math.max(1, Math.round(S / 6))); }
    ctx.restore();
  }
  function jcStone(x, y, S, o) {                                                                                         // お邪魔石：ひび割れた 灰色の石（宝石とは ちがう）
    ctx.save(); if (o.alpha != null) ctx.globalAlpha = o.alpha; const sc = o.scale == null ? 1 : o.scale; const d = S * sc; const px2 = Math.round(x + (S - d) / 2); const py2 = Math.round(y + (S - d) / 2); const w = Math.round(d) - 1;
    ctx.fillStyle = '#2e323c'; ctx.fillRect(px2, py2, w + 1, w + 1); ctx.fillStyle = '#7e8490'; ctx.fillRect(px2 + 1, py2 + 1, w - 1, w - 1); ctx.fillStyle = '#a4aab6'; ctx.fillRect(px2 + 1, py2 + 1, w - 1, Math.max(1, Math.round(S / 10))); ctx.fillRect(px2 + 1, py2 + 1, Math.max(1, Math.round(S / 10)), w - 1); ctx.fillStyle = '#5a5f6c'; ctx.fillRect(px2 + 1, py2 + w - Math.max(1, Math.round(S / 10)) + 1, w - 1, Math.max(1, Math.round(S / 10)));
    if (S >= 12) { ctx.fillStyle = '#2e323c'; const k = S / 20; const seg = [[0.5, 0.15], [0.42, 0.3], [0.55, 0.42], [0.47, 0.56], [0.6, 0.7], [0.52, 0.85]]; for (let i = 0; i < seg.length - 1; i++) ctx.fillRect(px2 + Math.round(seg[i][0] * d), py2 + Math.round(seg[i][1] * d), Math.max(1, Math.round(k)), Math.max(2, Math.round(0.16 * d))); }
    else { ctx.fillStyle = '#2e323c'; ctx.fillRect(px2 + Math.floor(w / 2), py2 + 1, 1, Math.max(2, w - 2)); }
    ctx.restore();
  }
  const jcEase = (x) => { const t = clamp(x, 0, 1); return t * t; };
  function jcBoardDraw(s, x, y, cell, o) {                                                                               // 盤面を描く（落ちてくる ピース・消える光・お邪魔の落下も）
    o = o || {}; const Wc = JCC.boardW; const Hc = JCC.boardH; const pw = Wc * cell; const ph = Hc * cell; const pinch = jcHeight(s.board) >= JCC.pinchHeight;
    rect(x - 2, y - 2, pw + 4, ph + 4, pinch ? '#a0384a' : '#5a4a9a'); rect(x - 2, y - 2, pw + 4, 1, pinch ? '#ff8a9a' : '#9a8ae0'); rect(x, y, pw, ph, '#0e0a22');
    if (!o.mini) { ctx.globalAlpha = 0.12; for (let c = 1; c < Wc; c++) rect(x + c * cell, y, 1, ph, '#8a7aff'); for (let r = 1; r < Hc; r++) rect(x, y + r * cell, pw, 1, '#8a7aff'); ctx.globalAlpha = 1; }
    if (pinch) { ctx.globalAlpha = 0.14; rect(x, y, pw, cell * 3, '#ff3a50'); ctx.globalAlpha = 1; }                                                      // ピンチ：上の3段に、ぼんやり赤（点滅は しない）
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, pw, ph); ctx.clip();
    const fall = new Map(); if (s.anim) for (const m of s.anim.moves) fall.set(m.to * 10 + m.c, m.from); const gd = new Map(); if (s.gDrop) for (const m of s.gDrop.moves) gd.set(m.to * 10 + m.c, 1);
    const fk = new Set(); if (s.flash) for (const q of s.flash.cc.jewels) fk.add(q[0] * 10 + q[1]); for (const q of (s.flash ? s.flash.cc.garbage : [])) fk.add(q[0] * 10 + q[1]);
    for (let r = 0; r < Hc; r++) for (let c = 0; c < Wc; c++) {
      const v = s.board[r][c]; if (!v) continue; const key = r * 10 + c; let yy = y + r * cell; const op = {};
      if (fall.has(key)) { const e = jcEase(s.anim.t / s.anim.dur); const from = fall.get(key); yy = y + (from + (r - from) * e) * cell; }
      if (gd.has(key)) { const e = jcEase(s.gDrop.t / s.gDrop.dur); yy = y + (r - (r + 2) * (1 - e)) * cell; }
      if (fk.has(key)) { const p = clamp(s.flash.t / s.flash.dur, 0, 1); op.mix = 0.15 + 0.65 * p; op.scale = 1 - 0.3 * p * p; op.alpha = 1 - 0.35 * p * p; }                                       // 光って、ちいさく くだける（なめらか。チカチカしない）
      jcJewel(v, x + c * cell, yy, cell, op);
    }
    const p = s.piece;
    if (p && s.phase === 'drop') {
      const landed = jcLanded(s); const off = landed ? 0 : clamp(s.fallAcc, 0, 0.999) * cell; const sat = jcSatPos(p);
      if (!o.mini && o.ghost) { let gr = p.r; while (jcFits(s.board, gr + 1, p.c, p.o)) gr++; const gs = { r: gr + JC_DR[p.o], c: p.c + JC_DC[p.o] }; if (gr !== p.r) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x + p.c * cell + 1.5, y + gr * cell + 1.5, cell - 3, cell - 3); ctx.strokeRect(x + gs.c * cell + 1.5, y + gs.r * cell + 1.5, cell - 3, cell - 3); ctx.globalAlpha = 1; } }
      jcJewel(p.a, x + p.c * cell, y + p.r * cell + off, cell); jcJewel(p.b, x + sat.c * cell, y + sat.r * cell + off, cell);
    }
    ctx.restore();
    if (s.over) { ctx.globalAlpha = 0.45; rect(x, y, pw, ph, '#1a1030'); ctx.globalAlpha = 1; }
  }
  function jcPairDraw(pair, cx, y, cell) { jcJewel(pair.b, cx - cell / 2, y, cell); jcJewel(pair.a, cx - cell / 2, y + cell, cell); }
  function jcLayout() { const cell = 19; const bx = 10; const by = 28; const px2 = bx + JCC.boardW * cell + 6; return { cell, bx, by, px: px2, pw: W - 8 - px2, bottom: by + JCC.boardH * cell }; }
  // ---- 効果：かけら・連鎖の表示・カットイン ----
  function jcBurst(L, cells, mini, who) { const cell = mini ? 8 : L.cell; const ox = mini ? who.mx : L.bx; const oy = mini ? who.my : L.by; for (const c of cells) { const n = mini ? 1 : 3; for (let i = 0; i < n; i++) { if (JC.parts.length > 90) break; const pal = JC_PAL[c.v] || { light: '#ffffff' }; JC.parts.push({ x: ox + (c.c + 0.5) * cell, y: oy + (c.r + 0.5) * cell, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 50, life: 0.5 + Math.random() * 0.2, t: 0, col: pal.light, s: mini ? 1 : 2 }); } } }
  function jcSfxClear(chain) { const notes = [523, 587, 659, 784, 880, 988, 1175, 1319, 1568]; const f = notes[Math.min(chain - 1, notes.length - 1)]; noise(0.06, 0.05); beep(f, 0, 0.1, 0.07, 'triangle'); beep(f * 1.5, 0.05, 0.12, 0.05, 'triangle'); if (chain >= 2) beep(f * 2, 0.1, 0.1, 0.04, 'square'); if (chain >= 4) { [f, f * 1.25, f * 1.5, f * 2].forEach((q, i) => beep(q, 0.12 + i * 0.05, 0.14, 0.05, 'triangle')); } }          // パリン！連鎖ほど 高く・厚く
  function jcHandleEvents(s, who) {
    const L = jcLayout(); const mini = who === 'c'; const me = who === 'p';
    for (const e of s.ev) {
      if (e.t === 'rotate' && me) beep(900, 0, 0.03, 0.04, 'square');
      else if (e.t === 'move' && me) beep(520, 0, 0.015, 0.02, 'square');
      else if (e.t === 'fast' && me) beep(260, 0, 0.04, 0.03, 'sawtooth');
      else if (e.t === 'lock') { if (me) { beep(170, 0, 0.06, 0.06, 'triangle'); noise(0.03, 0.03); } }
      else if (e.t === 'clear') {
        jcBurst(L, e.cells, mini, { mx: JC.mini ? JC.mini.x : 0, my: JC.mini ? JC.mini.y : 0 }); if (me || e.chain >= 2) jcSfxClear(e.chain); if (me) { if (e.chain >= 2) JC.chainPop = { n: e.chain, t: 1.0, who: 'p' }; if (e.chain >= 3) { s.state = 'attack'; s.stateT = 1.3; } if (e.chain >= 4) { JC.cutin = { who: 'p', t: 1.0, char: s.chars }; JC.shake = 0.25; } } else { if (e.chain >= 2) JC.chainPop = { n: e.chain, t: 1.0, who: 'c' }; if (e.chain >= 3) { s.state = 'attack'; s.stateT = 1.3; } if (e.chain >= 4) JC.cutin = { who: 'c', t: 1.0, char: s.chars }; }
        if (e.sent > 0) { beep(300, 0, 0.12, 0.06, 'sawtooth', 600); } if (e.offset > 0) { beep(880, 0, 0.08, 0.06, 'triangle'); beep(1175, 0.06, 0.1, 0.05, 'triangle'); }                                   // お邪魔を送った／相殺
        if (e.garbage && e.garbage.length && me) beep(240, 0.03, 0.06, 0.04, 'square');
      }
      else if (e.t === 'garbage') { s.hurt = 0.9; noise(0.22, 0.07); beep(110, 0, 0.18, 0.08, 'sawtooth'); beep(80, 0.06, 0.2, 0.07, 'square'); JC.shake = Math.max(JC.shake, 0.18); }
      else if (e.t === 'over') { if (me || !JC.cpu) { [440, 370, 311, 247].forEach((f, i) => beep(f, i * 0.12, 0.2, 0.06, 'sine')); } }
    }
    s.ev.length = 0;
  }
  // ---- ゲームの流れ ----
  const jcCredit = () => (P_().jewelChain.credit | 0);
  const jcHome = () => (jcCredit() > 0 ? 'select' : 'coin');
  function jcInsert() {                                                                                                  // 先に ¥100：コインを入れてから、あそび方を えらぶ（連打しても 1回ぶん）
    if (JC.paying || jcCredit() > 0) return; if (P_().money < JCC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    JC.paying = true; P_().money -= JCC.price; P_().jewelChain.credit = 1; D_().played = true; D_().paid = true; P_().jewelChain.totalPlays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); JC.phase = 'select'; JC.sel = 0; JC.paying = false;
  }
  function jcPay() {                                                                                                     // 結果画面の「もういちど」：¥100 を入れて、おなじ設定で すぐ はじめる
    if (JC.paying || JC.phase === 'intro' || JC.phase === 'ready' || JC.phase === 'play') return; if (P_().money < JCC.price) { toast('おかねが たりない！'); beep(200, 0, 0.12, 0.05, 'sawtooth', 120); return; }
    JC.paying = true; chargeYen(JCC.price); P_().jewelChain.totalPlays++; writeSave(); beep(1760, 0, 0.05, 0.05); beep(2349, 0.05, 0.14, 0.05); jcStartGame(); JC.paying = false;
  }
  function jcGo() {                                                                                                      // えらびおわり：（コインは もう入っている）初回だけ チュートリアル
    if (jcCredit() <= 0 || JC.phase === 'intro' || JC.phase === 'ready' || JC.phase === 'play') return;
    if (!P_().jewelChain.tutorialSeen) { JC.phase = 'tut'; JC.tutPage = 0; JC.sel = 0; beep(880, 0, 0.05, 0.04, 'square'); return; } jcBegin();
  }
  function jcBegin() { if (jcCredit() <= 0) return; P_().jewelChain.credit = 0; writeSave(); beep(1568, 0, 0.08, 0.05); jcStartGame(); }
  function jcTutEnd() { P_().jewelChain.tutorialSeen = true; writeSave(); jcBegin(); }
  function jcStartGame() {
    const seed = JC.dev.seed || ((Math.random() * 4294967295) >>> 0); JC.player = jcNewSide({ id: 'P', seed, char: JC_CHARS[JC.charIdx].id });
    if (JC.mode === 'vs') { const others = JC_CHARS.map((c, i) => i).filter((i) => i !== JC.charIdx); JC.cpuIdx = JC.dev.cpuChar != null && JC.dev.cpuChar !== JC.charIdx ? JC.dev.cpuChar : others[Math.floor(Math.random() * others.length)]; JC.cpu = jcNewSide({ id: 'C', seed: (seed + 1) >>> 0, char: JC_CHARS[JC.cpuIdx].id }); JC.cpu.cpu = { P: JCC.cpu[JC.diff] }; }       // CPUのキャラは、自分以外から ランダム。強さは 難易度だけで 決まる
    else JC.cpu = null;
    JC.elapsed = 0; JC.phase = 'intro'; JC.t = 0; JC.result = null; JC.newRecord = false; JC.parts = []; JC.chainPop = null; JC.cutin = null; JC.endKind = ''; JC.banner = ''; JC.bannerT = 0; JC.inp = null; JC.lastPieceAnnounced = false;
  }
  function jcFinish(kind) {
    if (JC.phase === 'finish' || JC.phase === 'result') return; JC.phase = 'finish'; JC.t = 0; JC.endKind = kind; const rec = P_().jewelChain; const P = JC.player;
    if (JC.mode === 'solo') {
      JC.result = { score: P.score, maxChain: P.maxChain, cleared: P.cleared }; if (P.score > rec.soloBestScore) { rec.soloBestScore = P.score; JC.newRecord = P.score > 0; } if (P.maxChain > rec.soloBestChain) rec.soloBestChain = P.maxChain; JC.best = { score: rec.soloBestScore, chain: rec.soloBestChain };
      JC.banner = kind === 'timeup' ? 'TIME UP!' : 'GAME OVER'; if (kind === 'timeup') [988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); if (JC.newRecord) [1047, 1319, 1568, 2093].forEach((f, i) => beep(f, 0.5 + i * 0.09, 0.14, 0.05));
    } else {
      if (kind === 'win') { rec.vsWins++; P.state = 'win'; JC.cpu.state = 'lose'; JC.banner = 'YOU WIN!'; [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.1, 0.16, 0.06, 'triangle')); }
      else if (kind === 'lose') { rec.vsLosses++; P.state = 'lose'; JC.cpu.state = 'win'; JC.banner = 'YOU LOSE'; [392, 330, 262, 196].forEach((f, i) => beep(f, i * 0.12, 0.2, 0.05, 'sine')); }
      else { P.state = 'lose'; JC.cpu.state = 'lose'; JC.banner = 'DRAW'; [523, 523, 659].forEach((f, i) => beep(f, i * 0.12, 0.16, 0.05, 'triangle')); }
      P.stateT = 99; JC.cpu.stateT = 99; JC.result = { kind, scoreP: P.score, scoreC: JC.cpu.score, maxP: P.maxChain, maxC: JC.cpu.maxChain };
    }
    writeSave();
  }
  function jcTimeoutDecide() {                                                                                           // 10分の安全タイマー：危険度 → スコア → 消した数。同じなら 引き分け（いきなり 負けには しない）
    const P = JC.player; const C = JC.cpu; const hp = jcHeight(P.board); const hc = jcHeight(C.board); if (hp !== hc) return hp < hc ? 'win' : 'lose'; if (P.score !== C.score) return P.score > C.score ? 'win' : 'lose'; if (P.cleared !== C.cleared) return P.cleared > C.cleared ? 'win' : 'lose'; return 'draw';
  }
  function jcUpdate(dt) {
    JC.clock += dt; dt = Math.min(dt, 0.05); JC.t += dt; if (JC.bannerT > 0) JC.bannerT -= dt; if (JC.shake > 0) JC.shake -= dt; if (JC.chainPop && (JC.chainPop.t -= dt) <= 0) JC.chainPop = null; if (JC.cutin && (JC.cutin.t -= dt) <= 0) JC.cutin = null;
    for (const p of JC.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; } JC.parts = JC.parts.filter((p) => p.t < p.life);
    const ph = JC.phase; JC.sel += dt; if (ph === 'coin' || ph === 'select' || ph === 'char' || ph === 'diff' || ph === 'tut' || ph === 'result' || ph === 'gallery') return;
    if (ph === 'intro') { if (JC.t >= (JC.mode === 'vs' ? 1.7 : 0.3)) { JC.phase = 'ready'; JC.t = 0; beep(660, 0, 0.1, 0.05, 'square'); } return; }
    if (ph === 'ready') { if (JC.t >= 1.0 && !JC.startBeep) { JC.startBeep = true; beep(1320, 0, 0.2, 0.07, 'square'); } if (JC.t >= 1.6) { JC.startBeep = false; JC.phase = 'play'; JC.t = 0; } return; }
    if (ph === 'finish') { jcPieceUpkeep(dt); if (JC.t >= 2.0) { JC.phase = 'result'; JC.t = 0; } return; }
    JC.elapsed += dt; const P = JC.player; const C = JC.cpu; P.rate = jcFallRate(JC.elapsed); if (C) C.rate = P.rate;
    if (C) jcCpuAct(C, dt); jcSideUpdate(P, C, dt); if (C) jcSideUpdate(C, P, dt); jcHandleEvents(P, 'p'); if (C) jcHandleEvents(C, 'c');
    for (const s of [P, C]) if (s && s.hurt > 0) s.hurt -= dt;
    for (const s of [P, C]) if (s) { if (s.state === 'normal' && jcHeight(s.board) >= JCC.pinchHeight && !s.over) s.pinch = true; else if (jcHeight(s.board) < JCC.pinchHeight - 1) s.pinch = false; }
    if (JC.mode === 'solo') {
      const left = JCC.soloTime - JC.elapsed; if (left <= 0 && !P.noMore) { P.noMore = true; JC.lastPiece = true; }                                              // 0:00 → いま操作中の ピースが さいごのピース（消さない）。連鎖が おわるまで 有効
      if (P.over) jcFinish('gameover'); else if (P.phase === 'done') jcFinish('timeup');
    } else {
      const po = P.over; const co = C.over; if (po || co) jcFinish(po && co ? 'draw' : po ? 'lose' : 'win'); else if (JC.elapsed >= JCC.vsSafety) jcFinish(jcTimeoutDecide());
    }
  }
  function jcPieceUpkeep(dt) { /* 結果の演出中は、盤面を動かさない */ }
  // ---- 入力：左右ドラッグ＝横移動／タップ＝右回転／下スワイプ＝高速落下 ----
  function jcPointer(e, p) {
    if (JC.phase === 'char') { const R = jcCharRects(); for (let i = 0; i < R.length; i++) if (inRect(p, R[i])) { if (JC.charIdx !== i) beep(880, 0, 0.04, 0.04, 'square'); JC.charIdx = i; return; } return; }
    if (JC.phase === 'gallery') { JC.gallery = (JC.gallery + 1) % 5; return; }
    if (JC.phase !== 'play' || JC.inp) return; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } JC.inp = { id: e.pointerId, x0: p.x, y0: p.y, lx: p.x, t0: performance.now(), acc: 0, moved: false, fast: false };
  }
  function jcPointerMove(e, p) {
    const I = JC.inp; if (!I || I.id !== e.pointerId || JC.phase !== 'play') return; const IN = JCC.input; I.acc += p.x - I.lx; I.lx = p.x;
    while (Math.abs(I.acc) >= IN.dragThreshold) { const d = I.acc > 0 ? 1 : -1; jcMove(JC.player, d); I.acc -= d * IN.dragThreshold; I.moved = true; }                                  // 一定きょり うごいたら 1マス（ゆびの ふるえでは うごかない）
    const dy = p.y - I.y0; if (!I.fast && dy >= IN.swipeThreshold && dy > Math.abs(p.x - I.x0)) { I.fast = true; I.moved = true; jcFastDrop(JC.player, true); }
  }
  function jcPointerUp(e) {
    const I = JC.inp; if (!I || I.id !== e.pointerId) return; JC.inp = null; if (JC.phase !== 'play') return; if (I.fast) { jcFastDrop(JC.player, false); return; }
    if (!I.moved && !I.far && (performance.now() - I.t0) / 1000 <= JCC.input.tapTime) jcRotate(JC.player);                                                  // タップ＝右に90°
  }
  function jcPointerMoveTrack(e, p) { const I = JC.inp; if (I && I.id === e.pointerId && Math.hypot(p.x - I.x0, p.y - I.y0) > JCC.input.tapMax) I.far = true; jcPointerMove(e, p); }
  window.addEventListener('keydown', (ev) => {                                                                           // パソコンで 試す用：矢印キー（← →＝移動／↑・スペース＝回転／↓＝高速落下）
    if (scene !== 'machine' || !currentMachine || currentMachine.gameType !== 'jewelChain' || JC.phase !== 'play') return; const k = ev.key;
    if (k === 'ArrowLeft') { jcMove(JC.player, -1); ev.preventDefault(); } else if (k === 'ArrowRight') { jcMove(JC.player, 1); ev.preventDefault(); } else if (k === 'ArrowUp' || k === ' ') { jcRotate(JC.player); ev.preventDefault(); } else if (k === 'ArrowDown') { jcFastDrop(JC.player, true); ev.preventDefault(); }
  });
  window.addEventListener('keyup', (ev) => { if (scene === 'machine' && currentMachine && currentMachine.gameType === 'jewelChain' && ev.key === 'ArrowDown') jcFastDrop(JC.player, false); });
  // ---- 画面：メニュー・プレイ中・結果 ----
  const jcCharRects = () => { const gap = 3; const w = Math.floor((W - 24 - gap * 4) / 5); const out = []; for (let i = 0; i < 5; i++) out.push({ x: 12 + i * (w + gap), y: 34, w, h: 54 }); return out; };
  function jcBg() {
    drawFrame(); rect(8, 8, W - 16, H - 16, '#120a2a'); for (let y = 8; y < H - 8; y += 2) rect(8, y, W - 16, 1, mixHex('#201046', '#0a0620', (y - 8) / (H - 16)));
    ctx.globalAlpha = 0.07; for (let y = 14; y < H - 10; y += 24) for (let x = 12 + ((y / 24) % 2 ? 12 : 0); x < W - 12; x += 24) { ctx.fillStyle = '#b08aff'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.fill(); } ctx.globalAlpha = 1; rect(8, 8, W - 16, 2, '#a06aff');
  }
  function jcLogo(cy, sc) { drawTextCenter('JEWEL', W / 2, cy, '#ffffff', sc, '#6a2ad0'); drawTextCenter('CHAIN', W / 2, cy + sc * 6, '#ffe070', sc, '#a0481a'); }
  function jcGemRow(cy, size) { const n = 5; const gap = size + 4; const x0 = W / 2 - (n * gap - 4) / 2; for (let i = 1; i <= n; i++) jcJewel(i, x0 + (i - 1) * gap, cy + Math.sin(JC.sel * 2 + i) * 2, size); }
  function jcDrawSelect() {
    jcBg(); rect(16, 16, W - 32, 74, '#08041a'); rect(16, 16, W - 32, 2, '#a06aff'); rect(16, 88, W - 32, 2, '#a06aff'); jcLogo(24, 3); jcGemRow(66, 16);
    const chs = JC_CHARS; const cw = Math.floor((W - 24) / 5); for (let i = 0; i < 5; i++) { const x = 12 + i * cw; jcSprite(chs[i].id, 'normal', x, 102, cw - 2, 96); }
    rect(16, 206, W - 32, 34, '#1a1038'); rect(16, 206, W - 32, 1, '#6a4ad0'); drawTextCenter('BEST SCORE', W / 2, 211, '#b0a0ff', 1); drawTextCenter(String(P_().jewelChain.soloBestScore), W / 2, 221, '#ffe070', 2); if (JC.phase === 'coin') { drawTextCenter('INSERT COIN', W / 2, 246, '#ffe070', 1); drawTextCenter('YEN ' + P_().money + '    1 PLAY  YEN ' + JCC.price, W / 2, 256, '#a8b8ff', 1); }
    else { drawTextCenter('CREDIT 1', W / 2, 246, '#7dff8a', 1); drawTextCenter('YEN ' + P_().money, W / 2, 256, '#a8b8ff', 1); }
  }
  function jcDrawChar() {
    jcBg(); drawTextCenter(JC.mode === 'vs' ? 'VS CPU' : 'SOLO', W / 2, 14, '#b0a0ff', 1); drawTextCenter('CHARACTER SELECT', W / 2, 22, '#ffffff', 1, '#4a2a9a'); const R = jcCharRects();
    R.forEach((r, i) => { const on = i === JC.charIdx; rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, on ? '#ffe070' : '#3a2a6a'); rect(r.x, r.y, r.w, r.h, on ? '#3a2a7a' : '#1a1038'); jcSprite(JC_CHARS[i].id, 'normal', r.x, r.y + 2, r.w, r.h - 2); });
    const c = JC_CHARS[JC.charIdx]; ctx.globalAlpha = 0.25; ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(W / 2, 168, 62, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; jcSprite(c.id, JC.sel % 3 < 1.5 ? 'normal' : 'normal', W / 2 - 54, 94, 108, 162); drawTextCenter(c.name, W / 2, 262, c.col, 2, '#0a0420');
  }
  function jcDrawDiff() {
    jcBg(); const me = JC_CHARS[JC.charIdx]; jcSprite(me.id, 'normal', 10, 24, 70, 105); jcSprite(me.id, 'normal', 10, 24, 0, 0); drawTextCenter('VS', W / 2 + 6, 62, '#ffe070', 3, '#a0481a'); ctx.globalAlpha = 0.9; drawTextCenter('?', W - 46, 62, '#8a7ac0', 5); ctx.globalAlpha = 1; drawTextCenter(me.name, 46, 132, me.col, 1, '#0a0420'); drawTextCenter('CPU', W - 46, 132, '#b0a0ff', 1);
  }
  function jcDrawStageSprite(side, x, y, w, h, flip) {                                                                    // キャラの差分：ふつう／こうげき／ピンチ／ダメージ
    let st = side.state; if (st === 'normal' && (side.pinch || side.hurt > 0)) st = 'pinch'; else if (st === 'attack' && side.hurt > 0) st = 'pinch';
    const cut = JC.cutin && JC.cutin.char === side.chars && JC.cutin.t > 0 ? Math.min(1, JC.cutin.t * 3) : 0; const k = 1 + 0.3 * cut; const sh = side.hurt > 0 ? Math.round(Math.sin(JC.clock * 50) * 1.5) : 0;
    if (cut > 0) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.6, h * 0.42, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
    jcSprite(side.chars, st, x + sh - (k - 1) * w / 2, y - (k - 1) * h, w * k, h * k, flip);
  }
  function jcDon(cx, cy, n) {                                                                                          // 4連鎖以上：ドン！（ふとい字で、ひとつ ふくらむだけ。点滅しない）
    const a = JC.cutin; if (!a || a.t <= 0) return; const p = Math.min(1, (1 - a.t) * 6); const sc = 0.7 + 0.5 * Math.min(1, p) - (a.t < 0.3 ? (0.3 - a.t) * 0.8 : 0); ctx.save(); ctx.globalAlpha = Math.min(1, a.t * 3); ctx.translate(cx, cy); ctx.rotate(-0.12); ctx.scale(sc, sc);
    ctx.font = '900 26px "Hiragino Sans","Noto Sans JP",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#2a0a3a'; ctx.strokeText('ドン！', 0, 0); ctx.fillStyle = n >= 5 ? '#ff7ab8' : '#ffd24a'; ctx.fillText('ドン！', 0, 0); ctx.restore();
  }
  function jcNextStrip(q, x, label, col) { drawText(label, x, 14, col, 1, '#0a0420'); const cx = x + textWidth(label, 1) + 10; jcPairDraw(q[0], cx, 9, 8); jcPairDraw(q[1], cx + 13, 9, 8); }
  function jcDrawPlay() {
    const L = jcLayout(); jcBg(); const P = JC.player; const C = JC.cpu; const vs = JC.mode === 'vs'; const px2 = L.px; const pw = L.pw; const bwid = JCC.boardW * L.cell; const bandY = L.bottom + 6; const bandH = H - 12 - bandY;
    ctx.save(); if (JC.shake > 0) ctx.translate(Math.round(Math.sin(JC.clock * 40) * 1.5 * (JC.shake / 0.25)), 0);
    jcBoardDraw(P, L.bx, L.by, L.cell, { ghost: true });
    jcNextStrip(P.queue, L.bx, 'NEXT', '#b0a0ff');                                                                       // 自分のNEXT：盤面の左上
    if (vs) { const pend = P.pending; if (pend > 0) { const n = Math.min(pend, 6); for (let i = 0; i < n; i++) jcStone(L.bx + 66 + i * 6, 12, 5, {}); drawText('X' + pend, L.bx + 68 + n * 6, 13, '#ffe070', 1, '#0a0420'); } }
    if (!vs) {
      rect(px2, 14, pw, 36, '#1a1038'); rect(px2, 14, pw, 1, '#6a4ad0'); const left = Math.max(0, JCC.soloTime - JC.elapsed); const tm = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); const tsc = textWidth(tm, 3) <= pw - 2 ? 3 : 2;
      drawTextCenter('TIME', px2 + pw / 2, 18, '#b0a0ff', 1); drawTextCenter(tm, px2 + pw / 2, 29, left <= 30 ? '#ff9a6a' : '#ffffff', tsc, left <= 30 ? '#7a2a0a' : '#4a2a9a');                // 0:30からは、すこし強調（点滅しない）
      if (P.chain > 0 || (JC.chainPop && JC.chainPop.who === 'p')) { const n = JC.chainPop ? JC.chainPop.n : P.chain; rect(px2, 58, pw, 38, '#2a1458'); drawTextCenter('CHAIN', px2 + pw / 2, 62, '#ffe070', 1); drawTextCenter(String(n), px2 + pw / 2, 72, '#ffffff', 3, '#6a2ad0'); }
      drawTextCenter('MAX CHAIN', px2 + pw / 2, 110, '#b0a0ff', 1); drawTextCenter(String(P.maxChain), px2 + pw / 2, 120, '#ffffff', 2, '#4a2a9a'); drawTextCenter('BEST', px2 + pw / 2, 146, '#b0a0ff', 1); drawTextCenter(String(P_().jewelChain.soloBestScore), px2 + pw / 2, 156, '#ffe070', 1);
      if (JC.lastPiece && P.phase !== 'done') drawTextCenter('LAST', px2 + pw / 2, 176, '#ff9a6a', 2, '#7a2a0a');
    } else {
      jcNextStrip(C.queue, px2, 'CPU', '#ffb0b0');                                                                         // あいてのNEXT：小さい盤面の左上
      const mw = 48; const mx = px2 + Math.floor((pw - mw) / 2); const my = L.by; JC.mini = { x: mx, y: my }; jcBoardDraw(C, mx, my, 8, { mini: true }); const cp = C.pending; if (cp > 0) { const n = Math.min(cp, 6); for (let i = 0; i < n; i++) jcStone(mx + i * 8, my + 99, 6, {}); drawText('X' + cp, mx, my + 107, '#ffe070', 1, '#0a0420'); }
      rect(px2, 150, pw, 80, '#1a1038'); rect(px2, 150, pw, 1, '#6a4ad0'); drawTextCenter('SCORE', px2 + pw / 2, 154, '#b0a0ff', 1); drawText('Y ' + P.score, px2 + 3, 163, '#ffffff', 1); drawText('C ' + C.score, px2 + 3, 172, '#ffb0b0', 1);
      drawTextCenter('MAX CHAIN', px2 + pw / 2, 188, '#b0a0ff', 1); drawText('Y ' + P.maxChain, px2 + 3, 197, '#ffffff', 1); drawText('C ' + C.maxChain, px2 + 3, 206, '#ffb0b0', 1);
      if (JC.chainPop && JC.chainPop.who === 'c') drawTextCenter(JC.chainPop.n + ' CHAIN', mx + 24, my + 40, '#ff9a9a', 1, '#3a0a0a');
    }
    ctx.restore();
    // 下の段：キャラの 立ち絵（VS＝左が自分・右が相手でむきあう／ひとり＝右に 大きく）
    const myc = JC_CHARS.find((c) => c.id === P.chars);
    if (vs) {
      const cc = JC_CHARS.find((c) => c.id === C.chars); rect(10, bandY, W - 20, bandH, '#150c30'); rect(10, bandY, W - 20, 1, '#6a4ad0'); const sw = Math.min(84, Math.floor((W - 20) / 2) - 14); const sh = bandH - 6;
      jcDrawStageSprite(P, 14, bandY + 4, sw, sh, false); jcDrawStageSprite(C, W - 14 - sw, bandY + 4, sw, sh, true);
      drawTextCenter('VS', W / 2, bandY + bandH / 2 - 8, '#ffe070', 2, '#a0481a'); drawText(myc.name, 14, H - 22, myc.col, 1, '#0a0420'); drawText(cc.name, W - 14 - textWidth(cc.name, 1), H - 22, '#ffb0b0', 1, '#0a0420');
      if (JC.cutin && JC.cutin.t > 0) jcDon(JC.cutin.who === 'p' ? W / 2 - 18 : W / 2 + 18, bandY + 24, JC.chainPop ? JC.chainPop.n : 4);
    } else {
      const cw = Math.min(90, W - 20 - 100); const chh = bandH + 2; jcDrawStageSprite(P, W - 10 - cw, bandY - 2, cw, chh, false);
      drawText('SCORE', 14, bandY + 8, '#b0a0ff', 1); const sc = String(P.score); drawText(sc, 14, bandY + 19, '#ffffff', textWidth(sc, 2) <= W - 20 - cw - 14 ? 2 : 1, '#4a2a9a'); drawText(myc.name, 14, H - 22, myc.col, 1, '#0a0420');
      if (JC.cutin && JC.cutin.t > 0) jcDon(W - 10 - cw / 2, bandY + 34, JC.chainPop ? JC.chainPop.n : 4);
    }
    if (JC.chainPop && JC.chainPop.who === 'p') { const n = JC.chainPop.n; const a = Math.min(1, JC.chainPop.t * 2.2); ctx.globalAlpha = a; const col = n >= 5 ? '#ff5aa0' : n === 4 ? '#ff7a4a' : n === 3 ? '#ffb040' : '#ffe070'; drawTextCenter(n + ' CHAIN!', L.bx + bwid / 2, L.by + 70 - (1 - a) * 6, col, n >= 4 ? 3 : 2, '#2a0a3a'); ctx.globalAlpha = 1; }
    for (const p of JC.parts) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    const bc = L.bx + bwid / 2;
    if (JC.phase === 'ready' || JC.phase === 'intro') { ctx.globalAlpha = 0.5; rect(L.bx, L.by, bwid, JCC.boardH * L.cell, '#06021a'); ctx.globalAlpha = 1; if (JC.phase === 'intro' && vs) { drawTextCenter(JC_CHARS.find((c) => c.id === P.chars).name, bc, L.by + 70, '#ffffff', 2, '#2a0a3a'); drawTextCenter('VS', bc, L.by + 100, '#ffe070', 3, '#a0481a'); drawTextCenter(JC_CHARS[JC.cpuIdx].name, bc, L.by + 130, '#ffb0b0', 2, '#3a0a0a'); } else if (JC.phase === 'ready') { const go = JC.t >= 1.0; drawTextCenter(go ? 'START!' : 'READY', bc, L.by + 100, go ? '#ffe070' : '#ffffff', 3, '#2a0a3a'); } }
    if (JC.phase === 'finish') { drawTextCenter(JC.banner, bc, L.by + 100, JC.endKind === 'win' ? '#ffe070' : JC.endKind === 'lose' || JC.endKind === 'gameover' ? '#ff9a9a' : '#ffffff', JC.banner.length > 7 ? 2 : 3, '#2a0a3a'); }
    if (DEV_MODE && JC.dev.showNext) drawText('SEED ' + (JC.dev.seed || 'RND') + ' Q ' + P.queue.map((q) => q.a + '' + q.b).join(','), 12, H - 10, '#00ff88', 1);
    if (DEV_MODE && JC.dev.think && C && C.cpu && C.cpu.plan) { const pl = C.cpu.plan; drawText('CPU TARGET C' + pl.c + ' O' + pl.o, px2, 214, '#00ff88', 1); }
  }
  // ---- 初回チュートリアル（スキップできる）----
  const JC_TUT = [
    () => 'ゆびを よこに ドラッグで いどう。<br>タップで くるっと まわるよ。<br>したへ スワイプで ストンと おとす！',
    () => 'おなじ いろを 4つ つなげると<br>ぱりん！と きえるよ。<br>うえの ジュエルが おちて また つながると…',
    () => (JC.mode === 'vs' ? 'れんさすると あいてに おじゃま石が ふる！<br>さきに つみあがった ほうが まけ。<br>れんさで たたかおう！' : 'つぎつぎ つながると「れんさ」！<br>れんさが おおいほど 高とくてん。<br>じかん内に たくさん ねらおう！')
  ];
  function jcDrawTut() {
    jcBg(); drawTextCenter('HOW TO PLAY', W / 2, 16, '#ffffff', 2, '#4a2a9a'); const pg = JC.tutPage | 0; const cell = 14; const bw = 6 * cell; const bx = Math.round(W / 2 - bw / 2); const by = 40; const bh = 7 * cell; const t = JC.sel;
    rect(bx - 2, by - 2, bw + 4, bh + 4, '#5a4a9a'); rect(bx, by, bw, bh, '#0e0a22');
    if (pg === 0) {
      const step = Math.round(Math.sin(t * 1.6) * 1.5); const rot = Math.floor(t / 1.6) % 2; const pr = rot ? { a: 2, b: 1 } : { a: 1, b: 2 }; const fy = by + 8 + ((t * 20) % (bh - 40)); jcPairDraw(pr, bx + 2.5 * cell + step * cell, fy, cell);
      ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.moveTo(bx - 4, by + 36); ctx.lineTo(bx - 12, by + 42); ctx.lineTo(bx - 4, by + 48); ctx.fill(); ctx.beginPath(); ctx.moveTo(bx + bw + 4, by + 36); ctx.lineTo(bx + bw + 12, by + 42); ctx.lineTo(bx + bw + 4, by + 48); ctx.fill();
    } else if (pg === 1) {
      const u = t % 3.2; jcJewel(1, bx, by + 6 * cell, cell); jcJewel(1, bx, by + 5 * cell, cell); jcJewel(3, bx + cell, by + 6 * cell, cell); jcJewel(2, bx + 2 * cell, by + 6 * cell, cell); jcJewel(4, bx + 3 * cell, by + 6 * cell, cell); jcJewel(2, bx + 3 * cell, by + 5 * cell, cell);
      if (u < 1.8) jcPairDraw({ a: 1, b: 1 }, bx + cell / 2, by + (u / 1.8) * 3 * cell, cell); else if (u < 2.8) { ctx.globalAlpha = 0.5; for (let i = 3; i < 7; i++) jcJewel(1, bx, by + i * cell, cell, { mix: 0.5 }); ctx.globalAlpha = 1; for (let i = 3; i < 7; i++) if (i < 5) jcJewel(1, bx, by + i * cell, cell, { alpha: 0.5 }); }
      if (u >= 1.8 && u < 2.8) { drawTextCenter('PARIN!', bx + bw / 2, by + 20, '#ffe070', 2, '#a0481a'); }
    } else {
      const k = Math.floor(t / 0.9) % 4; drawTextCenter((k + 1) + ' CHAIN!', bx + bw / 2, by + 24, k >= 3 ? '#ff5aa0' : k === 2 ? '#ff7a4a' : '#ffe070', 2 + (k >= 2 ? 1 : 0), '#2a0a3a');
      for (let i = 0; i < 6; i++) jcJewel(((i + k) % 5) + 1, bx + i * cell, by + 6 * cell, cell); if (JC.mode === 'vs') for (let i = 0; i < Math.min(6, 2 + k * 2); i++) jcStone(bx + i * cell, by + 4 * cell, cell, {});
    }
    for (let i = 0; i < JC_TUT.length; i++) rect(Math.round(W / 2 - 14 + i * 10), by + bh + 10, 6, 6, i === pg ? '#ffe070' : '#3a2a6a');
  }
    function jcDrawResult() {
    jcBg(); const P = JC.player; const me = JC_CHARS.find((c) => c.id === P.chars);
    if (JC.mode === 'solo') {
      jcSprite(P.chars, JC.result.score >= 50000 ? 'win' : 'normal', W - 8 - 76, 40, 76, 114); drawTextCenter('RESULT', W / 2 - 14, 18, '#ffffff', 2, '#6a2ad0'); drawTextCenter(JC.endKind === 'timeup' ? 'TIME UP!' : 'GAME OVER', W / 2 - 14, 36, '#ffe070', 1);
      drawText('SCORE', 16, 56, '#b0a0ff', 1); drawText(String(JC.result.score), 16, 66, '#ffffff', 2, '#4a2a9a'); drawText('MAX CHAIN', 16, 90, '#b0a0ff', 1); drawText(String(JC.result.maxChain), 16, 100, '#ffffff', 2, '#4a2a9a'); drawText('JEWELS CLEARED', 16, 124, '#b0a0ff', 1); drawText(String(JC.result.cleared), 16, 134, '#ffffff', 2, '#4a2a9a');
      drawText('BEST', 16, 158, '#b0a0ff', 1); drawText(String(JC.best.score), 16, 167, '#ffe070', 1); drawText('BEST CHAIN ' + JC.best.chain, 16, 178, '#ffe070', 1);
      if (JC.newRecord) { drawTextCenter('* NEW RECORD! *', W / 2, 204, '#7dff8a', 2, '#0a3a1a'); }
      drawTextCenter('YEN ' + P_().money, W / 2, 232, '#a8b8ff', 1);
    } else {
      const k = JC.result.kind; const st = k === 'win' ? 'win' : 'lose'; jcSprite(P.chars, st, W / 2 - 60, 30, 120, 180); drawTextCenter(k === 'win' ? 'YOU WIN!' : k === 'lose' ? 'YOU LOSE' : 'DRAW', W / 2, 14, k === 'win' ? '#ffe070' : '#ffffff', 3, k === 'win' ? '#a0481a' : '#4a2a9a');
      drawTextCenter('MAX CHAIN  YOU ' + JC.result.maxP + '  CPU ' + JC.result.maxC, W / 2, 214, '#b0a0ff', 1); drawTextCenter('VS  ' + JC_CHARS[JC.cpuIdx].name, W / 2, 228, '#ffb0b0', 1); drawTextCenter('YEN ' + P_().money, W / 2, 242, '#a8b8ff', 1);
    }
  }
  function jcDrawGallery() {
    jcBg(); const st = ['normal', 'attack', 'pinch', 'win', 'lose']; const cw = Math.floor((W - 16) / 5); drawTextCenter('ALL POSES', W / 2, 14, '#ffffff', 1);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { jcSprite(JC_CHARS[r].id, st[c], 8 + c * cw, 26 + r * 66, cw - 1, 62); } for (let c = 0; c < 5; c++) drawTextCenter(st[c].toUpperCase().slice(0, 4), 8 + c * cw + cw / 2, 360, '#b0a0ff', 1);
  }
  const JC_DOM = {};
  function jcBuildDom() {
    if (JC_DOM.solo) return; const mk = (id, text, cls, fn) => { const b = document.createElement('button'); b.className = 'cr-btn hb-btn ' + cls; b.id = id; b.type = 'button'; b.textContent = text; screenEl.appendChild(b); JC_DOM[id.slice(3)] = b; b.addEventListener('click', () => { ensureAudio(); fn(); }); return b; };
    const txt = (id, html) => { const d = document.createElement('div'); d.className = 'prize-info st-say br-hint'; d.id = id; d.innerHTML = html; screenEl.appendChild(d); JC_DOM[id.slice(3)] = d; return d; };
    mk('jc-coin', 'コインを入れる　¥' + JCC.price, 'td-go', jcInsert); mk('jc-tnext', 'つぎへ', 'td-go', () => { beep(880, 0, 0.05, 0.04, 'square'); if ((JC.tutPage | 0) >= JC_TUT.length - 1) jcTutEnd(); else JC.tutPage++; }); mk('jc-tskip', 'スキップ', 'hb-sub', () => { beep(520, 0, 0.05, 0.04, 'square'); jcTutEnd(); });
    mk('jc-solo', 'ひとりであそぶ', 'td-go', () => { JC.mode = 'solo'; JC.phase = 'char'; beep(880, 0, 0.05, 0.04, 'square'); }); mk('jc-vs', 'CPUとたいせん', 'td-go', () => { JC.mode = 'vs'; JC.phase = 'char'; beep(880, 0, 0.05, 0.04, 'square'); });
    mk('jc-next', 'つぎへ', 'td-go', () => { if (JC.mode === 'solo') jcGo(); else { JC.phase = 'diff'; beep(880, 0, 0.05, 0.04, 'square'); } }); mk('jc-back', 'もどる', 'hb-sub', () => { beep(520, 0, 0.05, 0.04, 'square'); JC.phase = JC.phase === 'diff' ? 'char' : 'select'; });
    mk('jc-play', 'スタート！', 'td-go', jcGo); mk('jc-retry', 'もういちど　¥' + JCC.price, 'td-go', jcPay); mk('jc-out', '7Fにもどる', 'hb-sub', () => { JC.phase = jcHome(); beep(520, 0, 0.05, 0.04, 'square'); standUp(); }); mk('jc-menu', 'メニューへ', 'hb-sub', () => { JC.phase = jcHome(); beep(520, 0, 0.05, 0.04, 'square'); });
    txt('jc-desc', ''); txt('jc-ttxt', ''); txt('jc-dtitle', 'あいてのつよさ');
    for (const [k, i] of [['d0', 'easy'], ['d1', 'normal'], ['d2', 'hard']]) mk('jc-' + k, JCD[i], 'hb-sub', () => { JC.diff = i; beep(880, 0, 0.04, 0.04, 'square'); });
  }
  function jcUi() {
    jcBuildDom(); const ph = JC.phase; const show = (k, on) => JC_DOM[k].classList.toggle('is-show', !!on);
    show('coin', ph === 'coin'); show('tnext', ph === 'tut'); show('tskip', ph === 'tut'); show('ttxt', ph === 'tut'); show('solo', ph === 'select'); show('vs', ph === 'select'); show('next', ph === 'char'); show('back', ph === 'char' || ph === 'diff');  show('dtitle', ph === 'diff'); show('d0', ph === 'diff'); show('d1', ph === 'diff'); show('d2', ph === 'diff'); show('play', ph === 'diff'); show('retry', ph === 'result'); show('out', ph === 'result'); show('menu', ph === 'result');
    crPlace(JC_DOM.coin, { x: 24, y: 284, w: W - 48, h: 40 }); crPlace(JC_DOM.ttxt, { x: 8, y: 158, w: W - 16, h: 74 }); crPlace(JC_DOM.tnext, { x: 24, y: 246, w: W - 48, h: 34 }); crPlace(JC_DOM.tskip, { x: 24, y: 288, w: W - 48, h: 26 }); if (ph === 'tut') { JC_DOM.ttxt.innerHTML = JC_TUT[JC.tutPage | 0](); JC_DOM.tnext.textContent = (JC.tutPage | 0) >= JC_TUT.length - 1 ? 'はじめる！' : 'つぎへ'; }
    crPlace(JC_DOM.solo, { x: 24, y: 262, w: W - 48, h: 32 }); crPlace(JC_DOM.vs, { x: 24, y: 300, w: W - 48, h: 32 });
    crPlace(JC_DOM.desc, { x: 12, y: 280, w: W - 24, h: 34 }); crPlace(JC_DOM.back, { x: 12, y: 326, w: 56, h: 28 }); crPlace(JC_DOM.next, { x: 74, y: 326, w: W - 86, h: 28 });
    crPlace(JC_DOM.dtitle, { x: 12, y: 150, w: W - 24, h: 16 }); crPlace(JC_DOM.d0, { x: 24, y: 172, w: W - 48, h: 26 }); crPlace(JC_DOM.d1, { x: 24, y: 202, w: W - 48, h: 26 }); crPlace(JC_DOM.d2, { x: 24, y: 232, w: W - 48, h: 26 }); crPlace(JC_DOM.play, { x: 24, y: 276, w: W - 48, h: 32 });
    crPlace(JC_DOM.retry, { x: 20, y: 262, w: W - 40, h: 32 }); crPlace(JC_DOM.out, { x: 20, y: 298, w: W - 40, h: 26 }); crPlace(JC_DOM.menu, { x: 20, y: 328, w: W - 40, h: 24 });
    if (ph === 'char') JC_DOM.next.textContent = JC.mode === 'solo' ? 'スタート！' : 'つぎへ';
    if (ph === 'diff') ['d0', 'd1', 'd2'].forEach((k, i) => { const key = ['easy', 'normal', 'hard'][i]; JC_DOM[k].classList.toggle('hb-go', JC.diff === key); JC_DOM[k].classList.toggle('hb-sub', JC.diff !== key); });
    for (const k of ['coin', 'tnext', 'tskip', 'solo', 'vs', 'back', 'next', 'play', 'retry', 'out', 'menu', 'd0', 'd1', 'd2']) JC_DOM[k].style.fontSize = Math.max(10, parseFloat(JC_DOM[k].style.fontSize) * 0.95) + 'px';
  }
  function jcHide() { if (!JC_DOM.solo) return; Object.keys(JC_DOM).forEach((k) => JC_DOM[k].classList.remove('is-show')); }
  function jcDraw() { const ph = JC.phase; if (ph === 'select' || ph === 'coin') jcDrawSelect(); else if (ph === 'tut') jcDrawTut(); else if (ph === 'char') jcDrawChar(); else if (ph === 'diff') jcDrawDiff(); else if (ph === 'result') jcDrawResult(); else if (ph === 'gallery') jcDrawGallery(); else jcDrawPlay(); jcUi(); }
  function jcLeaveMid() {
    const mid = ['intro', 'ready', 'play', 'finish'].includes(JC.phase); if (!mid) return false;
    showDialog({ title: 'ゲームをやめますか？', lines: ['やめると、このゲームは おわります。', { text: '（¥100は かえってこないよ）', cls: 'dim' }], buttons: [{ label: 'やめる', primary: true, onClick: () => { JC.phase = jcHome(); JC.inp = null; standUp(); } }, { label: 'つづける' }] });
    return true;
  }
  // ---- DEV：連鎖の盤面・お邪魔・時間・CPU同士の大量テスト ----
  function jcChainBoard(n) { const b = jcNewBoard(); const c0 = [1, 1, 1]; const c1 = []; for (let k = 2; k <= Math.min(n, 5); k++) { c0.push(k, k); c1.push(k); } c0.forEach((v, i) => { b[JCC.boardH - 1 - i][0] = v; }); c1.forEach((v, i) => { b[JCC.boardH - 1 - i][1] = v; }); return b; }
  function jcDevFire(n) {                                                                                                // 連鎖の盤面を おいて、すぐ 発動（SE・演出・攻撃量の確認用）
    const s = JC.player; if (!s || JC.phase !== 'play') { toast('ゲーム中に つかってね'); return; } s.board = jcChainBoard(n); s.piece = null; s.fast = false; s.phase = 'gap'; s.t = 0;
  }
  function jcDevPinch() { const s = JC.player; if (!s || JC.phase !== 'play') return; const b = jcNewBoard(); for (let r = 2; r < JCC.boardH; r++) for (let c = 0; c < JCC.boardW; c++) b[r][c] = ((r * 2 + c * 3) % 5) + 1; s.board = b; s.piece = null; s.phase = 'wait'; s.t = 0; }
  function jcDevSimRun(lvA, lvB, n, done) {                                                                              // CPU同士を 画面なしで（1戦ずつ 少しずつ。画面が とまらないように）
    const res = { A: 0, B: 0, draw: 0, time: 0, mx: 0, tm: 0 }; let i = 0; const step = () => { const r = jcSimVs(lvA, lvB, 5000 + i, JCC.vsSafety); res[r.winner]++; res.tm += r.time; res.mx = Math.max(res.mx, r.A.maxChain, r.B.maxChain); i++; if (i < n) setTimeout(step, 0); else done(res); }; setTimeout(step, 0);
  }
  function openJcDev() {
    const again = (f) => () => { f(); setTimeout(openJcDev, 0); }; const P = JC.player; const info = 'MODE ' + JC.mode + ' / CHAR ' + JC_CHARS[JC.charIdx].name + ' / CPU ' + JCD[JC.diff] + (JC.cpu ? ' (' + JC_CHARS[JC.cpuIdx].name + ')' : '') + ' / seed ' + (JC.dev.seed || 'RND') + ' / 落下 ×' + JC.dev.fallScale + ' / lock ' + JCC.lockDelay + ' / time ' + Math.round(JC.elapsed) + 's';
    const begin = (mode) => () => { JC.mode = mode; JC.paying = false; jcStartGame(); };                                // 料金なしで 即開始
    showDialog({ title: 'JEWEL CHAIN DEV', wide: true, lines: [{ text: info, cls: 'dim' }], buttons: [
      { label: 'MONEY +¥1000', onClick: again(() => { P_().money += 1000; writeSave(); }) },
      { label: 'SOLO 即開始（料金なし）', onClick: begin('solo') }, { label: 'VS 即開始（料金なし）', onClick: begin('vs') },
      { label: 'CPU 難易度：やさしい', onClick: again(() => { JC.diff = 'easy'; if (JC.cpu) JC.cpu.cpu.P = JCC.cpu.easy; }) }, { label: 'CPU 難易度：ふつう', onClick: again(() => { JC.diff = 'normal'; if (JC.cpu) JC.cpu.cpu.P = JCC.cpu.normal; }) }, { label: 'CPU 難易度：つよい', onClick: again(() => { JC.diff = 'hard'; if (JC.cpu) JC.cpu.cpu.P = JCC.cpu.hard; }) },
      { label: 'CPUキャラ：つぎへ（RANDOM→1→…）', onClick: again(() => { JC.dev.cpuChar = JC.dev.cpuChar == null ? 0 : JC.dev.cpuChar >= 4 ? null : JC.dev.cpuChar + 1; }) }, { label: 'seed：つぎへ（RND→1→2→777）', onClick: again(() => { const L = [0, 1, 2, 777]; JC.dev.seed = L[(L.indexOf(JC.dev.seed) + 1) % L.length]; }) },
      { label: '落下速度 ×0.5 / ×1 / ×2', onClick: again(() => { JC.dev.fallScale = JC.dev.fallScale === 1 ? 2 : JC.dev.fallScale === 2 ? 0.5 : 1; }) }, { label: 'lock delay 0.5 / 1.0 / 0.2', onClick: again(() => { JCC.lockDelay = JCC.lockDelay === 0.5 ? 1.0 : JCC.lockDelay === 1.0 ? 0.2 : 0.5; }) },
      { label: 'seed・NEXT 表示 ON/OFF', onClick: again(() => { JC.dev.showNext = !JC.dev.showNext; }) }, { label: 'CPU 思考（目標）表示 ON/OFF', onClick: again(() => { JC.dev.think = !JC.dev.think; }) },
      { label: '2 CHAIN 盤面を 発動', onClick: () => jcDevFire(2) }, { label: '3 CHAIN 盤面を 発動', onClick: () => jcDevFire(3) }, { label: '4 CHAIN 盤面を 発動', onClick: () => jcDevFire(4) }, { label: '5 CHAIN 盤面を 発動', onClick: () => jcDevFire(5) },
      { label: 'お邪魔石 +6（予告）', onClick: () => { if (P) P.pending += 6; } }, { label: 'お邪魔予告：0 / 12 を行き来', onClick: again(() => { if (P) P.pending = P.pending >= 12 ? 0 : 12; }) },
      { label: 'ピース指定：つぎに 赤赤 → 青青 → 赤青（くりかえし）', onClick: again(() => { if (P) { JC.devPieceN = ((JC.devPieceN || 0) + 1) % 3; const pr = [{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: 1, b: 2 }][JC.devPieceN]; P.queue.unshift(Object.assign({}, pr)); toast('つぎのピース：色' + pr.a + ' と 色' + pr.b); } }) },
      { label: '盤面を ぜんぶ けす（空にする）', onClick: again(() => { if (P && JC.phase === 'play') { P.board = jcNewBoard(); P.pinch = false; } }) },
      { label: '盤面：したの3段を ならべる（連鎖の練習）', onClick: again(() => { if (P && JC.phase === 'play') { P.board = jcNewBoard(); const H = JCC.boardH; for (let r = H - 3; r < H; r++) for (let c = 0; c < JCC.boardW; c++) P.board[r][c] = ((r + c * 2) % JCC.colors) + 1; } }) }, { label: '相殺テスト（予告5・攻撃3）', onClick: () => { if (P && JC.cpu) { P.pending = 5; const r = jcAttackApply(P, JC.cpu, 3); toast('相殺 ' + r.offset + ' / 送った ' + r.sent + ' / 予告 ' + P.pending); } } },
      { label: '即WIN', onClick: () => { if (JC.cpu) JC.cpu.over = true; } }, { label: '即LOSE', onClick: () => { if (P) P.over = true; } },
      { label: 'TIME 30秒', onClick: () => { JC.elapsed = JCC.soloTime - 30; } }, { label: 'TIME 5秒', onClick: () => { JC.elapsed = JCC.soloTime - 5; } }, { label: 'TIME UP', onClick: () => { JC.elapsed = JCC.soloTime; } },
      { label: 'PINCH 状態', onClick: () => jcDevPinch() }, { label: 'キャラ全差分 表示', onClick: () => { JC.phase = 'gallery'; JC.gallery = 0; } },
      { label: 'CPU同士 20戦（ふつう×ふつう）', onClick: () => { toast('シミュレーション中…'); jcDevSimRun('normal', 'normal', 20, (r) => { showDialog({ title: 'CPU 20戦', lines: ['A勝 ' + r.A + ' / B勝 ' + r.B + ' / 引き分け ' + r.draw + ' / 膠着 ' + r.time, '平均 ' + Math.round(r.tm / 20) + '秒 / 最大連鎖 ' + r.mx], buttons: [{ label: 'とじる', primary: true }] }); }); } },
      { label: 'CPU同士 20戦（つよい×やさしい）', onClick: () => { toast('シミュレーション中…'); jcDevSimRun('hard', 'easy', 20, (r) => { showDialog({ title: 'つよい vs やさしい 20戦', lines: ['つよい勝 ' + r.A + ' / やさしい勝 ' + r.B + ' / 引き分け ' + r.draw + ' / 膠着 ' + r.time, '平均 ' + Math.round(r.tm / 20) + '秒 / 最大連鎖 ' + r.mx], buttons: [{ label: 'とじる', primary: true }] }); }); } },
      { label: 'チュートリアル 再表示（つぎの スタートで）', onClick: again(() => { P_().jewelChain.tutorialSeen = false; writeSave(); }) }, { label: 'コイン 入れなおし（CREDIT 0）', onClick: again(() => { P_().jewelChain.credit = 0; writeSave(); }) }, { label: 'BEST リセット', onClick: again(() => { const r = P_().jewelChain; r.soloBestScore = 0; r.soloBestChain = 0; writeSave(); }) }, { label: 'とじる', primary: true } ] });
  }
  mgRegister('jewelChain', {
    reset() { JC.phase = jcHome(); JC.inp = null; }, phase: () => (['coin', 'select', 'result', 'char', 'diff', 'tut'].includes(JC.phase) ? 'idle' : JC.phase),
    enter() { jcBuildDom(); for (const c of JC_CHARS) for (const st of ['normal', 'attack', 'pinch', 'win', 'lose']) jcImg(c.id, st); JC.phase = jcHome(); JC.sel = 0; JC.inp = null; JC.paying = false; JC.player = null; JC.cpu = null; setMessage('', C.cyan); },
    update: jcUpdate, draw: jcDraw, hint: 'よこ＝いどう　タップ＝まわす　↓＝おとす',
    pointer: jcPointer, pointerUp: jcPointerUp
  });
  GAME_TYPES.jewelChain.pointerMove = jcPointerMoveTrack;
  GAME_TYPES.jewelChain.canLeave = () => ['coin', 'select', 'char', 'diff', 'tut', 'result', 'gallery'].includes(JC.phase);
  GAME_TYPES.jewelChain.beforeLeave = () => jcLeaveMid();
  GAME_TYPES.jewelChain.msgBox = () => ({ x: 14, y: 360, w: 152 + (W - 180), h: 12 });

