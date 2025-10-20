// Giả lập hàm để lấy matchId từ URL, ví dụ: /battle-room.html#123
function getMatchIdFromURL() {
    return window.location.hash.substring(1);
}

// Hàm giả lập gọi API để lấy dữ liệu trận đấu
async function fetchMatchData(matchId) {
    console.log(`Fetching data for match ID: ${matchId}`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                matchId: matchId,
                player1: { userId: 1, username: 'Binh Le', rating: 1520 },
                player2: { userId: 2, username: 'Opponent', rating: 1550 },
                problem: {
                    problemId: 101,
                    title: 'Valid Parentheses',
                    description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
                    difficulty: 2,
                    timeLimit: 1000,
                    memoryLimit: 256,
                },
                duration: 900 // 15 phút
            });
        }, 500); // Giảm thời gian chờ để tải nhanh hơn
    });
}

// Hàm giả lập chờ cả hai người chơi sẵn sàng
function waitForMatchToStart(matchId, onReadyCallback) {
    console.log(`Waiting for match ${matchId} to start...`);
    // Trong ứng dụng thực tế, đây sẽ là một WebSocket listener.
    // Ở đây, chúng ta giả lập một khoảng chờ 3 giây.
    setTimeout(() => {
        console.log(`Match ${matchId} is now active!`);
        onReadyCallback(); // Gọi hàm callback khi trận đấu sẵn sàng
    }, 3000);
}

// Hàm chính để khởi tạo toàn bộ logic phòng đấu
async function setupBattleRoom(matchData) {
    let timeLeft = matchData.duration;
    let timerInterval;

    // Lấy các element trên trang
    const timerEl = document.getElementById('match-timer');
    const codeEditorEl = document.getElementById('code-editor');
    const languageSelectorEl = document.getElementById('language-selector');
    const submitBtnEl = document.getElementById('submit-btn');
    const resultContainerEl = document.getElementById('submission-result-container');

    // Hàm để render dữ liệu ban đầu lên giao diện
    function renderPage() {
        document.getElementById('player1-info').innerHTML = `
            <div class="username">${matchData.player1.username}</div>
            <div class="rating">Rating: ${matchData.player1.rating}</div>`;
        document.getElementById('player2-info').innerHTML = `
            <div class="username">${matchData.player2.username}</div>
            <div class="rating">Rating: ${matchData.player2.rating}</div>`;
        document.getElementById('problem-title').textContent = matchData.problem.title;
        document.getElementById('problem-difficulty').innerHTML = `<span style="color: #2ecc71">Difficulty: ${matchData.problem.difficulty}/5</span>`;
        document.getElementById('problem-time-limit').textContent = `Time: ${matchData.problem.timeLimit}ms`;
        document.getElementById('problem-memory-limit').textContent = `Memory: ${matchData.problem.memoryLimit}MB`;
        document.getElementById('problem-description').innerHTML = `<p>${matchData.problem.description}</p>`;
        codeEditorEl.value = `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!";\n    return 0;\n}`;
    }

    // Hàm cập nhật đồng hồ
    function updateTimer() {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerEl.textContent = "00:00";
            submitBtnEl.disabled = true;
            submitBtnEl.textContent = "Time's Up!";
            return;
        }
        const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const secs = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
        timeLeft--;
    }
    
    // Hàm xử lý nộp bài
    function handleCodeSubmission() {
        submitBtnEl.disabled = true;
        submitBtnEl.textContent = 'Submitting...';
        resultContainerEl.innerHTML = `<div class="result-status loading">PENDING</div>`;

        setTimeout(() => {
            const isAccepted = Math.random() > 0.4;
            const result = {
                status: isAccepted ? 'ACCEPTED' : 'WRONG_ANSWER',
                executionTime: Math.floor(Math.random() * 200) + 50,
                memoryUsed: Math.floor(Math.random() * 50) + 10,
                testCasesPassed: isAccepted ? 10 : 7,
                totalTestCases: 10,
            };

            const statusClass = result.status === 'ACCEPTED' ? 'accepted' : 'wrong';
            resultContainerEl.innerHTML = `
                <div class="result-status ${statusClass}">
                    ${result.status.replace('_', ' ')}
                </div>
                <div class="result-details-grid">
                    <span>Execution Time:</span><strong>${result.executionTime} ms</strong>
                    <span>Memory Used:</span><strong>${result.memoryUsed} KB</strong>
                    <span>Test Cases:</span><strong>${result.testCasesPassed} / ${result.totalTestCases}</strong>
                </div>
            `;
            
            submitBtnEl.disabled = false;
            submitBtnEl.textContent = 'Submit Solution';
        }, 2500);
    }

    // Gắn các sự kiện
    submitBtnEl.addEventListener('click', handleCodeSubmission);

    // Bắt đầu chạy
    renderPage();
    timerInterval = setInterval(updateTimer, 1000);
}


// Hàm khởi tạo chính của trang
export function initBattleRoomPage() {
    const matchId = getMatchIdFromURL();
    if (!matchId) {
        document.querySelector("#app").innerHTML = "<h1>Match ID not found in URL.</h1>";
        return;
    }

    const waitingOverlay = document.getElementById('waiting-overlay');
    const battleRoomMain = document.getElementById('battle-room-main');

    // Hiển thị màn hình chờ ngay lập tức
    waitingOverlay.style.display = 'flex';
    battleRoomMain.style.display = 'none';

    // Bắt đầu chờ trận đấu
    waitForMatchToStart(matchId, async () => {
        // Khi trận đấu sẵn sàng, ẩn màn hình chờ và hiển thị phòng đấu
        waitingOverlay.style.display = 'none';
        battleRoomMain.style.display = 'flex';

        // Lấy dữ liệu trận đấu và thiết lập giao diện
        const matchData = await fetchMatchData(matchId);
        setupBattleRoom(matchData);
    });
}

