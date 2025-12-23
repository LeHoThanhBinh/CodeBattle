import { getAccessToken } from "../../services/storage.js";

export function initHistoryPage() {
  loadBattleHistory();
}

async function loadBattleHistory() {
  const tableBody = document.getElementById("historyTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; opacity:0.7;">
        Loading battle history...
      </td>
    </tr>
  `;

  const token = getAccessToken();

  try {
    const API_BASE = "http://127.0.0.1:8000";
    const response = await fetch(`${API_BASE}/api/battle-history/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, 
      },
    });

    if (response.status === 401) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#e53e3e;">
            Session expired. Please login again.
          </td>
        </tr>
      `;
      return;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to fetch history: ${response.status} ${text}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; opacity:0.7;">
            No battle history found.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = "";

    for (const match of data) {
      const opponent = escapeHtml(match.opponent ?? "Unknown");
      const language = escapeHtml(match.language ?? "N/A");
      const difficulty = escapeHtml(match.difficulty ?? "N/A");
      const resultText = (match.result ?? "Draw").toString();
      const resultLower = resultText.toLowerCase(); 
      const createdAt = formatDate(match.date);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${opponent}</td>
        <td>${language}</td>
        <td>${difficulty}</td>
        <td class="result-${resultLower}">${escapeHtml(resultText)}</td>
        <td>${createdAt}</td>
      `;
      tableBody.appendChild(row);
    }
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:#e53e3e;">
          Failed to load battle history.
        </td>
      </tr>
    `;
  }
}

function formatDate(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
