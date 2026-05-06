import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve(
  "outputs",
  "investor-ready-finanzplan-template-20260419",
);
const outputPath = path.join(
  outputDir,
  "perfectday24-investor-ready-finanzplan-template.xlsx",
);

const workbook = Workbook.create();
const dashboard = workbook.worksheets.getOrAdd("Dashboard", {
  renameFirstIfOnlyNewSpreadsheet: true,
});
const assumptions = workbook.worksheets.add("Assumptions");
const revenue = workbook.worksheets.add("Revenue");
const hiring = workbook.worksheets.add("Hiring");
const operatingCosts = workbook.worksheets.add("OperatingCosts");
const cashFlow = workbook.worksheets.add("CashFlow");
const instructions = workbook.worksheets.add("Instructions");

workbook.setColorScheme({
  name: "PerfectDay24 Finance",
  themeColors: {
    accent1: "#123C69",
    accent2: "#2A6F97",
    accent3: "#D98E04",
    accent4: "#1E8E5A",
    accent5: "#C94C4C",
    accent6: "#5B6576",
    dk1: "#0F172A",
    dk2: "#334155",
    lt1: "#FFFFFF",
    lt2: "#E2E8F0",
    hlink: "#2563EB",
    folHlink: "#7C3AED",
  },
});

const monthCols = [
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
];

const currencyFormat = '€#,##0;[Red](€#,##0);-';
const percentFormat = '0.0%;[Red](0.0%);-';
const wholeNumberFormat = '#,##0;[Red](#,##0);-';
const monthFormat = "mmm-yy";

function applySheetBase(sheet) {
  sheet.showGridLines = false;
  sheet.getRange("A:Z").format.font = {
    name: "Calibri",
    size: 11,
    color: "tx1",
  };
  sheet.getRange("A:Z").format.verticalAlignment = "center";
}

function addTitle(sheet, title) {
  const range = sheet.getRange("A1:M1");
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 15 },
    horizontalAlignment: "left",
  };
}

function addSectionHeader(sheet, rangeAddress, title) {
  const range = sheet.getRange(rangeAddress);
  range.merge();
  range.values = [[title]];
  range.format = {
    fill: "accent1",
    font: { color: "lt1", bold: true, size: 11 },
    horizontalAlignment: "left",
  };
}

function styleHeaderRow(range) {
  range.format = {
    fill: "accent2",
    font: { color: "lt1", bold: true },
    horizontalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
  };
}

function styleTotalRow(range) {
  range.format.font = { bold: true };
  range.format.borders = { preset: "outside", style: "thin", color: "#475569" };
  range.getCell(0, 0).format.borders.getItem("EdgeTop").style = "medium";
}

function styleInputCell(range, numberFormat = null) {
  range.format = {
    fill: "#FFF2CC",
    font: { color: "#0000FF", bold: true },
    borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
  };
  if (numberFormat) {
    range.format.numberFormat = numberFormat;
  }
}

function styleLinkedFormula(range, numberFormat = null) {
  range.format.font = { color: "#008000" };
  if (numberFormat) {
    range.format.numberFormat = numberFormat;
  }
}

function colLetter(index) {
  return monthCols[index];
}

function monthFormula(index) {
  return `=EDATE(Assumptions!$B$3,${index})`;
}

