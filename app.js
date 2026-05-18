const groups = {
  A: ["Mexico", "South Africa", "Korea Republic", "Czech Republic"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["USA", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Cote d'Ivoire", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Islamic Republic of Iran", "New Zealand"],
  H: ["Spain", "Cabo Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const teamLogos = {
  Mexico: "🇲🇽",
  "South Africa": "🇿🇦",
  "Korea Republic": "🇰🇷",
  "Czech Republic": "🇨🇿",
  Canada: "🇨🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  Qatar: "🇶🇦",
  Switzerland: "🇨🇭",
  Brazil: "🇧🇷",
  Morocco: "🇲🇦",
  Haiti: "🇭🇹",
  Scotland: "🏴",
  USA: "🇺🇸",
  Paraguay: "🇵🇾",
  Australia: "🇦🇺",
  Turkey: "🇹🇷",
  Germany: "🇩🇪",
  Curacao: "🇨🇼",
  "Cote d'Ivoire": "🇨🇮",
  Ecuador: "🇪🇨",
  Netherlands: "🇳🇱",
  Japan: "🇯🇵",
  Sweden: "🇸🇪",
  Tunisia: "🇹🇳",
  Belgium: "🇧🇪",
  Egypt: "🇪🇬",
  "Islamic Republic of Iran": "🇮🇷",
  "New Zealand": "🇳🇿",
  Spain: "🇪🇸",
  "Cabo Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦",
  Uruguay: "🇺🇾",
  France: "🇫🇷",
  Senegal: "🇸🇳",
  Iraq: "🇮🇶",
  Norway: "🇳🇴",
  Argentina: "🇦🇷",
  Algeria: "🇩🇿",
  Austria: "🇦🇹",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  "Congo DR": "🇨🇩",
  Uzbekistan: "🇺🇿",
  Colombia: "🇨🇴",
  England: "🏴",
  Croatia: "🇭🇷",
  Ghana: "🇬🇭",
  Panama: "🇵🇦",
};

const pointsByRank = [4, 3, 2, 1];
const challengeLockDate = new Date("2026-06-11T00:00:00-04:00");
const appKey = "tru-world-cup-app-v2";
const legacyDraftKey = "tru-world-cup-bracket";
const legacyResultsKey = "tru-world-cup-results";

const freshPicks = () => Object.fromEntries(Object.entries(groups).map(([letter, teams]) => [letter, [...teams]]));
const freshResults = () => Object.fromEntries(Object.keys(groups).map((letter) => [letter, ["", "", "", ""]]));
const freshDraft = () => ({
  id: null,
  playerName: "",
  rootingFor: "",
  picks: freshPicks(),
  advancingThird: [],
});

const appState = loadApp();

const groupsGrid = document.querySelector("#groupsGrid");
const resultsGrid = document.querySelector("#resultsGrid");
const thirdPlaceList = document.querySelector("#thirdPlaceList");
const actualThirdPlaceList = document.querySelector("#actualThirdPlaceList");
const playerName = document.querySelector("#playerName");
const rootingFor = document.querySelector("#rootingFor");
const entryStatus = document.querySelector("#entryStatus");
const entriesTable = document.querySelector("#entriesTable");
const leaderboard = document.querySelector("#leaderboard");
const saveEntryButton = document.querySelector("#saveEntry");
const teamOptions = document.querySelector("#teamOptions");
const challengeStatus = document.querySelector("#challengeStatus");
const entryCount = document.querySelector("#entryCount");
const resultsProgress = document.querySelector("#resultsProgress");
const countdown = document.querySelector("#countdown");
const leaderName = document.querySelector("#leaderName");
const runnerName = document.querySelector("#runnerName");
const entryMode = document.querySelector("#entryMode");
const winnerPrize = document.querySelector("#winnerPrize");
const runnerPrize = document.querySelector("#runnerPrize");

renderTeamOptions();
hydrateDraftFields();
renderPickGroups();
renderThirdPlaceChoices();
renderEntriesTable();
renderResults();
renderLeaderboard();
updateAutomationDashboard();
setInterval(updateAutomationDashboard, 60000);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}`).classList.add("active");
  });
});

playerName.addEventListener("input", () => {
  appState.draft.playerName = playerName.value.trim();
  setStatus("Draft auto-saved.");
  saveApp();
});

rootingFor.addEventListener("input", () => {
  appState.draft.rootingFor = rootingFor.value.trim();
  setStatus("Draft auto-saved.");
  saveApp();
});

document.querySelector("#newEntry").addEventListener("click", () => {
  appState.draft = freshDraft();
  hydrateDraftFields();
  renderPickGroups();
  renderThirdPlaceChoices();
  setStatus("Ready for the next staff member.");
  saveApp();
});

document.querySelector("#resetPicks").addEventListener("click", () => {
  appState.draft.picks = freshPicks();
  appState.draft.advancingThird = [];
  renderPickGroups();
  renderThirdPlaceChoices();
  setStatus("Picks reset for this entry.");
  saveApp();
});

document.querySelector("#saveEntry").addEventListener("click", () => {
  const validation = validateDraft();
  if (validation) {
    setStatus(validation, true);
    return;
  }

  const entry = {
    id: appState.draft.id || crypto.randomUUID(),
    playerName: appState.draft.playerName,
    rootingFor: appState.draft.rootingFor,
    picks: clone(appState.draft.picks),
    advancingThird: [...appState.draft.advancingThird],
    submittedAt: appState.draft.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = appState.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    appState.entries[existingIndex] = entry;
    setStatus(`${entry.playerName}'s entry was updated.`);
  } else {
    appState.entries.push(entry);
    setStatus(`${entry.playerName}'s entry was submitted.`);
  }

  appState.draft = freshDraft();
  hydrateDraftFields();
  renderPickGroups();
  renderThirdPlaceChoices();
  renderEntriesTable();
  renderLeaderboard();
  saveApp();
});

