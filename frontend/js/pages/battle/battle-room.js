import { apiFetch, API_BASE_URL } from '../../services/api.js';
import { getUserProfile } from '../../services/auth.js';
import { setupBattleSocket } from '../../services/websocket.js';
import { enableAntiCheat } from '../../services/anti-cheat.js';
import { disableAntiCheat } from "../../services/anti-cheat.js";


let currentUser = null;
let socket = null;
let matchData = null;
let LANGUAGES = [];
let matchTimerInterval = null;
let startTime = null;
let matchFinished = false;  // NEW — chặn spam overlay

/* ======================================================
   LOAD NGÔN NGỮ
====================================================== */
async function loadLanguagesConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/languages/`);
    LANGUAGES = await res.json();

    const selectedKey = currentUser?.preferred_language;
    const langObj = LANGUAGES.find((l) => l.key === selectedKey);

    const label = langObj ? (langObj.name || langObj.label) : selectedKey;
    const langDisplay = document.getElementById('language-display');
    if (langDisplay) langDisplay.textContent = label;
  } catch (err) {
    alert('Failed to load languages!');
  }
}

/* ======================================================
   INIT PAGE
====================================================== */
export async function initBattleRoomPage() {
  const matchId = new URLSearchParams(window.location.search).get('match_id');
  if (!matchId) return alert("Match not found");

  currentUser = await getUserProfile();
  matchData = await apiFetch(`/api/matches/${matchId}/`);

  document.getElementById('battle-room-main').style.display = 'flex';

  await loadLanguagesConfig();
  renderMatchInfo(matchData);
  renderProblemDetails(matchData.problem);

  socket = setupBattleSocket(matchId, handleBattleSocketMessage);

  // Enable anti cheat
  const editor = document.getElementById('code-editor');
  if (editor && socket) {
    const opponent =
      matchData.player1.username === currentUser.username
        ? matchData.player2.username
        : matchData.player1.username;

    enableAntiCheat(editor, matchId, socket, currentUser.username, opponent);
  }

  document.getElementById('submit-btn').addEventListener('click', submitSolution);
  startMatchTimer();
  window.addEventListener("beforeunload", disableAntiCheat);
}

/* ======================================================
   HIỂN THỊ MATCH INFO
====================================================== */
function renderMatchInfo(data) {
  document.querySelector('#player1-info .username').textContent = data.player1.username;
  document.querySelector('#player1-info .rating').textContent = `Rating: ${data.player1.rating}`;

  document.querySelector('#player2-info .username').textContent = data.player2.username;
  document.querySelector('#player2-info .rating').textContent = `Rating: ${data.player2.rating}`;
}

/* ======================================================
   HIỂN THỊ BÀI TOÁN
====================================================== */
function renderProblemDetails(problem) {
  document.getElementById('problem-title').textContent = problem.title;
  document.getElementById('problem-description').innerHTML = `<p>${problem.description}</p>`;
  document.getElementById('problem-difficulty').textContent = `Difficulty: ${problem.difficulty}`;
  document.getElementById('problem-time-limit').textContent = `⏱ Time: ${problem.timeLimit}s`;
  document.getElementById('problem-memory-limit').textContent = `💾 Memory: ${problem.memoryLimit}MB`;
}

/* ======================================================
   SUBMIT CODE
====================================================== */
function submitSolution() {
  const code = document.getElementById('code-editor').value.trim();
  if (!code) return alert("Write some code first!");

  const langObj = LANGUAGES.find((l) => l.key === currentUser.preferred_language);
  const language_id = langObj?.id;

  if (!language_id) return alert("Language not supported");

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Judging...';

  socket.send(JSON.stringify({
    action: 'submit_code',
    code,
    language: currentUser.preferred_language,
    language_id,
    problem_id: matchData.problem.id
  }));
}

/* ======================================================
   WEBSOCKET HANDLER
====================================================== */
function handleBattleSocketMessage(data) {
  switch (data.type) {
    case 'player.event':
      console.log(`[Battle] Player ${data.payload.event}: ${data.payload.username}`);
      break;

    case 'match.start':
      console.log("[Battle] Match officially started!", data.payload);
      break;

    case 'submission_update':
      renderSubmissionResult(data.payload);
      break;

    case 'match_end':
      renderFinalResult(data.payload);
      break;
      
    default:
      console.warn("Unknown:", data.type);
  }
}

/* ======================================================
   HIỂN THỊ KẾT QUẢ SUBMISSION — CHỈ HIỂN THỊ CHO NGƯỜI NỘP
====================================================== */
function renderSubmissionResult(result) {
  // Nếu không phải code của mình — không hiển thị
  if (result.username !== currentUser.username) return;

  const container = document.getElementById('submission-result-container');
  const btn = document.getElementById('submit-btn');

  container.innerHTML = `
    <div><strong>${result.username}</strong> → ${result.status}</div>
    <div>⏱ ${result.execution_time ?? 0}ms | 💾 ${result.memory_used ?? 0}KB</div>
  `;

  if (result.detailed_results?.length) {
    container.innerHTML += `<h4>Testcases:</h4><ul class="testcase-list"></ul>`;
    const list = container.querySelector('.testcase-list');

    result.detailed_results.forEach((tc, i) => {
      const li = document.createElement('li');
      li.textContent = `Testcase ${i + 1}: ${tc.status === "ACCEPTED" ? "PASS" : "FAIL"}`;
      li.className = tc.status === "ACCEPTED" ? "pass" : "fail";
      list.appendChild(li);
    });
  }

  btn.disabled = false;
  btn.textContent = "Submit Solution";
}

/* ======================================================
   TIMER
====================================================== */
function startMatchTimer() {
  const timerEl = document.getElementById('match-timer');
  startTime = new Date();

  matchTimerInterval = setInterval(() => {
    const diff = Math.floor((new Date() - startTime) / 1000);
    const mins = String(Math.floor(diff / 60)).padStart(2, '0');
    const secs = String(diff % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

/* ======================================================
   HIỂN THỊ KẾT QUẢ TRẬN ĐẤU — FIX SPAM OVERLAY
====================================================== */
function renderFinalResult(payload) {
  if (matchFinished) return;   // NEW — tránh bị hiển thị nhiều lần
  matchFinished = true;

  clearInterval(matchTimerInterval);

  const overlay = document.createElement('div');
  overlay.className = 'battle-result-overlay';

  const isWinner = payload.winner_username === currentUser.username;
  const isDraw = !payload.winner_username;

  const resultClass = isDraw ? 'draw' : isWinner ? 'win' : 'lose';
  const label = isDraw ? 'Trận hòa' : isWinner ? 'Bạn thắng!' : 'Bạn thua!';

  overlay.innerHTML = `
    <div class="battle-result-box">
      <h1 class="${resultClass}">${label}</h1>
      <p class="redirect-message">Quay về Dashboard trong 5 giây...</p>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('submit-btn').disabled = true;
  document.getElementById('code-editor').disabled = true;

  setTimeout(() => {
    disableAntiCheat();
    history.pushState(null, null, '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, 5000);
}