const assumptionSpecs = [
  {
    key: "starting_cash",
    label: "Starting cash",
    unit: "EUR",
    base: 60000,
    upside: 90000,
    downside: 40000,
    note: "Opening cash before month 1",
  },
  {
    key: "equity_raise_month",
    label: "Equity raise month",
    unit: "month #",
    base: 4,
    upside: 3,
    downside: 6,
    note: "Month of angel / pre-seed close",
  },
  {
    key: "equity_raise_amount",
    label: "Equity raise amount",
    unit: "EUR",
    base: 250000,
    upside: 350000,
    downside: 150000,
    note: "Gross new equity cash-in",
  },
  {
    key: "grant_1_month",
    label: "Grant 1 month",
    unit: "month #",
    base: 7,
    upside: 6,
    downside: 9,
    note: "First expected grant cash receipt",
  },
  {
    key: "grant_1_amount",
    label: "Grant 1 amount",
    unit: "EUR",
    base: 45000,
    upside: 70000,
    downside: 0,
    note: "Conservative first grant receipt",
  },
  {
    key: "grant_2_month",
    label: "Grant 2 month",
    unit: "month #",
    base: 10,
    upside: 9,
    downside: 0,
    note: "Second expected grant cash receipt",
  },
  {
    key: "grant_2_amount",
    label: "Grant 2 amount",
    unit: "EUR",
    base: 45000,
    upside: 70000,
    downside: 0,
    note: "Conservative second grant receipt",
  },
  {
    key: "starting_paying_partners",
    label: "Starting paying partners",
    unit: "count",
    base: 2,
    upside: 3,
    downside: 1,
    note: "Month 1 opening partner count",
  },
  {
    key: "new_partners_per_month",
    label: "New partners / month",
    unit: "count",
    base: 1,
    upside: 2,
    downside: 0.5,
    note: "Average new paying partners per month",
  },
  {
    key: "monthly_partner_churn",
    label: "Monthly partner churn",
    unit: "%",
    base: 0.05,
    upside: 0.03,
    downside: 0.08,
    note: "Share of beginning partners churning",
  },
  {
    key: "avg_partner_mrr",
    label: "Avg partner MRR",
    unit: "EUR / month",
    base: 800,
    upside: 1000,
    downside: 650,
    note: "Average recurring partner package revenue",
  },
  {
    key: "monthly_sponsored_revenue",
    label: "Sponsored revenue / month",
    unit: "EUR / month",
    base: 500,
    upside: 1200,
    downside: 0,
    note: "Featured placements / sponsored pilots",
  },
  {
    key: "monthly_affiliate_revenue",
    label: "Affiliate revenue / month",
    unit: "EUR / month",
    base: 250,
    upside: 600,
    downside: 100,
    note: "Ticketing / affiliate commissions",
  },
  {
    key: "gross_margin_pct",
    label: "Gross margin",
    unit: "%",
    base: 0.85,
    upside: 0.9,
    downside: 0.8,
    note: "Gross profit margin on revenue",
  },
  {
    key: "founder_count",
    label: "Founder count",
    unit: "count",
    base: 2,
    upside: 2,
    downside: 2,
    note: "Full-time operating founders",
  },
  {
    key: "founder_draw_per_founder",
    label: "Founder draw / founder",
    unit: "EUR / month",
    base: 3000,
    upside: 3200,
    downside: 2500,
    note: "Moderate founder cash compensation",
  },
  {
    key: "product_hires_start_month",
    label: "Product hires start month",
    unit: "month #",
    base: 7,
    upside: 5,
    downside: 9,
    note: "Month when first product / data hire starts",
  },
  {
    key: "product_hires_count",
    label: "Product hires count",
    unit: "count",
    base: 1,
    upside: 2,
    downside: 0,
    note: "Number of product / data hires",
  },
  {
    key: "product_hire_monthly_cost",
    label: "Product hire cost",
    unit: "EUR / month",
    base: 6500,
    upside: 7000,
    downside: 0,
    note: "Loaded monthly personnel cost",
  },
  {
    key: "gtm_hires_start_month",
    label: "GTM hires start month",
    unit: "month #",
    base: 9,
    upside: 7,
    downside: 0,
    note: "Month when first GTM hire starts",
  },
  {
    key: "gtm_hires_count",
    label: "GTM hires count",
    unit: "count",
    base: 1,
    upside: 1,
    downside: 0,
    note: "Number of GTM hires",
  },
  {
    key: "gtm_hire_monthly_cost",
    label: "GTM hire cost",
    unit: "EUR / month",
    base: 5000,
    upside: 5500,
    downside: 0,
    note: "Loaded monthly personnel cost",
  },
  {
    key: "monthly_contractors",
    label: "Contractors / freelancers",
    unit: "EUR / month",
    base: 2500,
    upside: 3500,
    downside: 1500,
    note: "Flexible delivery support",
  },
  {
    key: "monthly_hosting_api",
    label: "Hosting / API cost",
    unit: "EUR / month",
    base: 1500,
    upside: 2200,
    downside: 1200,
    note: "Supabase, APIs, data, infra",
  },
  {
    key: "monthly_marketing",
    label: "Sales & marketing",
    unit: "EUR / month",
    base: 3500,
    upside: 5500,
    downside: 1500,
    note: "Paid tests, content, events",
  },
  {
    key: "monthly_legal_gna",
    label: "Legal / finance / G&A",
    unit: "EUR / month",
    base: 1200,
    upside: 1800,
    downside: 1000,
    note: "Accounting, legal, admin",
  },
  {
    key: "monthly_travel",
    label: "Travel / partner meetings",
    unit: "EUR / month",
    base: 1000,
    upside: 1500,
    downside: 500,
    note: "Local sales and partner travel",
  },
  {
    key: "one_off_tooling_month",
    label: "One-off tooling month",
    unit: "month #",
    base: 2,
    upside: 2,
    downside: 3,
    note: "One-time setup or tooling spend",
  },
  {
    key: "one_off_tooling_amount",
    label: "One-off tooling amount",
    unit: "EUR",
    base: 8000,
    upside: 12000,
    downside: 4000,
    note: "One-time setup or tooling spend",
  },
];

