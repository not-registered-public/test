// mock.js – interceptet fetch für eine kleine "Server"-Simulation

// Original fetch merken
const realFetch = window.fetch;

// In-Memory-Regelsätze
const RULESETS = {
  v1: {
    steps: [
      { id: "plan",    title: "Plan wählen" },
      { id: "company", title: "Firma",   showIf: { field: "plan", equals: "business" } },
      { id: "addons",  title: "Add-ons", showIf: { field: "plan", in: ["pro","business"] } },
      { id: "payment", title: "Zahlung", showIf: { any: [
        { field: "plan", equals: "pro" },
        { field: "plan", equals: "business" }
      ]}}
    ]
  },
  // v2: Zahlung nur sichtbar, wenn Add-on "backup" aktiv ist
  v2: {
    steps: [
      { id: "plan",    title: "Plan wählen" },
      { id: "company", title: "Firma",   showIf: { field: "plan", equals: "business" } },
      { id: "addons",  title: "Add-ons", showIf: { field: "plan", in: ["pro","business"] } },
      { id: "payment", title: "Zahlung", showIf: { all: [
        { any: [
          { field: "plan", equals: "pro" },
          { field: "plan", equals: "business" }
        ]},
        { field: "addons.backup", truthy: true }
      ]}}
    ]
  }
};

let CURRENT_RULESET = "v1";

// --- Evaluator wie "Server" ---
const getByPath = (obj, path) =>
  path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);

function evalRule(rule, answers) {
  console.log("rule: " + JSON.stringify(rule));
  if (!rule) return true;
  if (rule.all) return rule.all.every(r => evalRule(r, answers));
  if (rule.any) return rule.any.some(r => evalRule(r, answers));
  if (rule.not) return !evalRule(rule.not, answers);
  if (rule.field) {
    const val = getByPath(answers, rule.field);
    if ("equals" in rule) return val === rule.equals;
    if (Array.isArray(rule.in)) return rule.in.includes(val);
    if ("exists" in rule) return (val !== undefined) === !!rule.exists;
    if ("truthy" in rule) return !!val === !!rule.truthy;
  }
  return false;
}
function computeVisibleServerSide(answers, rulesetKey) {
  console.log("rulesetKey: " + rulesetKey);
  const steps = RULESETS[rulesetKey].steps;
  console.log("steps: " + JSON.stringify(steps));
  return steps.filter(s => evalRule(s.showIf, answers)).map(s => s.id);
}

// --- fetch patchen ---
window.fetch = async (input, init = {}) => {
  console.log("fetch catch");
  const url = typeof input === "string" ? input : input.url;
  const method = (init.method || "GET").toUpperCase();

  // GET /api/form/rules?v=1|2
  if (url.startsWith("/api/form/rules") && method === "GET") {
    console.log("GET empfangen");
    const vMatch = url.match(/[?&]v=(\d+)/);
    CURRENT_RULESET = vMatch?.[1] === "2" ? "v2" : "v1";
    const body = JSON.stringify({ version: CURRENT_RULESET, ...RULESETS[CURRENT_RULESET] });
    await new Promise(r => setTimeout(r, 120)); // kleine Latenz
    return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // POST /api/visible-steps
  if (url === "/api/visible-steps" && method === "POST") {
    console.log("POST empfangen");
    await new Promise(r => setTimeout(r, 120));
    const ctype = (init.headers && ((init.headers["Content-Type"]) || (init.headers["content-type"]))) || "";
    if (!ctype.includes("application/json")) {
      return new Response(JSON.stringify({ ok:false, error:"Content-Type muss application/json sein" }), {
        status: 415, headers: { "Content-Type": "application/json" }
      });
    }
    const reqBody = JSON.parse(init.body || "{}");
    console.log("ss reqBody: " + JSON.stringify(reqBody));
    const answers = reqBody.answers || {};
    console.log("ss answers:" + JSON.stringify(answers) );
    const visible = computeVisibleServerSide(answers, CURRENT_RULESET);
    console.log("ss visible: " + visible);
    return new Response(JSON.stringify({ ok:true, visible }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  // alles andere normal
  return realFetch(input, init);
};

// Export (optional), falls du den aktuellen Ruleset-Stand woanders brauchst
export const __mock = {
  get current() { return CURRENT_RULESET; },
  set current(v) { if (v === "v1" || v === "v2") CURRENT_RULESET = v; }
};