document.querySelector("#exportEntries").addEventListener("click", async () => {
  const csv = buildEntriesCsv();
  try {
    await navigator.clipboard.writeText(csv);
    setStatus("CSV copied to clipboard.");
  } catch {
    alert(csv);
  }
});

document.querySelector("#copySummary").addEventListener("click", async () => {
  const summary = buildLeaderboardSummary();
  try {
    await navigator.clipboard.writeText(summary);
    document.querySelector("#copySummary").textContent = "Copied";
    setTimeout(() => (document.querySelector("#copySummary").textContent = "Copy Summary"), 1300);
  } catch {
    alert(summary);
  }
});

document.querySelector("#printKnockout").addEventListener("click", () => {
  document.body.classList.add("print-knockout");
  window.print();
  setTimeout(() => document.body.classList.remove("print-knockout"), 300);
});

function loadApp() {
  const fallback = {
    draft: freshDraft(),
    entries: [],
    results: { finishes: freshResults(), advancingThird: [] },
  };

  try {
    const saved = JSON.parse(localStorage.getItem(appKey));
    if (saved) {
      return normalizeState({ ...fallback, ...saved });
    }

    const legacyDraft = JSON.parse(localStorage.getItem(legacyDraftKey));
    const legacyResults = JSON.parse(localStorage.getItem(legacyResultsKey));
    return normalizeState({
      ...fallback,
      draft: legacyDraft
        ? {
            ...freshDraft(),
            playerName: legacyDraft.playerName || "",
            picks: normalizeGroups(legacyDraft.picks),
            advancingThird: legacyDraft.advancingThird || [],
          }
        : fallback.draft,
      results: legacyResults?.finishes
        ? { finishes: normalizeResultsGroups(legacyResults.finishes), advancingThird: legacyResults.advancingThird || [] }
        : fallback.results,
    });
  } catch {
    return fallback;
  }
}

function normalizeState(state) {
  return {
    draft: {
      ...freshDraft(),
      ...(state.draft || {}),
      picks: normalizeGroups(state.draft?.picks),
      advancingThird: state.draft?.advancingThird || [],
    },
    entries: (state.entries || []).map((entry) => ({
      ...entry,
      picks: normalizeGroups(entry.picks),
      advancingThird: entry.advancingThird || [],
    })),
    results: {
      finishes: normalizeResultsGroups(state.results?.finishes),
      advancingThird: state.results?.advancingThird || [],
    },
  };
}

function normalizeGroups(value) {
  const normalized = freshPicks();
  Object.keys(groups).forEach((letter) => {
    if (!Array.isArray(value?.[letter])) return;
    const knownTeams = value[letter].filter((team) => groups[letter].includes(team));
    const missingTeams = groups[letter].filter((team) => !knownTeams.includes(team));
    normalized[letter] = [...knownTeams, ...missingTeams].slice(0, 4);
  });
  return normalized;
}

function normalizeResultsGroups(value) {
  const normalized = freshResults();
  Object.keys(groups).forEach((letter) => {
    if (!Array.isArray(value?.[letter])) return;
    normalized[letter] = value[letter].map((team) => (groups[letter].includes(team) ? team : "")).slice(0, 4);
    while (normalized[letter].length < 4) normalized[letter].push("");
  });
  return normalized;
}

