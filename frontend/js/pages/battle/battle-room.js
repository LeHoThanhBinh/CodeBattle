import { apiFetch, API_BASE_URL } from "../../services/api.js";
import { getUserProfile } from "../../services/auth.js";
import { setupBattleSocket } from "../../services/websocket.js";
import { enableAntiCheat, disableAntiCheat } from "../../services/anti-cheat.js";

let currentUser = null;
let socket = null;
let matchData = null;
let LANGUAGES = [];
let matchTimerInterval = null;
let startTime = null;
let matchFinished = false;


/*-------------------------------------------
    LOAD LANGUAGES
-------------------------------------------*/
async function loadLanguagesConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/languages/`);
        LANGUAGES = await res.json();

        const selectedKey = currentUser?.preferred_language;
        const langObj = LANGUAGES.find(l => l.key === selectedKey);

        const label = langObj ? (langObj.name || langObj.label) : selectedKey;

        const langDisplay = document.getElementById("language-display");
        if (langDisplay) langDisplay.textContent = label;

    } catch (err) {
        console.error(err);
        alert("Failed to load languages!");
    }
}


/*-------------------------------------------
    INIT BATTLE ROOM
-------------------------------------------*/
export async function initBattleRoomPage() {

    const matchId = new URLSearchParams(window.location.search).get("match_id");
    if (!matchId) return alert("Match not found");

    matchFinished = false;

    currentUser = await getUserProfile();
    matchData = await apiFetch(`/api/matches/${matchId}/`);

    document.getElementById("battle-room-main").style.display = "flex";

    await loadLanguagesConfig();
    renderMatchInfo(matchData);
    renderProblemDetails(matchData.problem);

    socket = setupBattleSocket(matchId, handleBattleSocketMessage);

    const editor = document.getElementById("code-editor");
    if (editor && socket) {
        enableAntiCheat(editor, matchId, socket, currentUser.username);
    }

    document.getElementById("submit-btn").addEventListener("click", submitSolution);

    startMatchTimer();

    // SPA Cleanup
    window.cleanupBattleRoom = cleanupBattleRoom;
}


/*-------------------------------------------
    CLEANUP (ANTI-CHEAT + SOCKET + UI)
-------------------------------------------*/
function cleanupBattleRoom() {
    console.log("🔥 CLEANUP Battle Room executed!");

    // Stop timer
    clearInterval(matchTimerInterval);
    matchTimerInterval = null;

    // Disable anti-cheat
    disableAntiCheat();

    // Close WebSocket
    if (socket) {
        socket.close();
        socket = null;
    }

    // Remove result overlay
    document.querySelectorAll(".battle-result-overlay").forEach(el => el.remove());

    // Reset UI
    const container = document.getElementById("submission-result-container");
    if (container) container.innerHTML = "<p>Submit your code to see the results.</p>";

    const editor = document.getElementById("code-editor");
    if (editor) editor.value = "";
    if (editor) editor.disabled = false;

    document.getElementById("battle-room-main").style.display = "none";

    matchFinished = false;
}


/*-------------------------------------------
    UI RENDER – MATCH INFO
-------------------------------------------*/
function renderMatchInfo(data) {
    document.querySelector("#player1-info .username").textContent = data.player1.username;
    document.querySelector("#player1-info .rating").textContent = `Rating: ${data.player1.rating}`;

    document.querySelector("#player2-info .username").textContent = data.player2.username;
    document.querySelector("#player2-info .rating").textContent = `Rating: ${data.player2.rating}`;
}


/*-------------------------------------------
    UI RENDER – PROBLEM DETAILS
-------------------------------------------*/
function renderProblemDetails(problem) {
    document.getElementById("problem-title").textContent = problem.title;
    document.getElementById("problem-description").innerHTML = `<p>${problem.description}</p>`;
    document.getElementById("problem-difficulty").textContent = `Difficulty: ${problem.difficulty}`;
    document.getElementById("problem-time-limit").textContent = `⏱ Time: ${problem.timeLimit}s`;
    document.getElementById("problem-memory-limit").textContent = `💾 Memory: ${problem.memoryLimit}MB`;
}


/*-------------------------------------------
    SUBMIT SOLUTION
-------------------------------------------*/
function submitSolution() {
    const code = document.getElementById("code-editor").value.trim();
    if (!code) return alert("Write some code first!");

    const langObj = LANGUAGES.find((l) => l.key === currentUser.preferred_language);
    const language_id = langObj?.id;

    if (!language_id) return alert("Language not supported");

    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Judging...';

    socket.send(JSON.stringify({
        action: "submit_code",
        code,
        language: currentUser.preferred_language,
        language_id,
        problem_id: matchData.problem.id
    }));
}


/*-------------------------------------------
    HANDLE SOCKET MESSAGES
-------------------------------------------*/
function handleBattleSocketMessage(data) {
    switch (data.type) {
        case "submission_update":
            renderSubmissionResult(data.payload);
            break;

        case "opponent_submitted":
            handleOpponentSubmitted(data.payload);
            break;

        case "match_end":
            renderFinalResult(data.payload);
            break;
    }
}


/*-------------------------------------------
    RENDER SUBMISSION RESULT
-------------------------------------------*/
function renderSubmissionResult(result) {
    if (result.username !== currentUser.username) return;

    const container = document.getElementById("submission-result-container");
    const btn = document.getElementById("submit-btn");

    container.innerHTML = `
        <div><strong>${result.username}</strong> → ${result.status}</div>
        <div>⏱ ${result.execution_time ?? 0}ms | 💾 ${result.memory_used ?? 0}KB</div>
    `;

    if (result.detailed_results?.length) {
        container.innerHTML += `<h4>Testcases:</h4><ul class="testcase-list"></ul>`;
        const list = container.querySelector(".testcase-list");

        result.detailed_results.forEach((tc, i) => {
            const li = document.createElement("li");
            li.textContent = `Testcase ${i + 1}: ${tc.status === "ACCEPTED" ? "PASS" : "FAIL"}`;
            li.className = tc.status === "ACCEPTED" ? "pass" : "fail";
            list.appendChild(li);
        });
    }

    btn.disabled = false;
    btn.textContent = "Submit Solution";
}


/*-------------------------------------------
    OPPONENT SUBMITTED
-------------------------------------------*/
function handleOpponentSubmitted(payload) {
    if (payload.username === currentUser.username) return;

    const container = document.getElementById("submission-result-container");

    const notice = document.createElement("div");
    notice.className = "opponent-submitted";
    notice.textContent = `${payload.username} đã nộp code, hệ thống đang chấm...`;

    container.appendChild(notice);
}


/*-------------------------------------------
    MATCH TIMER
-------------------------------------------*/
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


/*-------------------------------------------
    FINAL RESULT + AUTO REDIRECT
-------------------------------------------*/
function renderFinalResult(payload) {
    if (matchFinished) return;
    matchFinished = true;

    clearInterval(matchTimerInterval);

    const overlay = document.createElement("div");
    overlay.className = "battle-result-overlay";

    let resultClass, label;

    if (payload.loser_reason === "cheating") {
        const cheater = payload.loser_username;
        const isCheater = cheater === currentUser.username;
        resultClass = isCheater ? "lose" : "win";
        label = isCheater ? "Bạn đã bị xử thua vì gian lận!" : "Đối thủ bị xử thua vì gian lận!";
    } else {
        const isDraw = !payload.winner_username;
        const isWinner = payload.winner_username === currentUser.username;
        resultClass = isDraw ? "draw" : isWinner ? "win" : "lose";
        label = isDraw ? "Trận hòa" : isWinner ? "Bạn thắng!" : "Bạn thua!";
    }

    overlay.innerHTML = `
        <div class="battle-result-box">
            <h1 class="${resultClass}">${label}</h1>
            <p class="redirect-message">Quay về Dashboard trong 5 giây...</p>
        </div>
    `;

    document.getElementById("app").appendChild(overlay);

    document.getElementById("submit-btn").disabled = true;
    document.getElementById("code-editor").disabled = true;

    setTimeout(() => {

        cleanupBattleRoom();

        history.pushState(null, null, "/dashboard");
        window.router();

        setTimeout(() => {
            document.dispatchEvent(new CustomEvent("reload_dashboard"));
        }, 300);

    }, 5000);
}