const scenarioDataStartRow = 10;
const rowByKey = Object.fromEntries(
  assumptionSpecs.map((spec, index) => [spec.key, scenarioDataStartRow + index]),
);

function assumptionRef(key) {
  return `Assumptions!$I$${rowByKey[key]}`;
}

function buildMonths(sheet, row) {
  sheet.getRange(`B${row}:M${row}`).formulas = [
    Array.from({ length: 12 }, (_, index) => monthFormula(index)),
  ];
  sheet.getRange(`B${row}:M${row}`).format.numberFormat = monthFormat;
  sheet.getRange(`B${row}:M${row}`).format.horizontalAlignment = "right";
}

function monthCondition(monthIndex, assumptionKey, thenFormula, elseFormula = "0") {
  return `=IF(${monthIndex + 1}>=${assumptionRef(assumptionKey)},${thenFormula},${elseFormula})`;
}

function monthEquality(monthIndex, assumptionKey, valueFormula, elseFormula = "0") {
  return `=IF(${monthIndex + 1}=${assumptionRef(assumptionKey)},${valueFormula},${elseFormula})`;
}

applySheetBase(dashboard);
applySheetBase(assumptions);
applySheetBase(revenue);
applySheetBase(hiring);
applySheetBase(operatingCosts);
applySheetBase(cashFlow);
applySheetBase(instructions);

dashboard.getRange("A:M").format.columnWidthPx = 95;
dashboard.getRange("A:A").format.columnWidthPx = 26;
dashboard.getRange("B:L").format.columnWidthPx = 105;

assumptions.getRange("A:A").format.columnWidthPx = 170;
assumptions.getRange("B:B").format.columnWidthPx = 95;
assumptions.getRange("C:E").format.columnWidthPx = 88;
assumptions.getRange("G:G").format.columnWidthPx = 170;
assumptions.getRange("H:H").format.columnWidthPx = 95;
assumptions.getRange("I:I").format.columnWidthPx = 110;
assumptions.getRange("J:J").format.columnWidthPx = 240;

for (const sheet of [revenue, hiring, operatingCosts, cashFlow]) {
  sheet.getRange("A:A").format.columnWidthPx = 220;
  sheet.getRange("B:M").format.columnWidthPx = 86;
  sheet.freezePanes.freezeRows(4);
  sheet.freezePanes.freezeColumns(1);
}

instructions.getRange("A:A").format.columnWidthPx = 200;
instructions.getRange("B:B").format.columnWidthPx = 520;

addTitle(dashboard, "PerfectDay24 Investor-Ready Finanzplan Template");
addTitle(assumptions, "Assumptions & Scenario Toggle");
addTitle(revenue, "Revenue Build");
addTitle(hiring, "Hiring Plan");
addTitle(operatingCosts, "Operating Costs");
addTitle(cashFlow, "Cash Flow");
addTitle(instructions, "Instructions");

dashboard.getRange("A3:M3").merge();
dashboard.getRange("A3:M3").values = [[
  "Switch the active scenario in Assumptions!B4. Replace all blue/yellow cells with your own inputs before using the workbook in fundraising.",
]];
dashboard.getRange("A3:M3").format = {
  fill: "lt2",
  font: { color: "tx1", italic: true },
  wrapText: true,
};

const kpiLabels = [
  ["Starting cash", "Equity raised", "Exit monthly revenue", "Ending cash"],
  ["12M revenue", "Avg monthly burn", "Exit paying partners", "Minimum cash"],
  ["Additional funding need", "Exit team size", "Grant inflow", "Active scenario"],
];

