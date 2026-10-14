/* ==========================================================
   BESTA KIOSK — Shared App Logic
   Handles: screen navigation, Google Sign-In, the offers/notify
   popup, the date-filtered game picker, and backend calls.
   Individual games live in /games/*.js and register themselves
   via BESTA.registerGame(id, { start() }).
   ========================================================== */
window.BESTA = (function () {
  const CFG = window.BESTA_CONFIG;
  const games = {};        // id -> { start() }
  let session = null;      // { email, name, idToken } — in-memory only, never persisted

  // Font Awesome icon from the inline sprite in index.html
  function icon(name) { return '<svg class="fa" aria-hidden="true"><use href="#fa-' + name + '"/></svg>'; }

  // ---------- Screen navigation ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  // ---------- Backend helpers ----------
  const backendReady = () => CFG.BACKEND_URL && !CFG.BACKEND_URL.includes('PASTE_YOUR');

  async function postToBackend(payload) {
    if (!backendReady()) return { status: 'error', message: 'Backend not configured yet' };
    const res = await fetch(CFG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function getFromBackend(params) {
    if (!backendReady()) return { status: 'error', message: 'Backend not configured yet' };
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${CFG.BACKEND_URL}?${qs}`);
    return res.json();
  }

  function fmtTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------- Google Sign-In ----------
  function decodeJwtPayload(jwt) {
    try {
      const payload = jwt.split('.')[1];
      return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
    } catch (e) { return {}; }
  }

  async function handleCredentialResponse(response) {
    const claims = decodeJwtPayload(response.credential);
    session = { email: (claims.email || '').toLowerCase(), name: claims.name || '', idToken: response.credential };
    await afterSignIn();
  }

  function randomId() {
    const bytes = new Uint8Array(9);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
  }

  // What the backend needs to know who is calling. The server takes the real email from
  // the Google token itself; nothing the page claims about identity is trusted.
  function identity() {
    if (!session) return {};
    return session.idToken ? { idToken: session.idToken } : { guestId: session.guestId };
  }

  function enterTestMode() {
    session = { guest: true, guestId: 'anon-' + randomId(), name: '', idToken: null };
    afterSignIn();
  }

  // Called by the animated intro's arrow button for the no-login trial build:
  // skips the home/sign-in screen entirely and goes straight to Notify -> Picker.
  function enterTrialNoLogin() {
    if (session) return; // already inside - never restart the flow mid-game
    enterTestMode();
  }

  function initGoogleSignIn() {
    if (!window.google || !CFG.GOOGLE_CLIENT_ID || CFG.GOOGLE_CLIENT_ID.includes('PASTE_YOUR')) {
      // Google Sign-In isn't wired up yet (no Client ID) — offer a local
      // test-mode path instead of a dead button, so the games themselves
      // can still be tried out. This block disappears on its own once a
      // real GOOGLE_CLIENT_ID is set in config.js.
      const holder = document.getElementById('googleBtnHome');
      holder.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.style.maxWidth = '320px';
      msg.textContent = 'Google Sign-In isn\'t connected yet.';
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.innerHTML = icon('flask') + 'Continue in Test Mode (no sign-in)';
      btn.addEventListener('click', enterTestMode);
      holder.appendChild(msg);
      holder.appendChild(btn);
      return;
    }
    google.accounts.id.initialize({
      client_id: CFG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,          // never silently sign in the next guest as the last one
      cancel_on_tap_outside: true,
    });
    google.accounts.id.disableAutoSelect();
    google.accounts.id.renderButton(
      document.getElementById('googleBtnHome'),
      { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' }
    );
  }

  function signOut() {
    const hasRealSignIn = CFG.GOOGLE_CLIENT_ID && !CFG.GOOGLE_CLIENT_ID.includes('PASTE_YOUR');
    if (hasRealSignIn && window.google) google.accounts.id.disableAutoSelect();
    session = null;
    showScreen('screen-home');
  }

  // ---------- Post sign-in: notify popup, then picker ----------
  async function afterSignIn() {
    let needsNotify = true;
    try {
      const profile = await postToBackend({ action: 'profile', ...identity() });
      if (profile && profile.found && profile.hasPhone) needsNotify = false;
    } catch (e) { /* backend not reachable yet - show the popup */ }

    if (needsNotify) {
      // Google already gives us the name; guests need to type it
      document.getElementById('notifyNameWrap').style.display = session.idToken ? 'none' : '';
      document.getElementById('notifyName').value = '';
      document.getElementById('notifyPhone').value = '';
      document.getElementById('notifyMsg').textContent = '';
      showScreen('screen-notify');
    } else {
      renderGamePicker();
      showScreen('screen-picker');
    }
  }

  // ---------- Notify / offers popup ----------
  function wireNotifyPopup() {
    const msg = document.getElementById('notifyMsg');
    const fail = (text) => { msg.textContent = text; msg.className = 'msg error'; };

    document.getElementById('notifySaveBtn').addEventListener('click', async () => {
      const name = document.getElementById('notifyName').value.trim();
      const phone = document.getElementById('notifyPhone').value.trim();
      if (!session.idToken && name.length < 2) return fail('Please enter your name.');
      if (!phone) return fail('Enter your mobile number, or tap Maybe later.');

      msg.textContent = 'Saving…'; msg.className = 'msg';
      try {
        const res = await postToBackend({ action: 'saveOffersOptIn', ...identity(), name, phone, consent: true });
        if (res.status !== 'ok') return fail(res.message || 'Could not save right now.');
        if (res.guestId) { session.guestId = res.guestId; session.name = name; } // now a named guest
      } catch (e) {
        return fail('Could not save right now. Check the connection, or tap Maybe later.');
      }
      renderGamePicker();
      showScreen('screen-picker');
    });

    document.getElementById('notifySkipBtn').addEventListener('click', () => {
      renderGamePicker();
      showScreen('screen-picker');
    });
  }

  // ---------- Game picker (date-filtered) ----------
  function isGameActive(game) {
    if (game.alwaysOn) return true;
    const today = new Date().toISOString().slice(0, 10);
    return today >= game.startDate && today <= game.endDate;
  }

  function renderGamePicker() {
    const grid = document.getElementById('gameGrid');
    grid.innerHTML = '';
    CFG.GAMES.filter(isGameActive).forEach(game => {
      const tile = document.createElement('div');
      tile.className = 'game-tile';
      tile.innerHTML = `<span class="icon">${icon(game.icon)}</span><h3>${game.name}</h3><p>${game.blurb}</p>`;
      tile.addEventListener('click', () => {
        if (games[game.id]) games[game.id].start();
      });
      grid.appendChild(tile);
    });
  }

  function backToPicker() {
    renderGamePicker();
    showScreen('screen-picker');
  }

  // ---------- Public API for game modules ----------
  function registerGame(id, handlers) { games[id] = handlers; }
  function getSession() { return session; }

  document.addEventListener('DOMContentLoaded', () => {
    initGoogleSignIn();
    wireNotifyPopup();
    document.getElementById('signOutBtn').addEventListener('click', signOut);
  });

  return { showScreen, postToBackend, getFromBackend, fmtTime, registerGame, getSession, identity, backToPicker, enterTrialNoLogin, icon };
})();
