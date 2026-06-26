const roundKeys = ["r32", "r16", "qf", "sf", "final"];
const roundLabels = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Champion"];
const roundPoints = { r32: 1, r16: 2, qf: 4, sf: 6, final: 10 };
const knockoutStorageKey = "tru-world-cup-knockout-v1";

const freshPicks = () => ({
  r32: Array(16).fill(""),
  r16: Array(8).fill(""),
  qf: Array(4).fill(""),
  sf: Array(2).fill(""),
  final: Array(1).fill(""),
});

const freshState = () => ({
  teams: Array(32).fill(""),
  official: freshPicks(),
  entries: [],
  draft: {
    id: null,
    name: "",
    rootingFor: "",
    picks: freshPicks(),
  },
});

const firebaseSync = {
  db: null,
  trackerId: "world-cup-2026",
  ready: false,
  applyingRemote: false,
};

const state = loadState();

const entryBracket = document.querySelector("#entryBracket");
const officialBracket = document.querySelector("#officialBracket");
const teamSetup = document.querySelector("#teamSetup");
const participantName = document.querySelector("#participantName");
const rootingFor = document.querySelector("#rootingFor");
const entryStatus = document.querySelector("#entryStatus");
const leaderboard = document.querySelector("#leaderboard");
const entryCount = document.querySelector("#entryCount");
const leaderName = document.querySelector("#leaderName");
const championPick = document.querySelector("#championPick");
const resultsProgress = document.querySelector("#resultsProgress");
const officialChampion = document.querySelector("#officialChampion");
const syncStatus = document.querySelector("#syncStatus");
const qrUrl = document.querySelector("#qrUrl");
const qrImage = document.querySelector("#qrImage");
const qrCaption = document.querySelector("#qrCaption");

hydrateFields();
renderAll();
initializeFirebase();

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}`).classList.add("active");
  });
});

participantName.addEventListener("input", () => {
  state.draft.name = participantName.value.trim();
  saveState();
});

rootingFor.addEventListener("input", () => {
  state.draft.rootingFor = rootingFor.value.trim();
  saveState();
});

document.querySelector("#clearBracket").addEventListener("click", () => {
  state.draft = { id: null, name: "", rootingFor: "", picks: freshPicks() };
  hydrateFields();
  renderEntryBracket();
  setStatus("Bracket cleared.");
  saveState();
});

document.querySelector("#saveBracket").addEventListener("click", () => {
  const error = validateBracket();
  if (error) {
    setStatus(error, true);
    return;
  }

  const entry = {
    id: state.draft.id || crypto.randomUUID(),
    name: state.draft.name,
    rootingFor: state.draft.rootingFor,
    picks: clone(state.draft.picks),
    submittedAt: state.draft.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const index = state.entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) state.entries[index] = entry;
  else state.entries.push(entry);

  state.draft = { id: null, name: "", rootingFor: "", picks: freshPicks() };
  hydrateFields();
  renderAll();
  setStatus(`${entry.name}'s bracket was submitted.`);
  saveEntryToFirebase(entry);
  saveState();
});

document.querySelector("#saveTeams").addEventListener("click", () => {
  state.teams = [...teamSetup.querySelectorAll("input")].map((input) => input.value.trim());
  state.official = sanitizeOfficial(state.official);
  renderAll();
  setStatus("Matchups saved.");
  saveState();
});

document.querySelector("#copyStandings").addEventListener("click", async () => {
  const text = scoreEntries()
    .map(({ entry, score }, index) => `${index + 1}. ${entry.name} - ${score.total} pts`)
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    alert(text);
  }
});

document.querySelector("#printQr").addEventListener("click", () => window.print());

qrUrl.addEventListener("input", () => updateQr());

function loadState() {
  try {
    return normalizeState({ ...freshState(), ...(JSON.parse(localStorage.getItem(knockoutStorageKey)) || {}) });
  } catch {
    return freshState();
  }
}

function normalizeState(value) {
  return {
    teams: Array.from({ length: 32 }, (_, index) => value.teams?.[index] || ""),
    official: normalizePicks(value.official),
    entries: (value.entries || []).map((entry) => ({ ...entry, picks: normalizePicks(entry.picks) })),
    draft: {
      ...freshState().draft,
      ...(value.draft || {}),
      picks: normalizePicks(value.draft?.picks),
    },
  };
}

function normalizePicks(value) {
  return Object.fromEntries(roundKeys.map((key) => [key, Array.from({ length: freshPicks()[key].length }, (_, index) => value?.[key]?.[index] || "")]));
}