const kpiValues = [
  [
    `=${assumptionRef("starting_cash")}`,
    `=${assumptionRef("equity_raise_amount")}`,
    "=Revenue!M14",
    "=CashFlow!M14",
  ],
  [
    "=SUM(Revenue!B14:M14)",
    "=AVERAGE(CashFlow!B16:M16)",
    "=Revenue!M9",
    "=MIN(CashFlow!B14:M14)",
  ],
  [
    '=IF(MIN(CashFlow!B14:M14)>=0,0,ABS(MIN(CashFlow!B14:M14)))',
    "=Hiring!M15",
    "=SUM(CashFlow!B9:M10)",
    "=Assumptions!B4",
  ],
];

for (let block = 0; block < 3; block += 1) {
  const startRow = 5 + block * 4;
  const labelRow = kpiLabels[block];
  const valueRow = kpiValues[block];
  for (let card = 0; card < 4; card += 1) {
    const startCol = 1 + card * 3;
    const labelRange = dashboard.getRange(
      `${String.fromCharCode(65 + startCol)}${startRow}:${
        String.fromCharCode(66 + startCol)
      }${startRow}`,
    );
    labelRange.merge();
    labelRange.values = [[labelRow[card]]];
    labelRange.format = {
      fill: "accent2",
      font: { color: "lt1", bold: true },
      horizontalAlignment: "left",
    };

    const valueRange = dashboard.getRange(
      `${String.fromCharCode(65 + startCol)}${startRow + 1}:${
        String.fromCharCode(66 + startCol)
      }${startRow + 2}`,
    );
    valueRange.merge();
    valueRange.formulas = [[valueRow[card]]];
    valueRange.format = {
      fill: "lt2",
      font: { color: "#008000", bold: true, size: 14 },
      horizontalAlignment: "center",
      verticalAlignment: "center",
      borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
    };
  }
}

dashboard.getRange("B6:C7").format.numberFormat = currencyFormat;
dashboard.getRange("E6:F7").format.numberFormat = currencyFormat;
dashboard.getRange("H6:I7").format.numberFormat = currencyFormat;
dashboard.getRange("K6:L7").format.numberFormat = currencyFormat;
dashboard.getRange("B10:C11").format.numberFormat = currencyFormat;
dashboard.getRange("E10:F11").format.numberFormat = currencyFormat;
dashboard.getRange("H10:I11").format.numberFormat = wholeNumberFormat;
dashboard.getRange("K10:L11").format.numberFormat = currencyFormat;
dashboard.getRange("B14:C15").format.numberFormat = currencyFormat;
dashboard.getRange("E14:F15").format.numberFormat = wholeNumberFormat;
dashboard.getRange("H14:I15").format.numberFormat = currencyFormat;
dashboard.getRange("K14:L15").format.numberFormat = "@";

dashboard.getRange("O2:P14").values = [
  ["Month", "Revenue"],
  ...Array.from({ length: 12 }, () => [null, null]),
];
dashboard.getRange("R2:S14").values = [
  ["Month", "Ending cash"],
  ...Array.from({ length: 12 }, () => [null, null]),
];
dashboard.getRange("O3:O14").formulas = [
  monthCols.map((col) => `=TEXT(Revenue!${col}4,"mmm-yy")`),
];
dashboard.getRange("P3:P14").formulas = [
  monthCols.map((col) => `=Revenue!${col}14`),
];
dashboard.getRange("R3:R14").formulas = [
  monthCols.map((col) => `=TEXT(CashFlow!${col}4,"mmm-yy")`),
];
dashboard.getRange("S3:S14").formulas = [
  monthCols.map((col) => `=CashFlow!${col}14`),
];
dashboard.getRange("P3:P14,S3:S14").format.numberFormat = currencyFormat;

const revenueChart = dashboard.charts.add(
  "line",
  dashboard.getRange("O2:P14"),
  "Auto",
);
revenueChart.title.text = "Monthly Revenue";
revenueChart.setPosition(dashboard.getRange("B18:G31"));
revenueChart.width = 470;
revenueChart.height = 260;

const cashChart = dashboard.charts.add(
  "line",
  dashboard.getRange("R2:S14"),
  "Auto",
);
cashChart.title.text = "Ending Cash";
cashChart.setPosition(dashboard.getRange("H18:M31"));
cashChart.width = 470;
cashChart.height = 260;

assumptions.getRange("A3:B4").values = [
  ["Model start date", new Date("2026-05-01")],
  ["Active scenario", "Base"],
];
assumptions.getRange("A3:A4").format.font = { bold: true };
styleInputCell(assumptions.getRange("B3"), monthFormat);
styleInputCell(assumptions.getRange("B4"));
assumptions.getRange("B3").format.numberFormat = monthFormat;

