import { apiFetch } from "./api.js";

let pasteCount = 0;
let tabSwitchCount = 0;
let lastSnapshot = "";
let lastActionTime = Date.now();

// Lưu tất cả listeners để remove
let cleanupFunctions = [];

// ======================================================
// 🔥 Gửi log Anti-Cheat lên Backend
// ======================================================
async function sendAntiCheatLog(matchId, type, details = "") {
    try {
        await apiFetch("/api/anti-cheat/log/", {
            method: "POST",
            body: JSON.stringify({
                match_id: matchId,
                log_type: type,
                details: details
            })
        });
    } catch (err) {
        console.error("❌ Failed to send anti-cheat log:", err);
    }
}

// ======================================================
// 🚫 1. DETECT PASTE
// ======================================================
export function setupPasteDetection(editorElement, matchId, username) {
    function onPaste(event) {
        event.preventDefault();
        pasteCount++;

        if (pasteCount === 1) {
            sendAntiCheatLog(matchId, "PASTE_ACTION", `${username} pasted once`);
            setTimeout(() => { editorElement.value = ""; }, 0);
            setTimeout(() => alert("⚠️ WARNING: Paste detected! Your editor was reset."), 10);
        } 
        else {
            sendAntiCheatLog(matchId, "PASTE_ACTION", `${username} pasted twice`);
            alert("❌ You pasted again! Backend will auto-lose you.");
        }
    }

    editorElement.addEventListener("paste", onPaste);
    cleanupFunctions.push(() => editorElement.removeEventListener("paste", onPaste));
}

// ======================================================
// 🚫 2. DETECT TYPING SPEED
// ======================================================
export function setupCodeChangeTracking(editorElement, matchId) {
    function onInput() {
        const now = Date.now();
        const code = editorElement.value;

        if (Math.abs(code.length - lastSnapshot.length) > 20) {
            sendAntiCheatLog(matchId, "CODE_SNAPSHOT", code.substring(0, 3000));
            lastSnapshot = code;
        }

        const delta = now - lastActionTime;
        lastActionTime = now;

        if (delta < 15) {
            sendAntiCheatLog(
                matchId,
                "SUSPICIOUS_TYPING_SPEED",
                `Typing interval: ${delta}ms`
            );
        }
    }

    editorElement.addEventListener("input", onInput);
    cleanupFunctions.push(() => editorElement.removeEventListener("input", onInput));
}

// ======================================================
// 🚫 3. DETECT LARGE TEXT SELECTION
// ======================================================
export function setupSelectionDetection(editorElement, matchId) {
    function onSelect() {
        const selection = window.getSelection().toString();
        if (selection.length > 20) {
            sendAntiCheatLog(
                matchId,
                "CODE_SELECTION",
                `Selected ${selection.length} chars`
            );
        }
    }

    editorElement.addEventListener("mouseup", onSelect);
    cleanupFunctions.push(() => editorElement.removeEventListener("mouseup", onSelect));
}

// ======================================================
// 🚫 4. DETECT TAB SWITCH
// ======================================================
export function setupTabSwitchDetection(matchId, username) {
    function onTabSwitch() {
        if (document.hidden) {
            tabSwitchCount++;

            sendAntiCheatLog(
                matchId,
                "TAB_SWITCH",
                `Switched tabs (${tabSwitchCount} times)`
            );

            if (tabSwitchCount === 1) {
                alert("⚠️ WARNING: Switching tabs is not allowed!");
            }

            if (tabSwitchCount >= 2) {
                alert("❌ You switched tabs too many times! Backend will auto-lose you.");
            }
        }
    }

    document.addEventListener("visibilitychange", onTabSwitch);
    cleanupFunctions.push(() =>
        document.removeEventListener("visibilitychange", onTabSwitch)
    );
}

// ======================================================
// ⭐ ENABLE FULL ANTI-CHEAT
// ======================================================
export function enableAntiCheat(editorElement, matchId, ws, username) {
    pasteCount = 0;
    tabSwitchCount = 0;
    cleanupFunctions = [];

    setupPasteDetection(editorElement, matchId, username);
    setupCodeChangeTracking(editorElement, matchId);
    setupSelectionDetection(editorElement, matchId);
    setupTabSwitchDetection(matchId, username);

    console.log("Anti-cheat enabled for match", matchId);
}

// ======================================================
// ❌ DISABLE ANTI-CHEAT (bắt buộc khi rời battle-room)
// ======================================================
export function disableAntiCheat() {
    console.log("🛑 Anti-cheat disabled");

    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
}
