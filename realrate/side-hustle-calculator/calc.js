// The side hustle calculator's math: pure, no DOM, no storage, no network.
// Pinned by `_tests/realrate-calc.test.mjs` (run `node --test _tests/*.test.mjs`).
//
// Every rule here is the RealRate app's, copied rather than re-decided (NDCSwift/RealRate#223):
//   - Pay Rate is income ÷ hours; True Rate nets every expense first (`RateBasis`, #24/#54).
//   - No hours, no rate: `null`, never "$0.00/hr".
//   - A measured rate that rounds to nothing is named — "under $0.01/hr" — with the threshold
//     taken from the currency's minor unit, so yen reads "under ¥1/hr" (#46).
//   - Ranking puts a loss above an unrated hustle (#3), and the insight line is InsightEngine's
//     top-vs-bottom rule with Double+Multiplier's truncation.
// Formatting follows the reader's locale with the currency supplied, as the app does (#35).

/** The hours in one month above which the page asks "is that right?" — a soft confirm, not a cap. */
export const HOURS_CONFIRM_THRESHOLD = 300;

/**
 * A non-negative finite number from a field's text, or null for blank/invalid. Money has no cap.
 *
 * Takes amounts the way people type them in any locale: a currency symbol, spaces, and either
 * mark as the decimal. With both marks present, the last one is the decimal. A lone comma is a
 * decimal unless exactly three digits follow it ("1,500" is fifteen hundred, "12,50" is twelve
 * and a half).
 */
export function parseAmount(text) {
  if (text == null) return null;
  let s = String(text).trim();
  if (s === "" || /^-/.test(s) || /-/.test(s)) return null;
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    s = parts.length === 2 && parts[1].length !== 3 ? parts.join(".") : parts.join("");
  }
  if (!/^\d*\.?\d*$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** The sum of the expense lines that were filled in. */
export function totalExpenses(lines = []) {
  return lines.reduce((sum, v) => (Number.isFinite(v) ? sum + v : sum), 0);
}

/** Income ÷ hours, before costs. null when there are no hours. */
export function payRate({ income, hours }) {
  if (!(hours > 0) || !Number.isFinite(income)) return null;
  return income / hours;
}

/** (Income − every expense) ÷ hours: the true hourly rate. null when there are no hours. */
export function trueRate({ income, hours, expenses = [] }) {
  if (!(hours > 0) || !Number.isFinite(income)) return null;
  return (income - totalExpenses(expenses)) / hours;
}

/** "empty" · "needsIncome" · "needsHours" · "rated" — what one hustle's card should show. */
export function hustleState({ income, hours, expenses = [] }) {
  const hasIncome = Number.isFinite(income);
  const hasHours = hours > 0;
  const hasCosts = expenses.some((v) => Number.isFinite(v) && v > 0);
  if (hasIncome && hasHours) return "rated";
  if (!hasIncome && !hasHours && !hasCosts) return "empty";
  if (!hasHours && (hasIncome || hasCosts)) return "needsHours";
  return "needsIncome";
}

export function needsHoursConfirm(hours) {
  return Number.isFinite(hours) && hours > HOURS_CONFIRM_THRESHOLD;
}

// MARK: - Currency

function currencyFormat(currency, locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency });
}

/** How many decimals the currency uses: 2 for USD and EUR, 0 for JPY. */
export function fractionDigits(currency, locale) {
  return currencyFormat(currency, locale).resolvedOptions().maximumFractionDigits;
}

/** The smallest amount the currency can express, derived rather than written as 0.01. */
export function minorUnit(currency, locale) {
  return 10 ** -fractionDigits(currency, locale);
}

// Half away from zero, as Swift's `.rounded()`; JS Math.round sends -0.5 to -0.
function roundHalfAway(x) {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** True when a non-zero rate would print as zero in this currency. */
export function roundsAway(rate, currency, locale) {
  const digits = fractionDigits(currency, locale);
  return rate !== 0 && roundHalfAway(rate * 10 ** digits) === 0;
}

function money(amount, currency, locale) {
  return currencyFormat(currency, locale).format(amount);
}

/**
 * A rate measured from what the user entered. A loss is named in words ("losing $10.00/hr");
 * a sub-unit rate is named rather than rounded to zero; exactly zero stays "$0.00/hr".
 */
export function formatMeasuredRate(rate, currency, locale) {
  if (roundsAway(rate, currency, locale)) {
    const smallest = money(minorUnit(currency, locale), currency, locale);
    return rate > 0 ? `under ${smallest}/hr` : `losing under ${smallest}/hr`;
  }
  // Rounded before the sign test, so -0.004 in USD cannot become "losing $0.00/hr".
  const digits = fractionDigits(currency, locale);
  const shown = roundHalfAway(rate * 10 ** digits) / 10 ** digits;
  if (shown < 0) return `losing ${money(-shown, currency, locale)}/hr`;
  return `${money(shown, currency, locale)}/hr`;
}

/** A rate somebody stated (a target): plain rounding, no sub-unit form. */
export function formatStatedRate(rate, currency, locale) {
  return `${money(rate, currency, locale)}/hr`;
}

// MARK: - Ranking and the insight line

/**
 * Highest rate first; a loss still outranks a hustle with no rate; ties keep entry order.
 * Items are `{ rate, ... }`; the array is not mutated.
 */
export function rank(items) {
  return items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => {
      const ra = a.item.rate, rb = b.item.rate;
      if (ra == null && rb == null) return a.order - b.order;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra || a.order - b.order;
    })
    .map(({ item }) => item);
}

/** "6.5×", truncated to tenths; "10×+" from ten up. */
export function multiplier(ratio) {
  if (!Number.isFinite(ratio) || ratio >= 10) return "10×+";
  const tenths = Math.floor(Math.max(ratio, 0) * 10 + 1e-9);
  const whole = Math.floor(tenths / 10), fraction = tenths % 10;
  return fraction === 0 ? `${whole}×` : `${whole}.${fraction}×`;
}

/**
 * One line in the style of the app's insight card, or null. Only when at least two hustles have
 * a rate and the bottom one is positive: "X pays 5× more than Y" at ≥1.5× apart, otherwise
 * "X is your top earner". Items are `{ name, rate }`.
 */
export function insightLine(items, currency, locale) {
  const rated = rank(items).filter((h) => h.rate != null);
  if (rated.length < 2) return null;
  const best = rated[0], worst = rated[rated.length - 1];
  if (!(worst.rate > 0)) return null;
  const ratio = best.rate / worst.rate;
  if (ratio >= 1.5) {
    return {
      headline: `${best.name} pays ${multiplier(ratio)} more than ${worst.name}`,
      detail: `${formatMeasuredRate(best.rate, currency, locale)} vs ${formatMeasuredRate(worst.rate, currency, locale)} after costs`,
    };
  }
  return {
    headline: `${best.name} is your top earner`,
    detail: `${formatMeasuredRate(best.rate, currency, locale)} after costs`,
  };
}

/** true / false against the user's own target; null when either is missing. */
export function meetsTarget(rate, target) {
  if (rate == null || target == null) return null;
  return rate >= target;
}