function saveApp() {
  localStorage.setItem(appKey, JSON.stringify(appState));
  updateAutomationDashboard();
}

function renderTeamOptions() {
  teamOptions.innerHTML = Object.values(groups)
    .flat()
    .map((team) => `<option value="${escapeHtml(team)}"></option>`)
    .join("");
}

function hydrateDraftFields() {
  playerName.value = appState.draft.playerName || "";
  rootingFor.value = appState.draft.rootingFor || "";
  saveEntryButton.textContent = appState.draft.id ? "Update Entry" : "Submit Entry";
}

function renderPickGroups() {
  groupsGrid.innerHTML = "";

  Object.keys(groups).forEach((letter) => {
    const card = buildGroupCard(letter, appState.draft.picks[letter], true);
    groupsGrid.appendChild(card);
  });
}

function buildGroupCard(letter, teams, canDrag) {
  const template = document.querySelector("#groupTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.group = letter;
  card.querySelector("h3").textContent = `Group ${letter}`;
  card.querySelector(".group-title span").textContent = canDrag ? "Drag to rank" : "Actual finish";
  const list = card.querySelector(".team-list");

  teams.forEach((team, index) => {
    const item = document.createElement("li");
    item.className = "team-row";
    item.draggable = canDrag;
    item.dataset.team = team;
    item.innerHTML = `<span class="rank">${index + 1}</span>${teamLabel(team)}<span class="handle">::</span>`;
    list.appendChild(item);
  });

  if (canDrag) attachDragHandlers(list, letter);

  return card;
}

function attachDragHandlers(list, letter) {
  list.addEventListener("dragstart", (event) => {
    const row = event.target.closest(".team-row");
    if (!row) return;
    row.classList.add("dragging");
  });

  list.addEventListener("dragend", (event) => {
    const row = event.target.closest(".team-row");
    if (!row) return;
    row.classList.remove("dragging");
    appState.draft.picks[letter] = [...list.querySelectorAll(".team-row")].map((row) => row.dataset.team);
    refreshRanks(list);
    renderThirdPlaceChoices();
    saveApp();
  });

  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    const dragging = list.querySelector(".dragging");
    const next = getDragAfterElement(list, event.clientY);
    if (!dragging) return;
    if (next == null) list.appendChild(dragging);
    else list.insertBefore(dragging, next);
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".team-row:not(.dragging)")];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function refreshRanks(list) {
  list.querySelectorAll(".team-row").forEach((row, index) => {
    row.querySelector(".rank").textContent = index + 1;
  });
}

function renderThirdPlaceChoices() {
  thirdPlaceList.innerHTML = "";
  const thirdPlaceTeams = Object.entries(appState.draft.picks).map(([letter, teams]) => ({ letter, team: teams[2] }));
  appState.draft.advancingThird = appState.draft.advancingThird.filter((team) =>
    thirdPlaceTeams.some((pick) => pick.team === team)
  );

  thirdPlaceTeams.forEach(({ letter, team }) => {
    const label = document.createElement("label");
    label.className = "third-choice";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(team)}" ${appState.draft.advancingThird.includes(team) ? "checked" : ""}>
      <strong>Group ${letter}: ${teamLabel(team)}</strong>
    `;
    label.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked && appState.draft.advancingThird.length >= 8) {
        event.target.checked = false;
        setStatus("Choose exactly eight third-place teams.", true);
        return;
      }
      appState.draft.advancingThird = [...thirdPlaceList.querySelectorAll("input:checked")].map((input) => input.value);
      saveApp();
    });
    thirdPlaceList.appendChild(label);
  });

  saveApp();
}

function renderEntriesTable() {
  entriesTable.innerHTML = "";
  if (!appState.entries.length) {
    entriesTable.innerHTML = `<tr><td colspan="5" class="empty-cell">No staff entries yet.</td></tr>`;
    updateAutomationDashboard();
    return;
  }

  scoreEntries().forEach(({ entry, score }) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(entry.playerName)}</strong></td>
      <td>${entry.rootingFor ? teamLabel(entry.rootingFor) : "-"}</td>
      <td>${entry.advancingThird.length}/8</td>
      <td><strong>${score.total}</strong></td>
      <td class="row-actions">
        <button type="button" data-action="edit" data-id="${entry.id}">Edit</button>
        <button type="button" data-action="delete" data-id="${entry.id}">Delete</button>
      </td>
    `;
    entriesTable.appendChild(row);
  });

  entriesTable.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = appState.entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      if (button.dataset.action === "edit") {
        appState.draft = clone(entry);
        hydrateDraftFields();
        renderPickGroups();
        renderThirdPlaceChoices();
        setStatus(`Editing ${entry.playerName}'s entry.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        appState.entries = appState.entries.filter((item) => item.id !== entry.id);
        renderEntriesTable();
        renderLeaderboard();
        saveApp();
        setStatus(`${entry.playerName}'s entry was removed.`);
      }
    });
  });
}

