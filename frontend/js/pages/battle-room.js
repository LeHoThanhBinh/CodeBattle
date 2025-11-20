import { apiFetch, API_BASE_URL } from '../services/api.js';
import { getUserProfile } from '../services/auth.js';
import { setupBattleSocket } from '../services/websocket.js';

let currentUser = null;
let socket = null;
let matchData = null;
let LANGUAGES = [];
let matchTimerInterval = null;
let startTime = null;

/* ======================================================
   🧩 LOAD NGÔN NGỮ TỪ BACKEND (ĐỂ LẤY language_id)
====================================================== */
async function loadLanguagesConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/languages/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    LANGUAGES = await res.json();
    console.log("✅ Loaded languages:", LANGUAGES);

    // Lấy ngôn ngữ đã chọn ở Dashboard
    const selectedKey = localStorage.getItem("preferred_language");
    const langObj = LANGUAGES.find((l) => l.key === selectedKey);

    const label = langObj ? langObj.name || langObj.label : selectedKey;

    // Cập nhật UI
    const langDisplay = document.getElementById("language-display");
    if (langDisplay) langDisplay.textContent = label || "Unknown";

  } catch (err) {
    console.error("❌ Cannot load languages:", err);
    alert("Failed to load language configuration!");
  }
}

/* ======================================================
   🚀 KHỞI TẠO TRANG BATTLE ROOM
====================================================== */
export async function initBattleRoomPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get("match_id");

  if (!matchId) {
    alert("Match ID not found! Returning to dashboard...");
    history.pushState(null, null, "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }

  try {
    currentUser = await getUserProfile();
    matchData = await apiFetch(`/api/matches/${matchId}/`);

    document.getElementById("battle-room-main").style.display = "flex";

    await loadLanguagesConfig();
    renderMatchInfo(matchData);
    renderProblemDetails(matchData.problem);

    socket = setupBattleSocket(matchId, handleBattleSocketMessage);
    document.getElementById("submit-btn").addEventListener("click", submitSolution);

    startMatchTimer();

  } catch (error) {
    console.error("❌ Failed to init battle room:", error);
    alert("Error loading match. Try again.");
  }
}

/* ======================================================
   🧾 HIỂN THỊ THÔNG TIN NGƯỜI CHƠI
====================================================== */
function renderMatchInfo(data) {
  const p1 = data.player1;
  const p2 = data.player2;

  document.querySelector("#player1-info .username").textContent = p1.username;
  document.querySelector("#player1-info .rating").textContent = `Rating: ${p1.rating}`;

  document.querySelector("#player2-info .username").textContent = p2.username;
  document.querySelector("#player2-info .rating").textContent = `Rating: ${p2.rating}`;
}

/* ======================================================
   📘 HIỂN THỊ THÔNG TIN BÀI TOÁN
====================================================== */
function renderProblemDetails(problem) {
  document.getElementById("problem-title").textContent = problem.title;
  document.getElementById("problem-description").innerHTML = `<p>${problem.description}</p>`;
  document.getElementById("problem-difficulty").textContent = `Difficulty: ${problem.difficulty}`;
  document.getElementById("problem-time-limit").textContent = `⏱ Time: ${problem.timeLimit}s`;
  document.getElementById("problem-memory-limit").textContent = `💾 Memory: ${problem.memoryLimit}MB`;
}

/* ======================================================
   🧠 SUBMIT CODE (VERSION MỚI)
====================================================== */
function submitSolution() {
  const code = (document.getElementById("code-editor")?.value ?? "").trim();
  const languageKey = localStorage.getItem("preferred_language");

  if (!code) {
    alert("Please write some code before submitting!");
    return;
  }

  const langObj = LANGUAGES.find((l) => l.key === languageKey);
  const language_id = langObj?.id ?? null;

  if (!language_id) {
    alert("Invalid language selected!");
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Judging...';

  console.log(`🚀 Submitting code: lang=${languageKey}, id=${language_id}`);

  socket.send(
    JSON.stringify({
      action: "submit_code",
      code,
      language: languageKey,
      language_id,
      problem_id: matchData.problem.id,
    })
  );
}

/* ======================================================
   ⚙️ WEBSOCKET MESSAGE HANDLER
====================================================== */
function handleBattleSocketMessage(event) {
  const data = typeof event === "string" ? JSON.parse(event) : event;

  switch (data.type) {
    case "submission.pending":
      break;
    case "submission_update":
      renderSubmissionResult(data.payload);
      break;
    case "match_end":
      renderFinalResult(data.payload);
      break;
    default:
      console.warn("⚠ Unknown message:", data.type);
  }
}

/* ======================================================
   🧪 HIỂN THỊ KẾT QUẢ SUBMISSION
====================================================== */
function renderSubmissionResult(result) {
  const container = document.getElementById("submission-result-container");
  const submitBtn = document.getElementById("submit-btn");

  const { user, status, execution_time, memory_used } = normalize(result);

  container.innerHTML = `
    <div><strong>${user}</strong> → ${status}</div>
    <div>⏱ ${execution_time}ms | 💾 ${memory_used}KB</div>
  `;

  if (result.detailed_results?.length) {
    container.innerHTML += `<h4>🧪 Test Cases:</h4><ul class="testcase-list"></ul>`;
    const list = container.querySelector(".testcase-list");

    result.detailed_results.forEach((t, i) => {
      const li = document.createElement("li");
      const ok = t.status === "ACCEPTED";
      li.textContent = `Testcase ${i + 1}: ${ok ? "PASS" : "FAIL"}`;
      li.className = ok ? "pass" : "fail";
      list.appendChild(li);
    });
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit Solution";
}

/* ======================================================
   ⏱ BẮT ĐẦU ĐẾM GIỜ
====================================================== */
function startMatchTimer() {
  const timerEl = document.getElementById("match-timer");
  startTime = new Date();

  matchTimerInterval = setInterval(() => {
    const diff = Math.floor((new Date() - startTime) / 1000);
    const mins = String(Math.floor(diff / 60)).padStart(2, "0");
    const secs = String(diff % 60).padStart(2, "0");
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

/* ======================================================
   🏆 KẾT QUẢ TRẬN ĐẤU (OVERLAY)
====================================================== */
function renderFinalResult(payload) {
  clearInterval(matchTimerInterval);

  const overlay = document.createElement("div");
  overlay.className = "battle-result-overlay";

  const isWinner = payload.winner_username === currentUser?.username;
  const isDraw = !payload.winner_username;

  const resultClass = isDraw ? "draw" : isWinner ? "win" : "lose";
  const label = isDraw ? "Trận hòa" : isWinner ? "Bạn thắng!" : "Bạn thua!";

  overlay.innerHTML = `
    <div class="battle-result-box">
      <h1 class="${resultClass}">${label}</h1>
      <p class="redirect-message">Quay về Dashboard trong 5 giây...</p>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    history.pushState(null, null, "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, 5000);
}

/* ======================================================
   ✨ SUPPORT FUNCTIONS
====================================================== */
function normalize(payload) {
  return {
    user: payload.user || payload.username,
    status: payload.status,
    execution_time: payload.execution_time ?? 0,
    memory_used: payload.memory_used ?? 0,
  };
}