function saveState() {
  localStorage.setItem(knockoutStorageKey, JSON.stringify(state));
  if (!firebaseSync.applyingRemote) saveKnockoutStateToFirebase();
  updateStats();
}

function hydrateFields() {
  participantName.value = state.draft.name || "";
  rootingFor.value = state.draft.rootingFor || "";
  qrUrl.value = localStorage.getItem("tru-knockout-qr-url") || window.location.href;
  updateQr();
}

function renderAll() {
  renderTeamSetup();
  renderEntryBracket();
  renderOfficialBracket();
  renderLeaderboard();
  updateStats();
}

function renderTeamSetup() {
  teamSetup.innerHTML = "";
  state.teams.forEach((team, index) => {
    const wrap = document.createElement("div");
    wrap.className = "team-input";
    wrap.innerHTML = `<label>Match ${Math.floor(index / 2) + 1} - Team ${(index % 2) + 1}</label><input value="${escapeHtml(team)}" placeholder="Team name">`;
    teamSetup.appendChild(wrap);
  });
}

function renderEntryBracket() {
  entryBracket.innerHTML = "";
  renderBracket(entryBracket, state.draft.picks, "draft");
}

function renderOfficialBracket() {
  officialBracket.innerHTML = "";
  renderBracket(officialBracket, state.official, "official");
}

function renderBracket(container, picks, mode) {
  roundKeys.forEach((roundKey, roundIndex) => {
    const round = document.createElement("section");
    round.className = "round";
    round.innerHTML = `<h3>${roundLabels[roundIndex]}</h3>`;
    getRoundOptions(picks, roundKey).forEach((teams, matchIndex) => {
      const match = document.createElement("div");
      match.className = "match";
      teams.forEach((team) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `pick-button ${picks[roundKey][matchIndex] === team ? "selected" : ""}`;
        button.textContent = team || "TBD";
        button.disabled = !team;
        button.addEventListener("click", () => {
          picks[roundKey][matchIndex] = team;
          clearLaterPicks(picks, roundKey, matchIndex);
          if (mode === "draft") renderEntryBracket();
          else {
            state.official = sanitizeOfficial(state.official);
            renderOfficialBracket();
            renderLeaderboard();
          }
          saveState();
        });
        match.appendChild(button);
      });
      round.appendChild(match);
    });
    container.appendChild(round);
  });
}

function getRoundOptions(picks, roundKey) {
  if (roundKey === "r32") {
    return Array.from({ length: 16 }, (_, index) => [state.teams[index * 2], state.teams[index * 2 + 1]]);
  }
  const previousKey = roundKeys[roundKeys.indexOf(roundKey) - 1];
  const previousWinners = picks[previousKey];
  return Array.from({ length: picks[roundKey].length }, (_, index) => [previousWinners[index * 2], previousWinners[index * 2 + 1]]);
}

function clearLaterPicks(picks, roundKey) {
  const start = roundKeys.indexOf(roundKey) + 1;
  for (let index = start; index < roundKeys.length; index += 1) {
    picks[roundKeys[index]].fill("");
  }
}

function sanitizeOfficial(official) {
  const normalized = normalizePicks(official);
  roundKeys.forEach((roundKey) => {
    getRoundOptions(normalized, roundKey).forEach((teams, index) => {
      if (!teams.includes(normalized[roundKey][index])) normalized[roundKey][index] = "";
    });
  });
  return normalized;
}

function validateBracket() {
  if (!state.draft.name) return "Enter your name before submitting.";
  if (state.draft.picks.final[0]) return "";
  return "Complete your bracket through champion before submitting.";
}

function scoreEntries() {
  return state.entries
    .map((entry) => ({ entry, score: scoreEntry(entry) }))
    .sort((a, b) => b.score.total - a.score.total || a.entry.name.localeCompare(b.entry.name));
}

function scoreEntry(entry) {
  let total = 0;
  const breakdown = {};
  roundKeys.forEach((key) => {
    breakdown[key] = 0;
    entry.picks[key].forEach((pick, index) => {
      if (pick && state.official[key][index] && pick === state.official[key][index]) {
        total += roundPoints[key];
        breakdown[key] += roundPoints[key];
      }
    });
  });
  return { total, breakdown };
}

function renderLeaderboard() {
  const scored = scoreEntries();
  leaderboard.innerHTML = "";
  if (!scored.length) {
    leaderboard.innerHTML = `<p class="muted">No brackets submitted yet.</p>`;
    return;
  }
  scored.forEach(({ entry, score }, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    row.innerHTML = `
      <span class="place">${index + 1}</span>
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>Champion: ${escapeHtml(entry.picks.final[0] || "Pending")}</small>
      </div>
      <b>${score.total}</b>
    `;
    leaderboard.appendChild(row);
  });
}

