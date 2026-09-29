// Pins the side hustle calculator's math (NDCSwift/RealRate#228, decided in #223).
// Run from the repo root before pushing:  node --test _tests/
//
// `_tests/` is outside the published site: GitHub Pages builds this repo with Jekyll, which skips
// underscore-prefixed folders.
//
// The rate figures are the app's own. `TRUE_RATE_SCENARIOS` restates
// `RealRateTests/CoreCalculationScenarios.swift` → `trueHourlyRate` row for row, and
// `RANKING_SCENARIOS` its `ranking` table. If a row changes there, change it here.
// The two suites can't share one file because they live in different repos.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  payRate, trueRate, totalExpenses, formatMeasuredRate, formatStatedRate,
  minorUnit, fractionDigits, roundsAway, multiplier, rank, insightLine,
  needsHoursConfirm, hustleState, meetsTarget, parseAmount, HOURS_CONFIRM_THRESHOLD,
} from "../realrate/side-hustle-calculator/calc.js";

// Every formatted figure is asked of a fixed locale, never the machine's (#65's seam).
const US = "en-US";

// MARK: - The app's scenario table

const TRUE_RATE_SCENARIOS = [
  { name: "Normal session",        sessions: [[84, 2]],             expenses: 0,   expected: "$42.00/hr" },
  { name: "Multiple sessions",     sessions: [[84, 2], [71, 1.5]],  expenses: 0,   expected: "$44.29/hr" },
  { name: "With expenses",         sessions: [[1450, 30.5]],        expenses: 186, expected: "$41.44/hr" },
  { name: "No sessions",           sessions: [],                    expenses: 0,   expected: null },
  { name: "Zero hours logged",     sessions: [[84, 0]],             expenses: 0,   expected: null },
  { name: "Expenses exceed income",sessions: [[50, 5]],             expenses: 100, expected: "losing $10.00/hr" },
  { name: "Very small hours",      sessions: [[10, 0.1]],           expenses: 0,   expected: "$100.00/hr" },
  { name: "Single cent income",    sessions: [[0.01, 1]],           expenses: 0,   expected: "$0.01/hr" },
];

for (const s of TRUE_RATE_SCENARIOS) {
  test(`CoreCalculationScenarios: ${s.name}`, () => {
    // The calculator takes one month's totals, so a scenario's sessions are summed first.
    const income = s.sessions.reduce((a, [i]) => a + i, 0);
    const hours = s.sessions.reduce((a, [, h]) => a + h, 0);
    const rate = trueRate({ income, hours, expenses: [s.expenses] });
    if (s.expected === null) {
      assert.equal(rate, null);
    } else {
      assert.equal(formatMeasuredRate(rate, "USD", US), s.expected);
    }
  });
}

// "Losing $10.00/hr" is the loss shown in words (#223). The app's own string is "-$10.00/hr";
// this pins that the sign really is carried by the word, not dropped.
test("a loss is named in words and never loses its direction", () => {
  const rate = trueRate({ income: 50, hours: 5, expenses: [100] });
  assert.equal(rate, -10);
  assert.doesNotMatch(formatMeasuredRate(rate, "USD", US), /-|−/);
  assert.match(formatMeasuredRate(rate, "USD", US), /^losing /);
});

// MARK: - The $5.27 food-delivery example the page prints

test("the page's food-delivery example: $124 in, $85 of gas, 7.4 hours", () => {
  const h = { income: 124, hours: 7.4, expenses: [85] };
  assert.equal(formatMeasuredRate(payRate(h), "USD", US), "$16.76/hr");
  assert.equal(formatMeasuredRate(trueRate(h), "USD", US), "$5.27/hr");
});

// MARK: - Pay Rate vs True Rate

test("the Pay Rate nets nothing and the True Rate nets every line", () => {
  const h = { income: 1000, hours: 40, expenses: [50, 30, 20, 0] };
  assert.equal(payRate(h), 25);
  assert.equal(totalExpenses(h.expenses), 100);
  assert.equal(trueRate(h), 22.5);
});

test("blank expense lines count as nothing, not as NaN", () => {
  assert.equal(totalExpenses([null, undefined, NaN, 12]), 12);
  assert.equal(trueRate({ income: 100, hours: 4, expenses: [null, null] }), 25);
});

// MARK: - 0 hours

