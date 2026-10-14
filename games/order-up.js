/* ==========================================================
   TABLE TIME — selfie jigsaw, fixed 5x5, adjacent-swap mechanic
   Select a tile (it highlights); only its immediate neighbours
   in all 8 directions are swappable with it — tap one to swap.
   ========================================================== */
(function () {
  const GRID = 5;
  let boardPx = 0, tilePx = 0;
  let currentOrder = [];   // slot -> pieceId
  let pieceEls = [];
  let selectedSlot = null;
  let startTime = null, timerInterval = null;
  let imageDataUrl = null, lastSolveSeconds = 0;
  let mediaStream = null;

  function fmtTime(s) { return BESTA.fmtTime(s); }

  // ---------- Entry point ----------
  function start() {
    BESTA.showScreen('screen-orderup-capture');
  }

  // ---------- Photo capture ----------
  function squareCrop(sourceCanvasLike, srcW, srcH, mirror) {
    const size = Math.min(srcW, srcH);
    const sx = (srcW - size) / 2, sy = (srcH - size) / 2;
    const out = document.createElement('canvas');
    const outSize = 900;
    out.width = outSize; out.height = outSize;
    const ctx = out.getContext('2d');
    if (mirror) { ctx.translate(outSize, 0); ctx.scale(-1, 1); }
    ctx.drawImage(sourceCanvasLike, sx, sy, size, size, 0, 0, outSize, outSize);
    return out.toDataURL('image/jpeg', 0.9);
  }

  function handleFileInput(inputEl) {
    inputEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          imageDataUrl = squareCrop(img, img.width, img.height, false);
          inputEl.value = '';
          buildPuzzle(imageDataUrl);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function openLiveCamera() {
    const overlay = document.getElementById('ouCameraOverlay');
    const video = document.getElementById('ouCameraVideo');
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = mediaStream;
      overlay.classList.add('active');
    } catch (err) {
      document.getElementById('ouCameraInput').click(); // fallback to native picker
    }
  }
  function closeLiveCamera() {
    document.getElementById('ouCameraOverlay').classList.remove('active');
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  }

  // ---------- Build & jumble ----------
  function buildPuzzle(dataUrl) {
    BESTA.showScreen('screen-orderup-puzzle');
    const board = document.getElementById('ouBoard');
    board.innerHTML = '';
    pieceEls = [];
    selectedSlot = null;

    const vmin = Math.min(window.innerWidth, window.innerHeight);
    boardPx = Math.min(560, vmin * 0.8);
    tilePx = boardPx / GRID;
    board.style.width = boardPx + 'px';
    board.style.height = boardPx + 'px';
    document.getElementById('ouPeekThumb').style.backgroundImage = `url(${dataUrl})`;

    const total = GRID * GRID;
    currentOrder = [...Array(total).keys()];

    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / GRID), col = i % GRID;
      const el = document.createElement('div');
      el.className = 'piece';
      el.style.width = tilePx + 'px';
      el.style.height = tilePx + 'px';
      el.style.backgroundImage = `url(${dataUrl})`;
      el.style.backgroundSize = boardPx + 'px ' + boardPx + 'px';
      el.style.backgroundPosition = `-${col * tilePx}px -${row * tilePx}px`;
      el.dataset.pieceId = i;
      el.addEventListener('click', () => onPieceClick(i));
      board.appendChild(el);
      pieceEls[i] = el;
      const cx = boardPx / 2 - tilePx / 2;
      el.style.transition = 'none';
      el.style.transform = `translate(${cx}px, ${cx}px) scale(.25) rotate(${(Math.random() * 360 - 180).toFixed(0)}deg)`;
    }

    do { shuffle(currentOrder); } while (isSolved());

    requestAnimationFrame(() => {
      currentOrder.forEach((pieceId, slot) => {
        const el = pieceEls[pieceId];
        const r = Math.floor(slot / GRID), c = slot % GRID;
        setTimeout(() => {
          el.style.transition = 'transform .5s cubic-bezier(.22,1.4,.5,1)';
          el.style.transform = `translate(${c * tilePx}px, ${r * tilePx}px) scale(1) rotate(0deg)`;
        }, pieceId * 30);
      });
    });

    setTimeout(runTutorial, total * 30 + 650);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  function slotOf(pieceId) { return currentOrder.indexOf(pieceId); }
  function placeAt(pieceId, slot) {
    const el = pieceEls[pieceId];
    const r = Math.floor(slot / GRID), c = slot % GRID;
    el.style.transform = `translate(${c * tilePx}px, ${r * tilePx}px) scale(1) rotate(0deg)`;
  }
  function isSolved() { return currentOrder.every((pieceId, slot) => pieceId === slot); }

  // ---------- Adjacent-only swap mechanic ----------
  function neighborsOf(slot) {
    const r = Math.floor(slot / GRID), c = slot % GRID;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) out.push(nr * GRID + nc);
      }
    }
    return out;
  }

  function clearMovableHighlights() {
    pieceEls.forEach(el => el.classList.remove('movable'));
  }

  function selectPiece(pieceId) {
    clearSelection();
    selectedSlot = slotOf(pieceId);
    pieceEls[pieceId].classList.add('selected');
    neighborsOf(selectedSlot).forEach(nSlot => {
      pieceEls[currentOrder[nSlot]].classList.add('movable');
    });
  }
  function clearSelection() {
    if (selectedSlot !== null) pieceEls[currentOrder[selectedSlot]].classList.remove('selected');
    clearMovableHighlights();
    selectedSlot = null;
  }

  function onPieceClick(pieceId) {
    const slot = slotOf(pieceId);

    if (selectedSlot === null) { selectPiece(pieceId); return; }
    if (selectedSlot === slot) { clearSelection(); return; }

    const validMoves = neighborsOf(selectedSlot);
    if (!validMoves.includes(slot)) {
      // Not adjacent — treat as selecting a different piece instead of an error.
      selectPiece(pieceId);
      return;
    }

    // Adjacent — perform the swap.
    const movingPieceId = currentOrder[selectedSlot];
    currentOrder[selectedSlot] = pieceId;
    currentOrder[slot] = movingPieceId;
    placeAt(pieceId, selectedSlot);
    placeAt(movingPieceId, slot);
    clearSelection();
    markLocked();
    if (isSolved()) setTimeout(onWin, 350);
  }

  function markLocked() {
    currentOrder.forEach((pieceId, slot) => {
      pieceEls[pieceId].classList.toggle('locked', pieceId === slot);
    });
  }

  // ---------- Tutorial ----------
  const tutSteps = [
    { label: 'Step 1 of 3', text: 'This is your photo… all mixed up!' },
    { label: 'Step 2 of 3', text: 'Tap a tile — only its neighbours light up. Tap one to swap.' },
    { label: 'Step 3 of 3', text: 'Match every tile to finish. Ready?' },
  ];
  let tutIndex = 0;
  function renderTutStep() {
    const step = tutSteps[tutIndex];
    document.getElementById('ouTutLabel').textContent = step.label;
    document.getElementById('ouTutText').textContent = step.text;
    document.getElementById('ouTutNextBtn').textContent = (tutIndex === tutSteps.length - 1) ? "Let's Play!" : 'Next';
    const a = document.querySelector('#ouTutDemo .tut-tile.a');
    const b = document.querySelector('#ouTutDemo .tut-tile.b');
    a.classList.remove('swap'); b.classList.remove('swap');
    if (tutIndex === 1) setTimeout(() => { a.classList.add('swap'); b.classList.add('swap'); }, 450);
  }
  function runTutorial() {
    tutIndex = 0;
    BESTA.showScreen('screen-orderup-tutorial');
    renderTutStep();
  }
  function endTutorial() {
    BESTA.showScreen('screen-orderup-puzzle');
    startTimer();
  }

  // ---------- Peek ----------
  function wirePeek() {
    const btn = document.getElementById('ouPeekBtn');
    const thumb = document.getElementById('ouPeekThumb');
    const backdrop = document.getElementById('ouPeekBackdrop');
    const show = (e) => { e.preventDefault(); thumb.classList.add('show'); backdrop.classList.add('show'); };
    const hide = () => { thumb.classList.remove('show'); backdrop.classList.remove('show'); };
    ['mousedown', 'touchstart'].forEach(ev => btn.addEventListener(ev, show));
    ['mouseup', 'mouseleave', 'touchend'].forEach(ev => btn.addEventListener(ev, hide));
  }

  // ---------- Timer & win ----------
  function startTimer() {
    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      document.getElementById('ouTimerLabel').textContent = fmtTime(Math.floor((Date.now() - startTime) / 1000));
    }, 250);
  }

  async function onWin() {
    clearInterval(timerInterval);
    lastSolveSeconds = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('ouWinTimeLabel').textContent = `Solved in ${fmtTime(lastSolveSeconds)}`;
    BESTA.showScreen('screen-orderup-win');

    const session = BESTA.getSession();
    if (session) {
      try {
        await BESTA.postToBackend({
          action: 'submitPlay', game: 'orderup', ...BESTA.identity(),
          timeSeconds: lastSolveSeconds,
        });
      } catch (e) { /* non-blocking */ }
    }
  }

  async function showLeaderboard() {
    BESTA.showScreen('screen-orderup-leaderboard');
    const list = document.getElementById('ouLbList');
    list.innerHTML = '<div style="opacity:.5; font-size:13px;">Loading…</div>';
    try {
      const scores = await BESTA.getFromBackend({ action: 'leaderboard', game: 'orderup' });
      if (!Array.isArray(scores) || !scores.length) {
        list.innerHTML = '<div style="opacity:.5; font-size:13px;">Be the first on the board!</div>';
        return;
      }
      const medalColors = ['#C9A227', '#9AA0A6', '#A8672E'];
      const rankMark = (i) => i < 3 ? `<span style="color:${medalColors[i]}">${BESTA.icon('medal')}</span>` : (i + 1);
      list.innerHTML = scores.map((s, i) => `
        <div style="display:flex; align-items:center; gap:10px; padding:9px 4px; border-bottom:1px solid rgba(59,42,34,.12); font-size:14px;">
          <div style="width:26px; font-family:var(--font-display); color:var(--gold);">${rankMark(i)}</div>
          <div style="flex:1; text-align:left;">${escapeHtml(s.name)}</div>
          <div style="font-weight:700; opacity:.8;">${fmtTime(s.timeSeconds)}</div>
        </div>`).join('');
    } catch (e) {
      list.innerHTML = '<div style="opacity:.5; font-size:13px;">Couldn\'t load the leaderboard.</div>';
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ---------- Wire static controls once ----------
  document.addEventListener('DOMContentLoaded', () => {
    handleFileInput(document.getElementById('ouCameraInput'));
    handleFileInput(document.getElementById('ouGalleryInput'));
    document.getElementById('ouTakePhotoBtn').addEventListener('click', openLiveCamera);
    document.getElementById('ouGalleryBtn').addEventListener('click', () => document.getElementById('ouGalleryInput').click());
    document.getElementById('ouCamCancelBtn').addEventListener('click', closeLiveCamera);
    document.getElementById('ouCamShutterBtn').addEventListener('click', () => {
      const video = document.getElementById('ouCameraVideo');
      imageDataUrl = squareCrop(video, video.videoWidth, video.videoHeight, true);
      closeLiveCamera();
      buildPuzzle(imageDataUrl);
    });
    document.getElementById('ouTutNextBtn').addEventListener('click', () => {
      if (tutIndex === tutSteps.length - 1) { endTutorial(); return; }
      tutIndex++; renderTutStep();
    });
    document.getElementById('ouTutSkipBtn').addEventListener('click', endTutorial);
    wirePeek();
    document.getElementById('ouViewLeaderboardBtn').addEventListener('click', showLeaderboard);
    document.getElementById('ouBackBtn1').addEventListener('click', BESTA.backToPicker);
    document.getElementById('ouBackBtn2').addEventListener('click', BESTA.backToPicker);
    document.getElementById('ouBackBtn3').addEventListener('click', BESTA.backToPicker);
  });

  BESTA.registerGame('orderup', { start });
})();
