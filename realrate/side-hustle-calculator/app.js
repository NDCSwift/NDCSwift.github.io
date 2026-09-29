// Wires the calculator page to calc.js. All math lives in calc.js; this file reads fields and
// renders. Nothing is stored and nothing is sent: no storage APIs, no fetch, no share link
// (NDCSwift/RealRate#223, "Privacy").

import {
  parseAmount, payRate, trueRate, totalExpenses, hustleState, needsHoursConfirm,
  formatMeasuredRate, formatStatedRate, rank, insightLine, meetsTarget, HOURS_CONFIRM_THRESHOLD,
} from "./calc.js";

const MAX_HUSTLES = 3;
const LOCALE = navigator.language || "en-US";

// A short list on purpose: the common currencies of English-speaking side hustlers plus a few.
// No conversion happens anywhere, so the choice only sets the symbol and the decimals.
const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "JPY", "CHF", "INR", "MXN", "SEK"];
const REGION_CURRENCY = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", JP: "JPY", CH: "CHF", IN: "INR", MX: "MXN", SE: "SEK",
  IE: "EUR", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR",
  FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

function defaultCurrency() {
  try {
    const region = new Intl.Locale(LOCALE).maximize().region;
    return REGION_CURRENCY[region] || "USD";
  } catch {
    return "USD";
  }
}

const form = document.getElementById("calc-form");
const list = document.getElementById("hustles");
const template = document.getElementById("hustle-template");
const addButton = document.getElementById("add-hustle");
const currencySelect = document.getElementById("currency");
const targetInput = document.getElementById("target");
const results = document.getElementById("results");
const announcer = document.getElementById("announcer");
const cta = document.getElementById("cta");

let nextId = 1;
const everRated = new Set();

// MARK: - Currency picker

(function buildCurrencyPicker() {
  let names = null;
  try { names = new Intl.DisplayNames([LOCALE], { type: "currency" }); } catch { /* older browsers */ }
  const chosen = defaultCurrency();
  for (const code of CURRENCIES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = names ? `${code} · ${names.of(code)}` : code;
    option.selected = code === chosen;
    currencySelect.append(option);
  }
})();

const currency = () => currencySelect.value;

// MARK: - Hustle fieldsets

function addHustle({ focus = false } = {}) {
  const id = nextId++;
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = String(id);
  for (const input of node.querySelectorAll("input[data-field]")) {
    input.id = `h${id}-${input.dataset.field}`;
  }
  for (const label of node.querySelectorAll("label[data-for]")) {
    label.htmlFor = `h${id}-${label.dataset.for}`;
  }
  const hint = node.querySelector(".hours-hint");
  hint.id = `h${id}-hours-hint`;
  const confirm = node.querySelector(".soft-confirm");
  confirm.id = `h${id}-hours-confirm`;
  node.querySelector(`#h${id}-hours`).setAttribute("aria-describedby", hint.id);
  node.querySelector(".remove").addEventListener("click", () => removeHustle(node));
  list.append(node);
  relabel();
  if (focus) node.querySelector(`#h${id}-name`).focus();
  update();
}

function removeHustle(node) {
  everRated.delete(node.dataset.id);
  node.remove();
  relabel();
  addButton.focus();
  update();
}

function relabel() {
  const nodes = [...list.children];
  nodes.forEach((node, i) => {
    node.querySelector("legend").textContent = `Hustle ${i + 1}`;
    const remove = node.querySelector(".remove");
    remove.hidden = nodes.length === 1;
    remove.setAttribute("aria-label", `Remove hustle ${i + 1}`);
  });
  addButton.hidden = nodes.length >= MAX_HUSTLES;
}

function readHustle(node, position) {
  const value = (field) => node.querySelector(`[data-field="${field}"]`).value;
  const expenses = [...node.querySelectorAll("[data-cost]")].map((input) => parseAmount(input.value));
  const name = value("name").trim() || `Hustle ${position + 1}`;
  const h = { id: node.dataset.id, node, name, income: parseAmount(value("income")), hours: parseAmount(value("hours")), expenses };
  h.state = hustleState(h);
  h.rate = h.state === "rated" ? trueRate(h) : null;
  h.pay = h.state === "rated" ? payRate(h) : null;
  h.costs = totalExpenses(expenses);
  return h;
}