test("0 hours has no rate, for either metric", () => {
  assert.equal(payRate({ income: 84, hours: 0 }), null);
  assert.equal(trueRate({ income: 84, hours: 0, expenses: [10] }), null);
  assert.equal(trueRate({ income: 84, hours: null, expenses: [] }), null);
});

test("expenses with no hours ask for hours rather than showing a loss", () => {
  assert.equal(hustleState({ income: null, hours: null, expenses: [40] }), "needsHours");
  assert.equal(hustleState({ income: 200, hours: 0, expenses: [] }), "needsHours");
});

test("hustle state: control at both ends", () => {
  assert.equal(hustleState({ income: null, hours: null, expenses: [] }), "empty");
  assert.equal(hustleState({ income: 0, hours: 3, expenses: [] }), "rated");
  // Hours alone are not a result yet: the money hasn't been entered.
  assert.equal(hustleState({ income: null, hours: 3, expenses: [] }), "needsIncome");
});

// MARK: - A true zero stays a zero

test("exactly zero reads $0.00/hr, not the sub-unit form", () => {
  assert.equal(formatMeasuredRate(0, "USD", US), "$0.00/hr");
  assert.equal(formatMeasuredRate(trueRate({ income: 50, hours: 5, expenses: [50] }), "USD", US), "$0.00/hr");
});

// MARK: - Sub-unit rates (#46), threshold from the currency's minor unit

test("minor units come from the currency, not a literal 0.01", () => {
  assert.equal(fractionDigits("USD", US), 2);
  assert.equal(fractionDigits("JPY", US), 0);
  assert.equal(minorUnit("USD", US), 0.01);
  assert.equal(minorUnit("JPY", US), 1);
});

test("USD: a rate that rounds to nothing is named, both ways", () => {
  assert.equal(formatMeasuredRate(0.004, "USD", US), "under $0.01/hr");
  assert.equal(formatMeasuredRate(-0.004, "USD", US), "losing under $0.01/hr");
});

test("USD: control at the boundary — half a cent rounds up, so it is a figure", () => {
  assert.equal(roundsAway(0.005, "USD", US), false);
  assert.equal(formatMeasuredRate(0.005, "USD", US), "$0.01/hr");
  assert.equal(roundsAway(-0.005, "USD", US), false);
  assert.equal(formatMeasuredRate(-0.005, "USD", US), "losing $0.01/hr");
});

test("JPY: the threshold is one yen, never ¥0.01", () => {
  assert.equal(formatMeasuredRate(0.4, "JPY", US), "under ¥1/hr");
  assert.equal(formatMeasuredRate(-0.4, "JPY", US), "losing under ¥1/hr");
  assert.doesNotMatch(formatMeasuredRate(0.4, "JPY", US), /0\.01/);
  // Control: a sub-cent-sized yen rate that is a whole yen is a figure.
  assert.equal(formatMeasuredRate(1.2, "JPY", US), "¥1/hr");
  assert.equal(formatMeasuredRate(1500, "JPY", US), "¥1,500/hr");
});

test("a stated target never takes the sub-unit form", () => {
  assert.equal(formatStatedRate(0.004, "USD", US), "$0.00/hr");
  assert.equal(formatStatedRate(25, "USD", US), "$25.00/hr");
});

test("the reader's locale places the symbol and the decimal mark", () => {
  assert.equal(formatMeasuredRate(1234.5, "EUR", "de-DE"), "1.234,50 €/hr");
  assert.equal(formatMeasuredRate(1234.5, "EUR", US), "€1,234.50/hr");
});

// MARK: - The soft hours confirm (~300 a month)

test("more than 300 hours asks to confirm; 300 itself does not", () => {
  assert.equal(HOURS_CONFIRM_THRESHOLD, 300);
  assert.equal(needsHoursConfirm(300), false);
  assert.equal(needsHoursConfirm(300.5), true);
  assert.equal(needsHoursConfirm(40), false);
  assert.equal(needsHoursConfirm(null), false);
});

test("money has no cap", () => {
  const rate = trueRate({ income: 1e12, hours: 1, expenses: [] });
  assert.equal(rate, 1e12);
  assert.equal(formatMeasuredRate(rate, "USD", US), "$1,000,000,000,000.00/hr");
});

// MARK: - Input parsing

test("amounts parse; blanks and negatives do not", () => {
  assert.equal(parseAmount("42.5"), 42.5);
  assert.equal(parseAmount("0"), 0);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("  "), null);
  assert.equal(parseAmount("-3"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("Infinity"), null);
});