addSectionHeader(assumptions, "A7:E7", "Scenario Library");
addSectionHeader(assumptions, "G7:J7", "Active Assumptions");

assumptions.getRange("A9:E9").values = [[
  "Assumption",
  "Units",
  "Base",
  "Upside",
  "Downside",
]];
assumptions.getRange("G9:J9").values = [[
  "Assumption",
  "Units",
  "Active value",
  "Why it matters",
]];
styleHeaderRow(assumptions.getRange("A9:E9"));
styleHeaderRow(assumptions.getRange("G9:J9"));

assumptions.getRange(`A${scenarioDataStartRow}:E${scenarioDataStartRow + assumptionSpecs.length - 1}`).values =
  assumptionSpecs.map((spec) => [
    spec.label,
    spec.unit,
    spec.base,
    spec.upside,
    spec.downside,
  ]);

assumptions.getRange(`G${scenarioDataStartRow}:J${scenarioDataStartRow + assumptionSpecs.length - 1}`).values =
  assumptionSpecs.map((spec, index) => {
    const row = scenarioDataStartRow + index;
    return [
      `=A${row}`,
      `=B${row}`,
      `=IFERROR(XLOOKUP($B$4,$C$9:$E$9,C${row}:E${row}),"")`,
      spec.note,
    ];
  });

assumptions.getRange(`C${scenarioDataStartRow}:E${scenarioDataStartRow + assumptionSpecs.length - 1}`).format.font =
  { color: "#0000FF" };
assumptions.getRange(`C${scenarioDataStartRow}:E${scenarioDataStartRow + assumptionSpecs.length - 1}`).format.fill =
  "#FFF2CC";
assumptions.getRange(`I${scenarioDataStartRow}:I${scenarioDataStartRow + assumptionSpecs.length - 1}`).format.fill =
  "#F8FAFC";
assumptions.getRange(`J${scenarioDataStartRow}:J${scenarioDataStartRow + assumptionSpecs.length - 1}`).format.wrapText =
  true;

const percentKeys = new Set(["monthly_partner_churn", "gross_margin_pct"]);
const countKeys = new Set([
  "equity_raise_month",
  "grant_1_month",
  "grant_2_month",
  "starting_paying_partners",
  "new_partners_per_month",
  "founder_count",
  "product_hires_start_month",
  "product_hires_count",
  "gtm_hires_start_month",
  "gtm_hires_count",
  "one_off_tooling_month",
]);

for (const spec of assumptionSpecs) {
  const row = rowByKey[spec.key];
  const scenarioRange = assumptions.getRange(`C${row}:E${row}`);
  const activeRange = assumptions.getRange(`I${row}`);
  if (percentKeys.has(spec.key)) {
    scenarioRange.format.numberFormat = percentFormat;
    activeRange.format.numberFormat = percentFormat;
  } else if (countKeys.has(spec.key)) {
    scenarioRange.format.numberFormat = wholeNumberFormat;
    activeRange.format.numberFormat = wholeNumberFormat;
  } else {
    scenarioRange.format.numberFormat = currencyFormat;
    activeRange.format.numberFormat = currencyFormat;
  }
}

assumptions.getRange("A40:B44").values = [
  ["Color legend", "Blue/yellow cells are hardcoded inputs you should change."],
  ["", "Green formulas on the dashboard pull from other worksheets."],
  ["", "Black formulas are model calculations."],
  ["How to use", "Update Assumptions!B3 and Assumptions!B4 first, then replace the example scenario values."],
  ["Investor note", "This template is structured for an early-stage startup raise with grants and pilot revenues."],
];
assumptions.getRange("A40:B44").format.wrapText = true;

buildMonths(revenue, 4);
revenue.getRange("A4:M4").format.font = { bold: true };
revenue.getRange("B4:M4").format.numberFormat = monthFormat;
revenue.getRange("A6:A17").values = [
  ["Beginning paying partners"],
  ["New partners"],
  ["Churned partners"],
  ["Ending paying partners"],
  ["Avg partner MRR"],
  ["Partner package revenue"],
  ["Sponsored revenue"],
  ["Affiliate revenue"],
  ["Total revenue"],
  ["Gross margin"],
  ["Gross profit"],
  [""],
];
revenue.getRange("A6:A16").format.font = { bold: false };
revenue.getRange("A15:A17").format.font = { bold: true };

