'use strict';
  // =====================================================================
  //  共有される状態（ゲーム全体で、みんなが さわる変数の置き場）
  //    save …… セーブデータ（persistent ＝ ずっと ／ daily ＝ その日だけ）。中身の初期値は save.js
  //    hand …… いまの MEDAL ／ scene・currentMachine・zoom …… いま どの画面・どの台か
  //    centerFloor …… いまの階 ／ dialogOpen …… ダイアログが 開いているか
  // =====================================================================

  // ---- セーブデータ（永続 persistent ／ その日だけ daily） ----
  let save = null;
  let scene = 'center';        // center / machine
  let currentMachine = null;
  let dialogOpen = false;
  let zoom = null;             // 筐体に座る・立つときのズーム { t, dir, machine }
  let centerT = 0;
  let saveTimer = 0;
  let outOfMedalShown = false;
  let hand = CONFIG.startCoins;
  let centerFloor = 0;