function updateStats() {
  const scored = scoreEntries();
  const officialPicks = Object.values(state.official).flat();
  const completed = officialPicks.filter(Boolean).length;
  const possible = officialPicks.length;
  entryCount.textContent = state.entries.length;
  leaderName.textContent = scored[0] ? `${scored[0].entry.name} (${scored[0].score.total} pts)` : "No entries yet";
  championPick.textContent = state.official.final[0] || "Pending";
  officialChampion.textContent = state.official.final[0] || "Pending";
  resultsProgress.textContent = `${Math.round((completed / possible) * 100)}%`;
}

function updateQr() {
  const value = qrUrl.value.trim();
  localStorage.setItem("tru-knockout-qr-url", value);
  if (!value) {
    qrImage.removeAttribute("src");
    qrCaption.textContent = "Paste your website link to generate a QR code.";
    return;
  }
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(value)}`;
  qrCaption.textContent = value;
}

function initializeFirebase() {
  const config = window.TRU_FIREBASE_CONFIG || {};
  const hasConfig = Boolean(config.apiKey && config.projectId && window.firebase?.initializeApp);
  if (!hasConfig) {
    syncStatus.textContent = "Local mode - add Firebase config for shared status";
    return;
  }
  try {
    firebase.initializeApp(config);
  } catch (error) {
    if (!String(error?.message || "").includes("already exists")) {
      syncStatus.textContent = "Firebase config error";
      return;
    }
  }
  firebaseSync.db = firebase.firestore();
  firebaseSync.trackerId = window.TRU_FIREBASE_TRACKER_ID || firebaseSync.trackerId;
  syncStatus.textContent = "Firebase sync connecting...";
  listenToFirebase();
}

function trackerRef() {
  return firebaseSync.db.collection("trackers").doc(firebaseSync.trackerId);
}

function knockoutRef() {
  return trackerRef().collection("knockout").doc("state");
}

function entriesRef() {
  return trackerRef().collection("knockoutEntries");
}

function listenToFirebase() {
  knockoutRef().onSnapshot(
    (doc) => {
      firebaseSync.applyingRemote = true;
      const data = doc.data();
      if (data?.teams) state.teams = normalizeState({ ...state, teams: data.teams }).teams;
      if (data?.official) state.official = normalizePicks(data.official);
      firebaseSync.ready = true;
      localStorage.setItem(knockoutStorageKey, JSON.stringify(state));
      renderAll();
      syncStatus.textContent = "Firebase sync active";
      firebaseSync.applyingRemote = false;
    },
    () => {
      syncStatus.textContent = "Firebase read failed";
    }
  );

  entriesRef().onSnapshot(
    (snapshot) => {
      firebaseSync.applyingRemote = true;
      const remoteEntries = [];
      snapshot.forEach((doc) => remoteEntries.push({ id: doc.id, ...doc.data() }));
      state.entries = mergeEntries(state.entries, remoteEntries);
      firebaseSync.ready = true;
      localStorage.setItem(knockoutStorageKey, JSON.stringify(state));
      renderLeaderboard();
      updateStats();
      syncStatus.textContent = "Firebase sync active";
      firebaseSync.applyingRemote = false;
      syncLocalEntriesToFirebase();
    },
    () => {
      syncStatus.textContent = "Firebase entries read failed";
    }
  );
}

function saveKnockoutStateToFirebase() {
  if (!firebaseSync.db || firebaseSync.applyingRemote) return;
  knockoutRef().set(
    {
      teams: clean(state.teams),
      official: clean(state.official),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

function saveEntryToFirebase(entry) {
  if (!firebaseSync.db) return;
  entriesRef().doc(entry.id).set(clean(entry), { merge: true });
}

function syncLocalEntriesToFirebase() {
  if (!firebaseSync.db) return;
  state.entries.forEach((entry) => saveEntryToFirebase(entry));
}

function mergeEntries(localEntries, remoteEntries) {
  const merged = new Map();
  [...remoteEntries, ...localEntries].forEach((entry) => {
    const existing = merged.get(entry.id);
    if (!existing || new Date(entry.updatedAt || entry.submittedAt || 0) >= new Date(existing.updatedAt || existing.submittedAt || 0)) {
      merged.set(entry.id, { ...entry, picks: normalizePicks(entry.picks) });
    }
  });
  return [...merged.values()];
}

function setStatus(message, isError = false) {
  entryStatus.textContent = message;
  entryStatus.classList.toggle("error", isError);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