revenue.getRange("B6:M6").formulas = [
  monthCols.map((_, index) =>
    index === 0
      ? `=${assumptionRef("starting_paying_partners")}`
      : `=${colLetter(index - 1)}9`,
  ),
];
revenue.getRange("B7:M7").formulas = [
  monthCols.map(() => `=${assumptionRef("new_partners_per_month")}`),
];
revenue.getRange("B8:M8").formulas = [
  monthCols.map(
    (_, index) =>
      `=ROUND(${colLetter(index)}6*${assumptionRef("monthly_partner_churn")},0)`,
  ),
];
revenue.getRange("B9:M9").formulas = [
  monthCols.map(
    (_, index) =>
      `=${colLetter(index)}6+${colLetter(index)}7-${colLetter(index)}8`,
  ),
];
revenue.getRange("B10:M10").formulas = [
  monthCols.map(() => `=${assumptionRef("avg_partner_mrr")}`),
];
revenue.getRange("B11:M11").formulas = [
  monthCols.map(
    (_, index) => `=${colLetter(index)}9*${colLetter(index)}10`,
  ),
];
revenue.getRange("B12:M12").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_sponsored_revenue")}`),
];
revenue.getRange("B13:M13").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_affiliate_revenue")}`),
];
revenue.getRange("B14:M14").formulas = [
  monthCols.map(
    (_, index) =>
      `=SUM(${colLetter(index)}11:${colLetter(index)}13)`,
  ),
];
revenue.getRange("B15:M15").formulas = [
  monthCols.map(() => `=${assumptionRef("gross_margin_pct")}`),
];
revenue.getRange("B16:M16").formulas = [
  monthCols.map(
    (_, index) => `=${colLetter(index)}14*${colLetter(index)}15`,
  ),
];

revenue.getRange("B6:M9").format.numberFormat = wholeNumberFormat;
revenue.getRange("B10:M14,B16:M16").format.numberFormat = currencyFormat;
revenue.getRange("B15:M15").format.numberFormat = percentFormat;
styleTotalRow(revenue.getRange("A14:M14"));
styleTotalRow(revenue.getRange("A16:M16"));

buildMonths(hiring, 4);
hiring.getRange("A6:A16").values = [
  ["Founder draws"],
  ["Product hires"],
  ["GTM hires"],
  ["Contractors / freelancers"],
  ["Total people cost"],
  [""],
  ["Founder headcount"],
  ["Product headcount"],
  ["GTM headcount"],
  ["Total team size"],
  [""],
];

hiring.getRange("B6:M6").formulas = [
  monthCols.map(
    () =>
      `=${assumptionRef("founder_count")}*${assumptionRef("founder_draw_per_founder")}`,
  ),
];
hiring.getRange("B7:M7").formulas = [
  monthCols.map((_, index) =>
    monthCondition(
      index,
      "product_hires_start_month",
      `${assumptionRef("product_hires_count")}*${assumptionRef("product_hire_monthly_cost")}`,
    ),
  ),
];
hiring.getRange("B8:M8").formulas = [
  monthCols.map((_, index) =>
    monthCondition(
      index,
      "gtm_hires_start_month",
      `${assumptionRef("gtm_hires_count")}*${assumptionRef("gtm_hire_monthly_cost")}`,
    ),
  ),
];
hiring.getRange("B9:M9").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_contractors")}`),
];
hiring.getRange("B10:M10").formulas = [
  monthCols.map((_, index) => `=SUM(${colLetter(index)}6:${colLetter(index)}9)`),
];
hiring.getRange("B12:M12").formulas = [
  monthCols.map(() => `=${assumptionRef("founder_count")}`),
];
hiring.getRange("B13:M13").formulas = [
  monthCols.map((_, index) =>
    monthCondition(index, "product_hires_start_month", assumptionRef("product_hires_count")),
  ),
];
hiring.getRange("B14:M14").formulas = [
  monthCols.map((_, index) =>
    monthCondition(index, "gtm_hires_start_month", assumptionRef("gtm_hires_count")),
  ),
];
hiring.getRange("B15:M15").formulas = [
  monthCols.map((_, index) => `=SUM(${colLetter(index)}12:${colLetter(index)}14)`),
];

hiring.getRange("B6:M10").format.numberFormat = currencyFormat;
hiring.getRange("B12:M15").format.numberFormat = wholeNumberFormat;
styleTotalRow(hiring.getRange("A10:M10"));
styleTotalRow(hiring.getRange("A15:M15"));