// MARK: - Rendering

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderFieldNotes(h) {
  const code = currency();
  const hoursInput = h.node.querySelector('[data-field="hours"]');
  const confirm = h.node.querySelector(".soft-confirm");
  const hint = h.node.querySelector(".hours-hint");
  if (needsHoursConfirm(h.hours)) {
    confirm.textContent = `That's more than ${HOURS_CONFIRM_THRESHOLD} hours in one month, about 10 a day. If that's right, carry on. If it's a year's hours, enter one month's.`;
    confirm.hidden = false;
    hoursInput.setAttribute("aria-describedby", `${hint.id} ${confirm.id}`);
  } else {
    confirm.hidden = true;
    hoursInput.setAttribute("aria-describedby", hint.id);
  }
  const total = h.node.querySelector(".costs-total");
  total.textContent = h.costs > 0 ? `Costs so far: ${new Intl.NumberFormat(LOCALE, { style: "currency", currency: code }).format(h.costs)}` : "";
}

function resultRow(h, position, showRank, target) {
  const code = currency();
  const li = el("li", "result");
  if (!everRated.has(h.id)) { li.classList.add("is-new"); everRated.add(h.id); }

  const name = el("div", "result-name");
  if (showRank) name.append(el("span", "result-rank", `${position + 1}.`));
  name.append(el("span", null, h.name));
  li.append(name);

  const reveal = el("div", "reveal");
  reveal.append(el("span", "before", `${formatMeasuredRate(h.pay, code, LOCALE)} before costs`));
  const arrow = el("span", "arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  reveal.append(arrow);
  const after = el("span", "after", formatMeasuredRate(h.rate, code, LOCALE));
  if (h.rate < 0) after.classList.add("loss");
  if (h.rate === 0) after.classList.add("zero");
  reveal.append(after);
  let caption = "after costs";
  if (h.costs === 0) caption = "after costs (none entered)";
  else if (h.rate < 0) caption = "after costs: this hustle costs more than it brings in";
  reveal.append(el("span", "caption", caption));
  li.append(reveal);

  const meets = meetsTarget(h.rate, target);
  if (meets !== null) {
    const verdict = el("p", `verdict ${meets ? "meets" : "misses"}`);
    const mark = el("span", null, meets ? "✓" : "✗");
    mark.setAttribute("aria-hidden", "true");
    verdict.append(mark, el("span", null, `${meets ? "At or above" : "Below"} your ${formatStatedRate(target, code, LOCALE)}`));
    li.append(verdict);
  }
  return li;
}

function pendingRow(h) {
  const li = el("li", "result");
  li.append(el("div", "result-name", h.name));
  const message = h.state === "needsHours"
    ? "Add your hours to see the rate."
    : "Add what it brought in to see the rate.";
  li.append(el("p", "pending", message));
  return li;
}

let announceTimer = null;
function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    if (announcer.textContent !== text) announcer.textContent = text;
  }, 900);
}

function update() {
  const code = currency();
  const hustles = [...list.children].map(readHustle);
  hustles.forEach(renderFieldNotes);

  const rated = rank(hustles.filter((h) => h.state === "rated"));
  const pending = hustles.filter((h) => h.state === "needsHours" || h.state === "needsIncome");
  const target = parseAmount(targetInput.value);

  results.replaceChildren();
  if (rated.length === 0 && pending.length === 0) {
    results.append(el("p", "empty-result", "Your rate appears here once you've entered what a hustle brought in and the hours it took."));
    cta.hidden = true;
    announce("");
    return;
  }

  const insight = insightLine(rated, code, LOCALE);
  if (insight) {
    const box = el("div", "insight");
    box.append(el("strong", null, insight.headline), el("span", null, insight.detail));
    results.append(box);
  }

  const ol = el("ol", "ranked");
  ol.setAttribute("aria-label", rated.length > 1 ? "Your hustles, highest true rate first" : "Your hustle");
  rated.forEach((h, i) => ol.append(resultRow(h, i, rated.length > 1, target)));
  pending.forEach((h) => ol.append(pendingRow(h)));
  results.append(ol);

  cta.hidden = rated.length === 0;

  const spoken = rated.map((h) => {
    const meets = meetsTarget(h.rate, target);
    const verdict = meets === null ? "" : meets ? ", at or above your target" : ", below your target";
    return `${h.name}: ${formatMeasuredRate(h.rate, code, LOCALE)} after costs${verdict}.`;
  });
  if (insight) spoken.push(`${insight.headline}.`);
  announce(spoken.join(" "));
}

// MARK: - Events

form.addEventListener("input", update);
form.addEventListener("submit", (event) => event.preventDefault());
currencySelect.addEventListener("change", update);
targetInput.addEventListener("input", update);
addButton.addEventListener("click", () => addHustle({ focus: true }));

addHustle();