test("amounts parse the way people type them: symbols, group and decimal marks", () => {
  assert.equal(parseAmount("$1,200"), 1200);
  assert.equal(parseAmount("1,200.50"), 1200.5);
  assert.equal(parseAmount("1.200,50"), 1200.5);
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("1 200,5"), 1200.5);
  assert.equal(parseAmount("€ 80"), 80);
  assert.equal(parseAmount("¥1,500"), 1500);
  // One comma with three digits after is a thousands group, not three decimals.
  assert.equal(parseAmount("1,500"), 1500);
  // Controls: still not a number, still not negative.
  assert.equal(parseAmount("1.2.3"), null);
  assert.equal(parseAmount("-$3"), null);
  assert.equal(parseAmount("$"), null);
});

// MARK: - Ranking (CoreCalculationScenarios → ranking)

const RANKING_SCENARIOS = [
  { name: "Normal ranking",                               rates: [42, 18, 38],   expectedOrder: [0, 2, 1] },
  { name: "Nil rate gigs last",                           rates: [42, null, 38], expectedOrder: [0, 2, 1] },
  { name: "All nil",                                      rates: [null, null],   expectedOrder: [0, 1] },
  { name: "Single gig",                                   rates: [42],           expectedOrder: [0] },
  { name: "Empty",                                        rates: [],             expectedOrder: [] },
  { name: "Loss-making gig still outranks an unrated one", rates: [-20, null],   expectedOrder: [0, 1] },
];

for (const s of RANKING_SCENARIOS) {
  test(`ranking: ${s.name}`, () => {
    const ranked = rank(s.rates.map((rate, index) => ({ index, rate })));
    assert.deepEqual(ranked.map((h) => h.index), s.expectedOrder);
  });
}

test("ranking: equal rates keep entry order (the tie rule the app imposes by createdAt)", () => {
  const ranked = rank([{ index: 0, rate: 30 }, { index: 1, rate: 30 }, { index: 2, rate: 40 }]);
  assert.deepEqual(ranked.map((h) => h.index), [2, 0, 1]);
});

// MARK: - The insight line (InsightEngine's top-vs-bottom rule)

test("multiplier truncates to tenths and caps at 10×+ (Double+Multiplier)", () => {
  assert.equal(multiplier(6.57), "6.5×");
  assert.equal(multiplier(5.02), "5×");
  assert.equal(multiplier(1.5), "1.5×");
  assert.equal(multiplier(9.99), "9.9×");
  assert.equal(multiplier(10), "10×+");
  assert.equal(multiplier(Infinity), "10×+");
});

const named = (name, rate) => ({ name, rate });

test("insight: best vs worst when both are positive and ≥1.5× apart", () => {
  const line = insightLine([named("Logo design", 50.97), named("Math tutoring", 42.99), named("Food delivery", 10.14)], "USD", US);
  assert.deepEqual(line, {
    headline: "Logo design pays 5× more than Food delivery",
    detail: "$50.97/hr vs $10.14/hr after costs",
  });
});

test("insight: under 1.5× apart names the top earner instead", () => {
  const line = insightLine([named("Tutoring", 30), named("Dog walking", 25)], "USD", US);
  assert.deepEqual(line, { headline: "Tutoring is your top earner", detail: "$30.00/hr after costs" });
});

test("insight: nothing when the bottom rate is zero or a loss", () => {
  assert.equal(insightLine([named("A", 30), named("B", -5)], "USD", US), null);
  assert.equal(insightLine([named("A", 30), named("B", 0)], "USD", US), null);
});

test("insight: nothing with fewer than two rated hustles; unrated ones are skipped", () => {
  assert.equal(insightLine([named("A", 30)], "USD", US), null);
  assert.equal(insightLine([named("A", 30), named("B", null)], "USD", US), null);
  // Control: the unrated one is skipped, and the two rated ones still compare.
  assert.deepEqual(
    insightLine([named("A", 30), named("B", null), named("C", 10)], "USD", US).headline,
    "A pays 3× more than C",
  );
});

// MARK: - Verdict against the user's own target

test("verdict: meets at or above the target, not below; no target, no verdict", () => {
  assert.equal(meetsTarget(25, 25), true);
  assert.equal(meetsTarget(25.01, 25), true);
  assert.equal(meetsTarget(24.99, 25), false);
  assert.equal(meetsTarget(-3, 25), false);
  assert.equal(meetsTarget(25, null), null);
  assert.equal(meetsTarget(null, 25), null);
});