buildMonths(operatingCosts, 4);
operatingCosts.getRange("A6:A15").values = [
  ["People cost"],
  ["Hosting / APIs"],
  ["Sales & marketing"],
  ["Legal / finance / G&A"],
  ["Travel / partner meetings"],
  ["Total operating expense"],
  ["One-off tooling / setup"],
  ["Total cash outflow"],
  [""],
  [""],
];

operatingCosts.getRange("B6:M6").formulas = [
  monthCols.map((col) => `=Hiring!${col}10`),
];
operatingCosts.getRange("B7:M7").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_hosting_api")}`),
];
operatingCosts.getRange("B8:M8").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_marketing")}`),
];
operatingCosts.getRange("B9:M9").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_legal_gna")}`),
];
operatingCosts.getRange("B10:M10").formulas = [
  monthCols.map(() => `=${assumptionRef("monthly_travel")}`),
];
operatingCosts.getRange("B11:M11").formulas = [
  monthCols.map((_, index) => `=SUM(${colLetter(index)}6:${colLetter(index)}10)`),
];
operatingCosts.getRange("B12:M12").formulas = [
  monthCols.map((_, index) =>
    monthEquality(index, "one_off_tooling_month", assumptionRef("one_off_tooling_amount")),
  ),
];
operatingCosts.getRange("B13:M13").formulas = [
  monthCols.map((_, index) => `=${colLetter(index)}11+${colLetter(index)}12`),
];

operatingCosts.getRange("B6:M13").format.numberFormat = currencyFormat;
styleLinkedFormula(operatingCosts.getRange("B6:M6"), currencyFormat);
styleTotalRow(operatingCosts.getRange("A11:M11"));
styleTotalRow(operatingCosts.getRange("A13:M13"));

buildMonths(cashFlow, 4);
cashFlow.getRange("A6:A17").values = [
  ["Opening cash"],
  ["Revenue collections"],
  ["Equity financing"],
  ["Grant 1"],
  ["Grant 2"],
  ["Total inflow"],
  ["Total outflow"],
  ["Net cash flow"],
  ["Ending cash"],
  ["Monthly burn"],
  ["Gross profit"],
  ["Runway indicator"],
];

cashFlow.getRange("B6:M6").formulas = [
  monthCols.map((_, index) =>
    index === 0 ? `=${assumptionRef("starting_cash")}` : `=${colLetter(index - 1)}14`,
  ),
];
cashFlow.getRange("B7:M7").formulas = [
  monthCols.map((col) => `=Revenue!${col}14`),
];
cashFlow.getRange("B8:M8").formulas = [
  monthCols.map((_, index) =>
    monthEquality(index, "equity_raise_month", assumptionRef("equity_raise_amount")),
  ),
];
cashFlow.getRange("B9:M9").formulas = [
  monthCols.map((_, index) =>
    monthEquality(index, "grant_1_month", assumptionRef("grant_1_amount")),
  ),
];
cashFlow.getRange("B10:M10").formulas = [
  monthCols.map((_, index) =>
    monthEquality(index, "grant_2_month", assumptionRef("grant_2_amount")),
  ),
];
cashFlow.getRange("B11:M11").formulas = [
  monthCols.map((_, index) => `=SUM(${colLetter(index)}7:${colLetter(index)}10)`),
];
cashFlow.getRange("B12:M12").formulas = [
  monthCols.map((col) => `=OperatingCosts!${col}13`),
];
cashFlow.getRange("B13:M13").formulas = [
  monthCols.map((_, index) => `=${colLetter(index)}11-${colLetter(index)}12`),
];
cashFlow.getRange("B14:M14").formulas = [
  monthCols.map((_, index) => `=${colLetter(index)}6+${colLetter(index)}13`),
];
cashFlow.getRange("B15:M15").formulas = [
  monthCols.map((_, index) => `=MAX(0,-${colLetter(index)}13)`),
];
cashFlow.getRange("B16:M16").formulas = [
  monthCols.map((col) => `=Revenue!${col}16`),
];
cashFlow.getRange("B17:M17").formulas = [
  monthCols.map(
    (_, index) =>
      `=IF(AVERAGE($B$15:$M$15)=0,"n.a.",${colLetter(index)}14/AVERAGE($B$15:$M$15))`,
  ),
];

