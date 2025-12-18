// form.js – UI-State, Events, Sichtbarkeit via POST /api/visible-steps

const rulesInfo = document.getElementById("rulesInfo");
const debug = document.getElementById("debug");

// === set Refs ===
console.log("set Refs");
const ALL = ["panel-1","panel-2","panel-3"];
const refs = Object.fromEntries(ALL.map(id => [id, document.getElementById(id)]));
console.log("refs: " + JSON.stringify(refs));
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

// Antworten-State
const state = { answers: {} };

function setAnswer(path, value) {
  console.log("path: " + path);
  console.log("value: " + value);
  const parts = path.split(".");
  let ref = state.answers;
  console.log("state.answers: " + JSON.stringify(state.answers));
  while (parts.length > 1) {
    const k = parts.shift();
    ref[k] = ref[k] || {};
    ref = ref[k];
    console.log("ref: " + JSON.stringify(ref));
  }
  ref[parts[0]] = value;
  refreshVisibility(); // nach jeder Änderung Sichtbarkeit neu ermitteln
}

async function loadRules(version = 1) {
  console.log("load rules...");
  console.log("sende GET");
  const res = await fetch(`/api/form/rules?v=${version}`);
  const json = await res.json();
  rulesInfo.textContent = `Regeln aktiv: ${json.version} (geladen um ${new Date().toLocaleTimeString()})`;
  refreshVisibility();
}

async function refreshVisibility() {
  console.log("sende POST -> body... state.answers=" + JSON.stringify({answers: state.answers}));  
  const res = await fetch("/api/visible-steps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers: state.answers })
  });
  const data = await res.json();
  const visible = new Set(data.visible || []);
  console.log("visible: " + JSON.stringify(visible));
  ["plan","company","addons","payment"].forEach(id => {
    console.log("id: " + id);
    console.log("has id: " + visible.has(id));
    document.getElementById(`card-${id}`).classList.toggle("hidden", !visible.has(id));
  });
  debug.textContent =
    `Rules: ${rulesInfo.textContent}\n` +
    `Answers: ${JSON.stringify(state.answers)}\n` +
    `Visible: ${JSON.stringify([...visible])}`;
}

// Inputs binden
document.querySelectorAll('input[name="plan"]').forEach(r =>
  r.addEventListener("change", e => setAnswer("plan", e.target.value))
);
document.getElementById("company.name")
  .addEventListener("input", e => setAnswer("company.name", e.target.value));
document.getElementById("addons.backup")
  .addEventListener("change", e => setAnswer("addons.backup", e.target.checked));
document.getElementById("payment.cardLast4")
  .addEventListener("input", e => setAnswer("payment.cardLast4", e.target.value));

// Regelversion-Buttons
document.getElementById("reloadRulesV1").onclick = () => loadRules(1);
document.getElementById("reloadRulesV2").onclick = () => loadRules(2);

// Initial starten
loadRules(1); // 1 = Rules V1

