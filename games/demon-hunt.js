/* ==========================================================
   DASARA ARCADE — hosts the Durga Maa vs Asuras game (games/durga/index.html,
   a single self-contained file) in a frame, and saves each finished run's
   score to the Plays sheet. Game id stays "demonhunt" so existing
   config/backend rows keep working.
   ========================================================== */
(function () {
  const GAME_URL = 'games/durga/index.html';
  const LOAD_TIMEOUT_MS = 8000;
  let loadTimer = null;

  const frame = () => document.getElementById('durgaFrame');
  const status = () => document.getElementById('durgaStatus');

  function showLoading() {
    status().className = 'durga-status';
    document.getElementById('durgaStatusText').textContent = 'Loading Dasara Arcade…';
    document.getElementById('durgaRetryBtn').style.display = 'none';
  }

  function showFailed() {
    status().className = 'durga-status failed';
    document.getElementById('durgaStatusText').innerHTML =
      'The game didn\'t start.<br><span style="opacity:.6; font-size:12px;">Check that the games/durga folder was uploaded with the site, then try again.</span>';
    document.getElementById('durgaRetryBtn').style.display = '';
  }

  function load() {
    showLoading();
    clearTimeout(loadTimer);
    frame().src = 'about:blank';
    // a fresh query string avoids a stale cached copy after re-deploys
    setTimeout(() => { frame().src = GAME_URL + '?t=' + Date.now(); }, 30);
    loadTimer = setTimeout(showFailed, LOAD_TIMEOUT_MS);
  }

  function start() {
    BESTA.showScreen('screen-durga');
    load();
  }

  function leave() {
    clearTimeout(loadTimer);
    frame().src = 'about:blank'; // stops the game loop and chiptune audio
    BESTA.backToPicker();
  }

  window.addEventListener('message', (e) => {
    if (e.source !== frame().contentWindow) return;
    const d = e.data;
    if (!d) return;

    if (d.type === 'durga:ready') {
      clearTimeout(loadTimer);
      status().className = 'durga-status hidden';
      return;
    }

    // The game posts { type:'durga:result', score, level, victory } when a run ends.
    if (d.type === 'durga:result') {
      const session = BESTA.getSession();
      if (!session) return;
      BESTA.postToBackend({
        action: 'submitPlay', game: 'demonhunt', ...BESTA.identity(),
        score: Number(d.score) || 0,
        difficulty: 'Level ' + (Number(d.level) || 1) + (d.victory ? ' (cleared all)' : ''),
      }).catch(() => {});
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('durgaBackBtn').addEventListener('click', leave);
    document.getElementById('durgaRetryBtn').addEventListener('click', load);
  });

  BESTA.registerGame('demonhunt', { start });
})();
