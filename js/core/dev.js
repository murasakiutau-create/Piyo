'use strict';
  // DEV：開発者向け（DEV_MODE が false なら、DEVボタンごと消える）。各ゲーム専用の DEV 画面は、そのゲームのファイルの中（openXxDev）

  const DEV_MODE = (function () { try { return localStorage.getItem('piyo-debug') === '1'; } catch (e) { return false; } })();   // URLに ?debug=1 を付けた端末だけ true（index.html が記録）。付けなければ公開版と同じ（DEVボタンなし）

  // ---------------------------------------------------------------------
  //  DEVメニュー（DEV_MODE が true のときだけ、右上に小さなDEVボタンが出ます）
  // ---------------------------------------------------------------------
  function openDev() {
    if (dialogOpen) return;
    const has = !!save;
    showDialog({
      title: 'DEV', wide: true,
      lines: [{ text: has ? 'DAY ' + P_().day + '　¥' + P_().money + '　MEDAL ' + hand : 'セーブなし（タイトル）', cls: 'dim' }],
      buttons: [
        { label: 'MONEY +¥1,000', onClick: () => { if (has) { P_().money += 1000; writeSave(); toast('MONEY +1000'); } } },
        { label: 'MEDAL +100', onClick: () => { if (has) { hand += 100; D_().bought = true; noteMedals(); writeSave(); toast('MEDAL +100'); } } },
        { label: 'DAY +1', onClick: () => { if (has && scene === 'center') { advanceDay(); toast('DAY ' + P_().day); } } },
        { label: '開店演出テスト', onClick: () => { if (has) startOpening(); } },
        { label: '閉店演出テスト', onClick: () => { if (has) startClosing(false); } },
        { label: '店長おすすめ発生', onClick: () => { if (has) recSpawn(true); } },
        { label: 'SAVE EXPORT', onClick: () => { const json = JSON.stringify(save || readSave() || {}); try { navigator.clipboard.writeText(json); } catch (e) { /* 何もしない */ } window.prompt('セーブのJSON（コピーしてください）', json); } },
        { label: 'SAVE IMPORT', onClick: () => { const t = window.prompt('セーブのJSONを貼り付けてください'); if (!t) return; try { const o = JSON.parse(t); if (!o.persistent || !o.daily) throw new Error('bad'); localStorage.setItem(ARC.saveKey, JSON.stringify(o)); location.reload(); } catch (e) { toast('JSONを読み込めませんでした'); } } },
        { label: 'DAY 1 へ戻す', onClick: () => { try { localStorage.removeItem(ARC.saveKey); } catch (e) { /* 何もしない */ } hideTitle(); closeDialog(); beginNew(); } },
        { label: 'セーブ完全削除', onClick: () => { try { localStorage.removeItem(ARC.saveKey); localStorage.removeItem('piyo-arcade-save-v1'); } catch (e) { /* 何もしない */ } location.reload(); } },
        { label: 'クレーン：全台 初期化', onClick: () => { if (has) { crP().machines = {}; writeSave(); toast('クレーン 初期化'); } } },
      { label: 'クレーン：翌DAY補充テスト', onClick: () => { if (has) { for (const k of Object.keys(CRC.machines)) { const st = crState(k); st.prizes.splice(0, 2); } crNextDay(); writeSave(); toast('補充しました'); } } },
      { label: 'クレーン：景品 全GET', onClick: () => { if (has) { const sh = crP().shelf; for (const id of Object.keys(CRC.prizes)) sh[id] = sh[id] || { n: 1, first: P_().day, from: 'DEV' }; writeSave(); toast('全景品 GET'); } } },
      { label: 'HAPPY BEAT DEV…', onClick: () => { setTimeout(openHbDev, 0); } },
      { label: '閉じる', primary: true }
      ]
    });
  }
  if (DEV_MODE) {
    const devBtn = document.createElement('button');
    devBtn.className = 'dev-btn';
    devBtn.textContent = 'DEV';
    devBtn.addEventListener('click', () => { ensureAudio(); openDev(); });
    document.body.appendChild(devBtn);
  }