function renderResults() {
  resultsGrid.innerHTML = "";

  Object.entries(groups).forEach(([letter, teams]) => {
    const card = document.createElement("article");
    card.className = "group-card";
    card.innerHTML = `
      <div class="group-title">
        <h3>Group ${letter}</h3>
        <span>Actual finish</span>
      </div>
      <div class="team-list"></div>
    `;
    const list = card.querySelector(".team-list");
    for (let rank = 0; rank < 4; rank += 1) {
      const row = document.createElement("label");
      row.className = "result-row";
      const options = [""]
        .concat(teams)
        .map((team) => {
          const label = team || "Select team";
          return `<option value="${escapeHtml(team)}" ${appState.results.finishes[letter][rank] === team ? "selected" : ""}>${label}</option>`;
        })
        .join("");
      row.innerHTML = `<span class="rank">${rank + 1}</span><span class="result-logo">${logoFor(appState.results.finishes[letter][rank])}</span><select>${options}</select>`;
      const select = row.querySelector("select");
      select.addEventListener("change", () => {
        clearDuplicateResult(list, select);
        appState.results.finishes[letter] = [...list.querySelectorAll("select")].map((select) => select.value);
        updateResultLogos(list);
        renderActualThirdPlaceChoices();
        renderEntriesTable();
        renderLeaderboard();
        saveApp();
      });
      list.appendChild(row);
    }
    resultsGrid.appendChild(card);
  });

  renderActualThirdPlaceChoices();
}

function clearDuplicateResult(list, changedSelect) {
  if (!changedSelect.value) return;
  list.querySelectorAll("select").forEach((select) => {
    if (select !== changedSelect && select.value === changedSelect.value) {
      select.value = "";
    }
  });
}

