const groupTeams = {
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

const groupPoints = [4, 3, 2, 1];
const groupStorageKey = "tru-world-cup-app-v2";
const knockoutStorageKey = "tru-world-cup-knockout-v1";
const roundKeys = ["r32", "r16", "qf", "sf", "final"];
const roundLabels = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Champion"];
const roundPoints = { r32: 1, r16: 2, qf: 4, sf: 6, final: 10 };

const pageState = {
  group: loadLocalGroup(),
  knockout: loadLocalKnockout(),
};

document.querySelector("#printPage").addEventListener("click", () => window.print());

renderAll();
initializeFirebase();

function freshGroupResults() {
  return Object.fromEntries(Object.keys(groupTeams).map((letter) => [letter, ["", "", "", ""]]));
}

function freshKnockoutPicks() {
  return {
    r32: Array(16).fill(""),
    r16: Array(8).fill(""),
    qf: Array(4).fill(""),
    sf: Array(2).fill(""),
    final: Array(1).fill(""),
  };
}

function loadLocalGroup() {
  const fallback = { entries: [], results: { finishes: freshGroupResults(), advancingThird: [] } };
  try {
    return normalizeGroup({ ...fallback, ...(JSON.parse(localStorage.getItem(groupStorageKey)) || {}) });
  } catch {
    return fallback;
  }
}

function loadLocalKnockout() {
  const fallback = { entries: [], teams: Array(32).fill(""), official: freshKnockoutPicks() };
  try {
    return normalizeKnockout({ ...fallback, ...(JSON.parse(localStorage.getItem(knockoutStorageKey)) || {}) });
  } catch {
    return fallback;
  }
}

function normalizeGroup(value) {
  return {
    entries: (value.entries || []).map((entry) => ({ ...entry, picks: normalizeGroupPicks(entry.picks) })),
    results: {
      finishes: normalizeGroupResults(value.results?.finishes),
      advancingThird: value.results?.advancingThird || [],
    },
  };
}

function normalizeGroupPicks(value) {
  return Object.fromEntries(
    Object.entries(groupTeams).map(([letter, teams]) => {
      const known = (value?.[letter] || []).filter((team) => teams.includes(team));
      const missing = teams.filter((team) => !known.includes(team));
      return [letter, [...known, ...missing].slice(0, 4)];
    })
  );
}

function normalizeGroupResults(value) {
  return Object.fromEntries(
    Object.entries(groupTeams).map(([letter, teams]) => [
      letter,
      Array.from({ length: 4 }, (_, index) => (teams.includes(value?.[letter]?.[index]) ? value[letter][index] : "")),
    ])
  );
}

function normalizeKnockout(value) {
  return {
    teams: Array.from({ length: 32 }, (_, index) => value.teams?.[index] || ""),
    official: normalizeKnockoutPicks(value.official),
    entries: (value.entries || []).map((entry) => ({ ...entry, picks: normalizeKnockoutPicks(entry.picks) })),
  };
}

function normalizeKnockoutPicks(value) {
  const fresh = freshKnockoutPicks();
  return Object.fromEntries(roundKeys.map((key) => [key, Array.from({ length: fresh[key].length }, (_, index) => value?.[key]?.[index] || "")]));
}

function scoreGroupEntry(entry) {
  let total = 0;
  let exactPicks = 0;
  let perfectGroups = 0;
  Object.keys(groupTeams).forEach((letter) => {
    const picks = entry.picks[letter];
    const actual = pageState.group.results.finishes[letter];
    let perfect = actual.every(Boolean);
    picks.forEach((team, index) => {
      if (actual[index] === team) {
        total += groupPoints[index];
        exactPicks += 1;
      } else {
        perfect = false;
      }
    });
    if (perfect) {
      total += 5;
      perfectGroups += 1;
    }
  });
  const thirdPoints = (entry.advancingThird || []).filter((team) => pageState.group.results.advancingThird.includes(team)).length;
  total += thirdPoints;
  return { total, exactPicks, perfectGroups, thirdPoints };
}

function scoreKnockoutEntry(entry) {
  let total = 0;
  const breakdown = {};
  roundKeys.forEach((key) => {
    breakdown[key] = 0;
    entry.picks[key].forEach((pick, index) => {
      if (pick && pageState.knockout.official[key][index] && pick === pageState.knockout.official[key][index]) {
        total += roundPoints[key];
        breakdown[key] += roundPoints[key];
      }
    });
  });
  return { total, breakdown };
}

function sortedGroupEntries() {
  return pageState.group.entries
    .map((entry) => ({ entry, score: scoreGroupEntry(entry) }))
    .sort((a, b) => b.score.total - a.score.total || (a.entry.playerName || "").localeCompare(b.entry.playerName || ""));
}

function sortedKnockoutEntries() {
  return pageState.knockout.entries
    .map((entry) => ({ entry, score: scoreKnockoutEntry(entry) }))
    .sort((a, b) => b.score.total - a.score.total || (a.entry.name || "").localeCompare(b.entry.name || ""));
}

function renderAll() {
  renderSummary();
  renderGroupRows();
  renderKnockoutRows();
  renderOfficialKnockout();
}

function renderSummary() {
  const groupScored = sortedGroupEntries();
  const knockoutScored = sortedKnockoutEntries();
  document.querySelector("#groupEntryCount").textContent = pageState.group.entries.length;
  document.querySelector("#knockoutEntryCount").textContent = pageState.knockout.entries.length;
  document.querySelector("#groupWinner").textContent = groupScored[0] ? `${groupScored[0].entry.playerName} (${groupScored[0].score.total})` : "Pending";
  document.querySelector("#knockoutWinner").textContent = knockoutScored[0] ? `${knockoutScored[0].entry.name} (${knockoutScored[0].score.total})` : "Pending";
}

function renderGroupRows() {
  const body = document.querySelector("#groupRows");
  const rows = sortedGroupEntries();
  body.innerHTML = rows.length
    ? rows
        .map(
          ({ entry, score }, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(entry.playerName || "")}</td>
              <td>${escapeHtml(entry.rootingFor || "")}</td>
              <td>${score.exactPicks}</td>
              <td>${score.perfectGroups}</td>
              <td>${score.thirdPoints}</td>
              <td>${score.total}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="7" class="empty">No group-stage entries yet.</td></tr>`;
}

function renderKnockoutRows() {
  const body = document.querySelector("#knockoutRows");
  const rows = sortedKnockoutEntries();
  body.innerHTML = rows.length
    ? rows
        .map(
          ({ entry, score }, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(entry.name || "")}</td>
              <td>${escapeHtml(entry.picks.final[0] || "")}</td>
              <td>${score.breakdown.r32}</td>
              <td>${score.breakdown.r16}</td>
              <td>${score.breakdown.qf}</td>
              <td>${score.breakdown.sf}</td>
              <td>${score.breakdown.final}</td>
              <td>${score.total}</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="9" class="empty">No knockout brackets submitted yet.</td></tr>`;
}

function renderOfficialKnockout() {
  const grid = document.querySelector("#officialKnockout");
  grid.innerHTML = roundKeys
    .map((key, index) => {
      const winners = pageState.knockout.official[key].filter(Boolean);
      return `
        <article class="official-card">
          <span>${roundLabels[index]}</span>
          <strong>${winners.length ? winners.map(escapeHtml).join(", ") : "Pending"}</strong>
        </article>
      `;
    })
    .join("");
}

function initializeFirebase() {
  const config = window.TRU_FIREBASE_CONFIG || {};
  const hasConfig = Boolean(config.apiKey && config.projectId && window.firebase?.initializeApp);
  if (!hasConfig) {
    document.querySelector("#syncStatus").textContent = "Local browser results";
    return;
  }
  try {
    firebase.initializeApp(config);
  } catch (error) {
    if (!String(error?.message || "").includes("already exists")) {
      document.querySelector("#syncStatus").textContent = "Firebase configuration error";
      return;
    }
  }
  const db = firebase.firestore();
  const trackerId = window.TRU_FIREBASE_TRACKER_ID || "world-cup-2026";
  document.querySelector("#syncStatus").textContent = "Loading Firebase results...";

  db.collection("trackers")
    .doc(trackerId)
    .onSnapshot((doc) => {
      const data = doc.data();
      if (data?.results) {
        pageState.group.results = normalizeGroup({ ...pageState.group, results: data.results }).results;
        renderAll();
      }
      document.querySelector("#syncStatus").textContent = "Firebase results loaded";
    });

  db.collection("trackers")
    .doc(trackerId)
    .collection("entries")
    .onSnapshot((snapshot) => {
      const entries = [];
      snapshot.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));
      pageState.group.entries = normalizeGroup({ ...pageState.group, entries }).entries;
      renderAll();
      document.querySelector("#syncStatus").textContent = "Firebase results loaded";
    });

  db.collection("trackers")
    .doc(trackerId)
    .collection("knockout")
    .doc("state")
    .onSnapshot((doc) => {
      const data = doc.data();
      if (data) {
        pageState.knockout.teams = normalizeKnockout({ ...pageState.knockout, teams: data.teams }).teams;
        pageState.knockout.official = normalizeKnockoutPicks(data.official);
        renderAll();
      }
      document.querySelector("#syncStatus").textContent = "Firebase results loaded";
    });

  db.collection("trackers")
    .doc(trackerId)
    .collection("knockoutEntries")
    .onSnapshot((snapshot) => {
      const entries = [];
      snapshot.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));
      pageState.knockout.entries = normalizeKnockout({ ...pageState.knockout, entries }).entries;
      renderAll();
      document.querySelector("#syncStatus").textContent = "Firebase results loaded";
    });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}