cashFlow.getRange("B6:M16").format.numberFormat = currencyFormat;
cashFlow.getRange("B17:M17").format.numberFormat = '0.0x;[Red](0.0x);-';
styleLinkedFormula(cashFlow.getRange("B7:M7"), currencyFormat);
styleLinkedFormula(cashFlow.getRange("B12:M12"), currencyFormat);
styleLinkedFormula(cashFlow.getRange("B16:M16"), currencyFormat);
styleTotalRow(cashFlow.getRange("A11:M11"));
styleTotalRow(cashFlow.getRange("A12:M12"));
styleTotalRow(cashFlow.getRange("A14:M14"));

instructions.getRange("A3:B14").values = [
  ["What this file does", "This workbook gives you a monthly 12-month model for fundraising conversations, grant planning and internal cash steering."],
  ["Step 1", "Open the Assumptions sheet and set your model start date in B3."],
  ["Step 2", "Switch the active scenario in B4 between Base, Upside and Downside."],
  ["Step 3", "Replace all scenario library example inputs with your own assumptions."],
  ["Step 4", "Update the funding rows first: opening cash, equity timing, grant timing and amounts."],
  ["Step 5", "Update revenue assumptions for partners, sponsored products and affiliate revenue."],
  ["Step 6", "Update hiring and operating assumptions to match your current plan."],
  ["What investors care about", "A clear path from starting cash to exit revenue, the timing of the next raise, evidence of capital efficiency and a downside-aware burn plan."],
  ["Color convention", "Blue/yellow = hardcoded input. Green = link from another worksheet. Black = model calculation."],
  ["Good hygiene", "Do not hardcode values into Revenue, Hiring, OperatingCosts or CashFlow unless you intentionally break the template."],
  ["Recommended outputs", "Use the Dashboard plus a short narrative on fundraising need, milestones and downside actions."],
  ["PerfectDay24 hint", "For this business, track partner count, partner MRR, monthly burn, ending cash and active city ramp in every investor update."],
];
instructions.getRange("A3:A14").format.font = { bold: true };
instructions.getRange("A3:B14").format.wrapText = true;

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A1:M31",
  include: "values,formulas",
  tableMaxRows: 31,
  tableMaxCols: 13,
});

const cashInspect = await workbook.inspect({
  kind: "table",
  range: "CashFlow!A4:M17",
  include: "values,formulas",
  tableMaxRows: 20,
  tableMaxCols: 13,
});

const errorInspect = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});

await fs.mkdir(outputDir, { recursive: true });

async function saveBlob(blob, filePath) {
  await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

const dashboardPreview = await workbook.render({
  sheetName: "Dashboard",
  range: "A1:M31",
  format: "png",
  scale: 2,
});
await saveBlob(dashboardPreview, path.join(outputDir, "dashboard-preview.png"));

const assumptionsPreview = await workbook.render({
  sheetName: "Assumptions",
  range: "A1:J44",
  format: "png",
  scale: 2,
});
await saveBlob(assumptionsPreview, path.join(outputDir, "assumptions-preview.png"));

const revenuePreview = await workbook.render({
  sheetName: "Revenue",
  range: "A1:M17",
  format: "png",
  scale: 2,
});
await saveBlob(revenuePreview, path.join(outputDir, "revenue-preview.png"));

const hiringPreview = await workbook.render({
  sheetName: "Hiring",
  range: "A1:M15",
  format: "png",
  scale: 2,
});
await saveBlob(hiringPreview, path.join(outputDir, "hiring-preview.png"));

const operatingPreview = await workbook.render({
  sheetName: "OperatingCosts",
  range: "A1:M13",
  format: "png",
  scale: 2,
});
await saveBlob(operatingPreview, path.join(outputDir, "operatingcosts-preview.png"));

const cashPreview = await workbook.render({
  sheetName: "CashFlow",
  range: "A1:M17",
  format: "png",
  scale: 2,
});
await saveBlob(cashPreview, path.join(outputDir, "cashflow-preview.png"));

const instructionsPreview = await workbook.render({
  sheetName: "Instructions",
  range: "A1:B14",
  format: "png",
  scale: 2,
});
await saveBlob(instructionsPreview, path.join(outputDir, "instructions-preview.png"));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

await fs.writeFile(
  path.join(outputDir, "verification-log.txt"),
  [
    "Dashboard inspect:",
    summaryInspect.ndjson,
    "",
    "CashFlow inspect:",
    cashInspect.ndjson,
    "",
    "Error scan:",
    errorInspect.ndjson,
  ].join("\n"),
  "utf8",
);

console.log(outputPath);