function renderActualThirdPlaceChoices() {
  actualThirdPlaceList.innerHTML = "";
  const thirdPlaceTeams = Object.entries(appState.results.finishes)
    .map(([letter, teams]) => ({ letter, team: teams[2] }))
    .filter((pick) => pick.team);
  appState.results.advancingThird = appState.results.advancingThird.filter((team) =>
    thirdPlaceTeams.some((pick) => pick.team === team)
  );

  if (!thirdPlaceTeams.length) {
    actualThirdPlaceList.innerHTML = `<p class="muted">Enter actual 3rd-place finishers above first.</p>`;
    saveApp();
    return;
  }

  thirdPlaceTeams.forEach(({ letter, team }) => {
    const label = document.createElement("label");
    label.className = "third-choice";
    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(team)}" ${appState.results.advancingThird.includes(team) ? "checked" : ""}>
      <strong>Group ${letter}: ${teamLabel(team)}</strong>
    `;
    label.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked && appState.results.advancingThird.length >= 8) {
        event.target.checked = false;
        return;
      }
      appState.results.advancingThird = [...actualThirdPlaceList.querySelectorAll("input:checked")].map((input) => input.value);
      renderEntriesTable();
      renderLeaderboard();
      saveApp();
    });
    actualThirdPlaceList.appendChild(label);
  });

  saveApp();
}

function validateDraft() {
  if (isEntryLocked()) return "Entries are locked because the group stage has started.";
  if (!appState.draft.playerName) return "Enter the staff member's name before submitting.";
  if (appState.draft.advancingThird.length !== 8) return "Select exactly eight third-place teams before submitting.";
  return "";
}

function scoreEntries() {
  return appState.entries
    .map((entry) => ({ entry, score: calculateEntryScore(entry) }))
    .sort((a, b) => b.score.total - a.score.total || a.entry.playerName.localeCompare(b.entry.playerName));
}

function calculateEntryScore(entry) {
  let total = 0;
  let perfectGroups = 0;
  let exactPicks = 0;

  Object.keys(groups).forEach((letter) => {
    const picks = entry.picks[letter];
    const actual = appState.results.finishes[letter];
    let groupPerfect = actual.every(Boolean);

    picks.forEach((team, rank) => {
      if (actual[rank] === team) {
        total += pointsByRank[rank];
        exactPicks += 1;
      } else {
        groupPerfect = false;
      }
    });

    if (groupPerfect) {
      total += 5;
      perfectGroups += 1;
    }
  });

  const thirdPoints = entry.advancingThird.filter((team) => appState.results.advancingThird.includes(team)).length;
  total += thirdPoints;

  return { total, exactPicks, perfectGroups, thirdPoints };
}

function renderLeaderboard() {
  const scored = scoreEntries();
  leaderboard.innerHTML = "";

  if (!scored.length) {
    leaderboard.innerHTML = `<p class="muted">No entries yet.</p>`;
    winnerPrize.textContent = "Pending";
    runnerPrize.textContent = "Pending";
    updateAutomationDashboard();
    return;
  }

  winnerPrize.textContent = `${scored[0].entry.playerName} - ${scored[0].score.total} pts`;
  runnerPrize.textContent = scored[1] ? `${scored[1].entry.playerName} - ${scored[1].score.total} pts` : "Pending";

  scored.forEach(({ entry, score }, index) => {
    const item = document.createElement("div");
    item.className = "leaderboard-row";
    item.innerHTML = `
      <span class="place">${index + 1}</span>
      <div>
        <strong>${escapeHtml(entry.playerName)}</strong>
        <small>${score.exactPicks} exact, ${score.perfectGroups} perfect groups, ${score.thirdPoints} third-place pts</small>
      </div>
      <b>${score.total}</b>
    `;
    leaderboard.appendChild(item);
  });

  updateAutomationDashboard();
}

function buildLeaderboardSummary() {
  const lines = ["Tru by Hilton Orlando Convention Center World Cup Challenge Leaderboard", ""];
  scoreEntries().forEach(({ entry, score }, index) => {
    lines.push(`${index + 1}. ${entry.playerName} - ${score.total} pts`);
  });
  return lines.join("\n");
}

function buildEntriesCsv() {
  const rows = [["Name", "Rooting For", "Score", "Third-Place Advancers", ...Object.keys(groups).map((letter) => `Group ${letter}`)]];
  scoreEntries().forEach(({ entry, score }) => {
    rows.push([
      entry.playerName,
      entry.rootingFor || "",
      score.total,
      entry.advancingThird.join("; "),
      ...Object.keys(groups).map((letter) => entry.picks[letter].join(" > ")),
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function updateResultLogos(list) {
  list.querySelectorAll(".result-row").forEach((row) => {
    const select = row.querySelector("select");
    row.querySelector(".result-logo").textContent = logoFor(select.value);
  });
}

function teamLabel(team) {
  return `<span class="team-name"><span class="team-logo" aria-hidden="true">${logoFor(team)}</span><span>${escapeHtml(team)}</span></span>`;
}

function logoFor(team) {
  return teamLogos[team] || "⚽";
}

function updateAutomationDashboard() {
  const scored = scoreEntries();
  const filledResults = Object.values(appState.results.finishes).flat().filter(Boolean).length;
  const resultPercent = Math.round((filledResults / 48) * 100);
  const locked = isEntryLocked();
  const timeLeft = challengeLockDate.getTime() - Date.now();

  entryCount.textContent = appState.entries.length;
  resultsProgress.textContent = `${resultPercent}%`;
  leaderName.textContent = scored[0] ? `${scored[0].entry.playerName} (${scored[0].score.total} pts)` : "No entries yet";
  runnerName.textContent = scored[1] ? `${scored[1].entry.playerName} (${scored[1].score.total} pts)` : "No entries yet";
  entryMode.textContent = locked ? "Locked" : "Open";
  challengeStatus.textContent = locked ? "Entries locked - group stage underway" : "Entries open - auto-saved";
  saveEntryButton.disabled = locked;
  saveEntryButton.textContent = locked ? "Entries Locked" : appState.draft.id ? "Update Entry" : "Submit Entry";

  if (timeLeft <= 0) {
    countdown.textContent = "Locked";
    return;
  }

  const days = Math.floor(timeLeft / 86400000);
  const hours = Math.floor((timeLeft % 86400000) / 3600000);
  countdown.textContent = `${days}d ${hours}h`;
}

function isEntryLocked() {
  return Date.now() >= challengeLockDate.getTime();
}

function setStatus(message, isError = false) {
  entryStatus.textContent = message;
  entryStatus.classList.toggle("error", isError);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
