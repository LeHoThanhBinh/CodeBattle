// frontend/js/battle-room.js (phiên bản hoàn chỉnh)
import { apiFetch } from '../services/api.js';
import { getUserProfile } from '../services/auth.js';
import { setupBattleSocket } from '../services/websocket.js';

let currentUser = null;
let socket = null;
let matchData = null;
let matchTimerInterval = null;
let startTime = null;

let LANGUAGES = []; // sẽ chứa danh sách đọc từ JSON

// 🧩 Load danh sách ngôn ngữ từ config/languages.json
async function loadLanguagesConfig() {
  try {
    const res = await fetch('/config/languages.json');
    LANGUAGES = await res.json();

    const select = document.getElementById('language-selector');
    select.innerHTML = '';

    LANGUAGES.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.key;
      opt.textContent = lang.label;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('❌ Cannot load languages config:', err);
    alert('Failed to load language configuration!');
  }
}

// 🚀 Khởi tạo Battle Room
export async function initBattleRoomPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get('match_id');
  if (!matchId) {
    alert('No match ID found! Redirecting to dashboard...');
    history.pushState(null, null, '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return;
  }

  try {
    currentUser = await getUserProfile();
    matchData = await apiFetch(`/api/matches/${matchId}/`);
    document.getElementById('battle-room-main').style.display = 'flex';
    await loadLanguagesConfig(); // ✅ Load danh sách ngôn ngữ động
    renderMatchInfo(matchData);
    renderProblemDetails(matchData.problem);
    socket = setupBattleSocket(matchId, handleBattleSocketMessage);
    document.getElementById('submit-btn').addEventListener('click', submitSolution);
    startMatchTimer();
  } catch (e) {
    console.error('❌ Failed to load battle room:', e);
    alert('Error loading match. Please try again.');
  }
}

function renderMatchInfo(data) {
  const p1 = data.player1, p2 = data.player2;
  document.querySelector('#player1-info .username').textContent = p1.username;
  document.querySelector('#player1-info .rating').textContent = `Rating: ${p1.rating}`;
  document.querySelector('#player2-info .username').textContent = p2.username;
  document.querySelector('#player2-info .rating').textContent = `Rating: ${p2.rating}`;
}

function renderProblemDetails(problem) {
  document.getElementById('problem-title').textContent = problem.title;
  document.getElementById('problem-description').innerHTML = `<p>${problem.description}</p>`;
  document.getElementById('problem-difficulty').textContent = `Difficulty: ${problem.difficulty}`;
  document.getElementById('problem-time-limit').textContent = `⏱ Time limit: ${problem.timeLimit}s`;
  document.getElementById('problem-memory-limit').textContent = `💾 Memory: ${problem.memoryLimit}MB`;
}

// 🧠 Submit code
function submitSolution() {
  const code = (document.getElementById('code-editor')?.value ?? '').trim();
  const languageKey = document.getElementById('language-selector').value;

  if (!code) {
    alert('Please write some code before submitting!');
    return;
  }

  const langObj = LANGUAGES.find(l => l.key === languageKey);
  const language_id = langObj ? langObj.id : null;
  if (!language_id) {
    alert('Invalid language selected!');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Judging...';

  const statusEl = document.getElementById('submission-status');
  if (statusEl) {
    statusEl.textContent = 'Judging...';
    statusEl.className = 'scoreboard-status status-pending';
  }

  console.log(`🚀 Submitting code: lang=${languageKey}, id=${language_id}`);

  socket.send(JSON.stringify({
    action: 'submit_code',
    code,
    language: languageKey,
    language_id,
    problem_id: matchData.problem.id,
  }));
}

// ⚙️ Handle WebSocket messages
function handleBattleSocketMessage(event) {
  const data = typeof event === 'string' ? JSON.parse(event) : event;
  switch (data.type) {
    case 'submission.pending':
      updateStatusPending();
      break;
    case 'submission_update':
      renderSubmissionResult(data.payload);
      break;
    case 'match_end':
      renderFinalResult(data.payload);
      break;
    case 'error':
      alert('⚠️ ' + (data.payload?.message || 'Unknown error'));
      break;
    default:
      console.warn('⚠️ Unknown message type:', data.type);
  }
}

function updateStatusPending() {
  const statusEl = document.getElementById('submission-status');
  if (statusEl) {
    statusEl.textContent = 'Judging...';
    statusEl.className = 'scoreboard-status status-pending';
  }
}

// 🧩 Hiển thị kết quả submission
function renderSubmissionResult(result) {
  const container = document.getElementById('submission-result-container');
  const myStatusEl = document.getElementById('submission-status');
  const submitBtn = document.getElementById('submit-btn');

  const { user, status, execution_time, memory_used } = normalize(result);
  container.innerHTML = `
    <div><strong>${user}</strong> → ${status}</div>
    <div>Time: ${execution_time}ms | Memory: ${memory_used}KB</div>
  `;

  // ✅ Thêm bảng chi tiết test case
  if (result.detailed_results && Array.isArray(result.detailed_results) && result.detailed_results.length) {
    const tableRows = result.detailed_results.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><pre>${t.input ?? ''}</pre></td>
        <td><pre>${t.expected_output ?? ''}</pre></td>
        <td><pre>${t.actual_output ?? ''}</pre></td>
        <td class="${t.status === 'ACCEPTED' ? 'ok' : 'fail'}">${t.status}</td>
      </tr>
    `).join('');

    container.innerHTML += `
      <h4>Detailed Results</h4>
      <table class="detailed-results">
        <thead>
          <tr><th>#</th><th>Input</th><th>Expected</th><th>Output</th><th>Status</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  } else {
    container.innerHTML += `<p>No detailed test results available.</p>`;
  }

  if (myStatusEl) {
    myStatusEl.textContent = status;
    myStatusEl.className = status === 'ACCEPTED'
      ? 'scoreboard-status status-accepted'
      : 'scoreboard-status status-rejected';
  }
  submitBtn.disabled = false;
  submitBtn.innerHTML = 'Submit Code';
}

// Chuẩn hóa dữ liệu result
function normalize(payload) {
  return {
    user: payload.user || payload.username,
    status: payload.status,
    execution_time: payload.execution_time ?? payload.executionTime ?? 0,
    memory_used: payload.memory_used ?? payload.memoryUsed ?? 0,
  };
}

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

function renderFinalResult(payload) {
  clearInterval(matchTimerInterval);
  const overlay = document.createElement('div');
  overlay.className = 'battle-result-overlay';

  const isWinner = payload.winner_username === (window.currentUser?.username);
  const isDraw = !payload.winner_username;

  let resultClass = isDraw ? 'draw' : (isWinner ? 'win' : 'lose');
  let resultIcon = isDraw ? '🤝' : (isWinner ? '🏆' : '😢');
  let resultTitle = isDraw ? 'Trận đấu Hòa!' : (isWinner ? 'Bạn Thắng!' : 'Bạn Thua');

  overlay.innerHTML = `
    <div class="battle-result-box">
      <h1 class="${resultClass}">
        ${resultIcon} ${resultTitle}
      </h1>
      <p>${isDraw ? 'Cả hai người chơi có kết quả bằng nhau.' : (isWinner ? 'Chúc mừng, bạn đã thắng!' : 'Hãy thử lại lần sau!')}</p>
      <p class="redirect-message">Đang quay lại Dashboard trong 5 giây...</p>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    history.pushState(null, null, '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
  }, 5000);
}
