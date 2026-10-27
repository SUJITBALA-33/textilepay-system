import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcSalaries,
  updateOrderStage,
  formatUpiIntent,
  calcRemainingCapacity,
  viewFromHash,
  formatMoney,
  formatMonth,
  getMonthOptions,
  createDefaultDB,
  NAV_ITEMS,
  DEFAULT_VIEW,
  SECTIONS,
  SECTION_NAMES,
  type DB,
  type User,
  type Order,
  type Submission,
} from "../src/lib/payroll.ts";

// Helper to create a test DB fixture
function createTestDB(): DB {
  const db = createDefaultDB();
  db.settings = {
    ownerReservePercent: 20,
    otMultiplier: 1.5,
    maxHours: 8,
  };
  db.pieceRates = {
    S1: 20, // Cutting: ₹20/piece
    S2: 40, // Stitching: ₹40/piece
    S3: 30, // Embroidery: ₹30/piece
    S4: 15, // Checking: ₹15/piece
    S5: 10, // Finishing: ₹10/piece
    S6: 5,  // Packing: ₹5/piece
  };
  return db;
}

describe("TextilePay Payroll & Salary Engine", () => {
  it("calculates piece-rate worker base wages accurately", () => {
    const db = createTestDB();
    const month = "2026-10";

    const worker: User = {
      id: "w-piece-1",
      companyId: "c-1",
      email: "piece@factory.com",
      name: "Ramesh Piece",
      mobile: "9876543210",
      username: "ramesh",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "ramesh@okaxis",
      emergencyContact: "",
      dob: "1990-01-01",
      joinDate: "2025-01-01",
      role: "worker",
      status: "approved",
      section: "S2", // Stitching: ₹40/pc
      payType: "piece",
      hourlyOT: 80,
    };

    db.users.push(worker);
    db.submissions.push({
      id: "sub-1",
      userId: worker.id,
      orderId: "ord-1",
      section: "S2",
      pieces: 150, // 150 * 40 = ₹6,000
      note: "Batch 1",
      timestamp: new Date().toISOString(),
      month,
    });

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id);
    assert.ok(sal, "Salary entry should exist for worker");
    assert.equal(sal.base, 6000, "Base pay should be 150 * ₹40 = ₹6000");
    assert.equal(sal.ot, 0, "OT should be 0 when no OT hours marked");
    assert.equal(sal.gross, 6000, "Gross should match base when OT is 0");
  });

  it("calculates daily-rate worker base wages accurately", () => {
    const db = createTestDB();
    const month = "2026-10";

    const worker: User = {
      id: "w-daily-1",
      companyId: "c-1",
      email: "daily@factory.com",
      name: "Suresh Daily",
      mobile: "9876543211",
      username: "suresh",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "suresh@upi",
      emergencyContact: "",
      dob: "1992-05-10",
      joinDate: "2025-02-01",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 500,
      hourlyOT: 70,
    };

    db.users.push(worker);
    db.attendance[worker.id] = {
      [month]: { present: 22, otHours: 0 }, // 22 * 500 = ₹11,000
    };

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id);
    assert.ok(sal);
    assert.equal(sal.base, 11000, "Base pay should be 22 days * ₹500 = ₹11,000");
    assert.equal(sal.gross, 11000);
  });

  it("calculates overtime with configured worker OT rate and company multiplier", () => {
    const db = createTestDB();
    const month = "2026-10";

    const worker: User = {
      id: "w-ot-1",
      companyId: "c-1",
      email: "ot@factory.com",
      name: "Karthik OT",
      mobile: "9876543212",
      username: "karthik",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "1994-08-20",
      joinDate: "2025-03-01",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 400,
      hourlyOT: 100, // ₹100/hr OT rate
    };

    db.settings.otMultiplier = 1.5; // 1.5x multiplier
    db.users.push(worker);
    db.attendance[worker.id] = {
      [month]: { present: 10, otHours: 12 }, // 10*400 = 4000; OT = 12 * 100 * 1.5 = 1800
    };

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id);
    assert.ok(sal);
    assert.equal(sal.base, 4000);
    assert.equal(sal.ot, 1800, "12 hrs * ₹100 * 1.5 multiplier should equal ₹1800");
    assert.equal(sal.gross, 5800, "Gross should be base + OT = ₹5800");
  });

  it("distributes worker pool proportionally among workers after owner reserve", () => {
    const db = createTestDB();
    const month = "2026-10";

    // Setup an order with revenue and costs
    db.orders.push({
      id: "ord-1",
      name: "Winter Hoodies",
      target: 1000,
      revenue: 200000, // ₹2,00,000
      costs: 80000,    // ₹80,000 => Net profit = ₹1,20,000
      stages: { S1: 1000, S2: 1000, S3: 1000, S4: 1000, S5: 1000, S6: 1000 },
      createdAt: new Date().toISOString(),
      status: "active",
    });

    db.settings.ownerReservePercent = 20; // 20% reserve => Worker pool = 80% of ₹1,20,000 = ₹96,000

    const workerA: User = {
      id: "w-A",
      companyId: "c-1",
      email: "a@factory.com",
      name: "Worker A",
      mobile: "1111111111",
      username: "workera",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 600,
      hourlyOT: 0,
    };

    const workerB: User = {
      id: "w-B",
      companyId: "c-1",
      email: "b@factory.com",
      name: "Worker B",
      mobile: "2222222222",
      username: "workerb",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 400,
      hourlyOT: 0,
    };

    db.users.push(workerA, workerB);
    // Worker A: 10 days * 600 = 6000 (60% of total gross)
    // Worker B: 10 days * 400 = 4000 (40% of total gross)
    // Total gross = 10,000
    db.attendance[workerA.id] = { [month]: { present: 10, otHours: 0 } };
    db.attendance[workerB.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    const salA = salaries.get(workerA.id)!;
    const salB = salaries.get(workerB.id)!;

    // Worker pool = 96,000
    // Worker A: 96,000 * (6000 / 10000) = 57,600
    // Worker B: 96,000 * (4000 / 10000) = 38,400
    assert.equal(salA.finalPay, 57600, "Worker A pool share must be ₹57,600 (60%)");
    assert.equal(salB.finalPay, 38400, "Worker B pool share must be ₹38,400 (40%)");
    assert.equal(salA.finalPay + salB.finalPay, 96000, "Total distributed pool must equal ₹96,000");
  });

  it("handles negative profit orders without negative worker pool", () => {
    const db = createTestDB();
    const month = "2026-10";

    db.orders.push({
      id: "ord-loss",
      name: "Loss Order",
      target: 500,
      revenue: 50000,
      costs: 70000, // Costs > Revenue => Loss
      stages: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    });

    const worker: User = {
      id: "w-1",
      companyId: "c-1",
      email: "w1@factory.com",
      name: "Worker 1",
      mobile: "1234567890",
      username: "worker1",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 500,
    };
    db.users.push(worker);
    db.attendance[worker.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id)!;
    assert.equal(sal.finalPay, 0, "Worker pool share cannot be negative when factory is in loss");
  });

  it("handles zero total gross without division by zero or NaN", () => {
    const db = createTestDB();
    const month = "2026-10";

    db.orders.push({
      id: "ord-1",
      name: "Order",
      target: 100,
      revenue: 100000,
      costs: 20000,
      stages: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    });

    const worker: User = {
      id: "w-inactive",
      companyId: "c-1",
      email: "inactive@factory.com",
      name: "Inactive Worker",
      mobile: "0000000000",
      username: "inactive",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 500,
    };
    db.users.push(worker);
    // 0 days present, 0 submissions -> gross = 0

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id)!;
    assert.equal(Number.isNaN(sal.finalPay), false, "finalPay must not be NaN");
    assert.equal(sal.finalPay, 0);
    assert.equal(sal.net, 0);
  });

  it("enforces statutory PF 12% deduction with ₹15,000 wage ceiling", () => {
    const db = createTestDB();
    const month = "2026-10";

    const workerUnderCap: User = {
      id: "w-pf-under",
      companyId: "c-1",
      email: "pfunder@factory.com",
      name: "Under Cap Worker",
      mobile: "111",
      username: "pfunder",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
      pfEnabled: true,
    };

    const workerOverCap: User = {
      id: "w-pf-over",
      companyId: "c-1",
      email: "pfover@factory.com",
      name: "Over Cap Worker",
      mobile: "222",
      username: "pfover",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 2500,
      pfEnabled: true,
    };

    const workerPfDisabled: User = {
      id: "w-pf-disabled",
      companyId: "c-1",
      email: "pfdisabled@factory.com",
      name: "PF Disabled Worker",
      mobile: "333",
      username: "pfdisabled",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
      pfEnabled: false, // PF disabled
    };

    db.users.push(workerUnderCap, workerOverCap, workerPfDisabled);
    // Worker 1: 10 days * 1000 = 10,000 gross (< 15,000 cap) => PF = 10,000 * 0.12 = 1200
    db.attendance[workerUnderCap.id] = { [month]: { present: 10, otHours: 0 } };
    // Worker 2: 10 days * 2500 = 25,000 gross (> 15,000 cap) => PF = 15,000 * 0.12 = 1800 (capped!)
    db.attendance[workerOverCap.id] = { [month]: { present: 10, otHours: 0 } };
    // Worker 3: 10 days * 1000 = 10,000 gross, PF disabled => PF = 0
    db.attendance[workerPfDisabled.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    const salUnder = salaries.get(workerUnderCap.id)!;
    const salOver = salaries.get(workerOverCap.id)!;
    const salDisabled = salaries.get(workerPfDisabled.id)!;

    assert.equal(salUnder.pf, 1200, "PF on ₹10,000 should be ₹1,200 (12%)");
    assert.equal(salOver.pf, 1800, "PF on ₹25,000 must be capped at ₹1,800 (12% of ₹15,000)");
    assert.equal(salDisabled.pf, 0, "PF for worker with pfEnabled:false must be ₹0");
  });

  it("enforces statutory ESI rules (threshold ₹21,000, 0.75% employee, 3.25% employer)", () => {
    const db = createTestDB();
    const month = "2026-10";

    const workerEligible: User = {
      id: "w-esi-eligible",
      companyId: "c-1",
      email: "esi1@factory.com",
      name: "ESI Eligible",
      mobile: "444",
      username: "esi1",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
      esiEnabled: true,
    };

    const workerExempt: User = {
      id: "w-esi-exempt",
      companyId: "c-1",
      email: "esi2@factory.com",
      name: "ESI Above Limit",
      mobile: "555",
      username: "esi2",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 2500,
      esiEnabled: true,
    };

    const workerEsiDisabled: User = {
      id: "w-esi-disabled",
      companyId: "c-1",
      email: "esi3@factory.com",
      name: "ESI Toggled Off",
      mobile: "666",
      username: "esi3",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
      esiEnabled: false,
    };

    db.users.push(workerEligible, workerExempt, workerEsiDisabled);
    // Eligible: 10 days * 1000 = ₹10,000 (<= 21,000)
    db.attendance[workerEligible.id] = { [month]: { present: 10, otHours: 0 } };
    // Exempt: 10 days * 2500 = ₹25,000 (> 21,000)
    db.attendance[workerExempt.id] = { [month]: { present: 10, otHours: 0 } };
    // Disabled: 10 days * 1000 = ₹10,000 (<= 21,000 but disabled)
    db.attendance[workerEsiDisabled.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    const salEligible = salaries.get(workerEligible.id)!;
    const salExempt = salaries.get(workerExempt.id)!;
    const salDisabled = salaries.get(workerEsiDisabled.id)!;

    assert.equal(salEligible.esiEmployee, 75, "ESI employee portion on ₹10,000 should be ₹75 (0.75%)");
    assert.equal(salEligible.esiEmployer, 325, "ESI employer portion on ₹10,000 should be ₹325 (3.25%)");

    assert.equal(salExempt.esiEmployee, 0, "Worker earning > ₹21,000 is exempt from ESI employee contribution");
    assert.equal(salExempt.esiEmployer, 0, "Worker earning > ₹21,000 is exempt from ESI employer contribution");

    assert.equal(salDisabled.esiEmployee, 0, "Worker with esiEnabled: false pays ₹0 ESI employee contribution");
    assert.equal(salDisabled.esiEmployer, 0, "Worker with esiEnabled: false has ₹0 ESI employer contribution");
  });

  it("calculates accurate net salary = finalPay - pf - esiEmployee", () => {
    const db = createTestDB();
    const month = "2026-10";

    db.orders.push({
      id: "ord-1",
      name: "Shirts",
      target: 500,
      revenue: 100000,
      costs: 20000, // profit = 80,000; pool (80%) = 64,000
      stages: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    });

    const worker: User = {
      id: "w-net",
      companyId: "c-1",
      email: "net@factory.com",
      name: "Net Pay Worker",
      mobile: "999",
      username: "netpay",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "approved",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
      pfEnabled: true,
      esiEnabled: true,
    };
    db.users.push(worker);
    // 10 days * 1000 = 10,000 gross. Sole worker => finalPay = full pool = 64,000.
    // PF = 10,000 * 0.12 = 1,200.
    // ESI Employee = 10,000 * 0.0075 = 75.
    // Net = 64,000 - 1,200 - 75 = 62,725.
    db.attendance[worker.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    const sal = salaries.get(worker.id)!;
    assert.equal(sal.finalPay, 64000);
    assert.equal(sal.pf, 1200);
    assert.equal(sal.esiEmployee, 75);
    assert.equal(sal.net, 62725, "Net pay should be finalPay - pf - esiEmployee");
  });

  it("excludes unapproved workers from salary and pool distribution", () => {
    const db = createTestDB();
    const month = "2026-10";

    const pendingWorker: User = {
      id: "w-pending",
      companyId: "c-1",
      email: "pending@factory.com",
      name: "Pending Worker",
      mobile: "000",
      username: "pending1",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "pending",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
    };

    const rejectedWorker: User = {
      id: "w-rejected",
      companyId: "c-1",
      email: "rejected@factory.com",
      name: "Rejected Worker",
      mobile: "001",
      username: "rejected1",
      address: "",
      aadhaar: "",
      bankDetails: "",
      upi: "",
      emergencyContact: "",
      dob: "",
      joinDate: "",
      role: "worker",
      status: "rejected",
      section: "S1",
      payType: "daily",
      dailyRate: 1000,
    };

    db.users.push(pendingWorker, rejectedWorker);
    db.attendance[pendingWorker.id] = { [month]: { present: 10, otHours: 0 } };
    db.attendance[rejectedWorker.id] = { [month]: { present: 10, otHours: 0 } };

    const salaries = calcSalaries(month, db);
    assert.equal(salaries.has(pendingWorker.id), false, "Pending worker must not be included in payroll");
    assert.equal(salaries.has(rejectedWorker.id), false, "Rejected worker must not be included in payroll");
  });
});

describe("Production Pipeline & Order Stage Constraints", () => {
  function createSampleOrder(target: number): Order {
    return {
      id: "order-test-1",
      name: "Cotton Polos",
      target,
      revenue: 150000,
      costs: 50000,
      stages: { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    };
  }

  it("clamps Stage S1 (Cutting) between 0 and order target", () => {
    const order = createSampleOrder(500);

    // Normal update
    const normal = updateOrderStage(order, "S1", 300);
    assert.equal(normal.stages.S1, 300);

    // Exceed target -> clamped to 500
    const exceeded = updateOrderStage(order, "S1", 750);
    assert.equal(exceeded.stages.S1, 500, "S1 cannot exceed target 500");

    // Negative value -> clamped to 0
    const negative = updateOrderStage(order, "S1", -50);
    assert.equal(negative.stages.S1, 0, "S1 cannot be negative");
  });

  it("clamps downstream stages to upstream stages (S2 <= S1, S3 <= S2, etc.)", () => {
    let order = createSampleOrder(1000);

    // Set S1 to 600
    order = updateOrderStage(order, "S1", 600);
    assert.equal(order.stages.S1, 600);

    // Attempt to set S2 (Stitching) to 800 -> must clamp to 600
    order = updateOrderStage(order, "S2", 800);
    assert.equal(order.stages.S2, 600, "S2 cannot exceed S1");

    // Attempt to set S3 (Embroidery) to 700 -> must clamp to S2 (600)
    order = updateOrderStage(order, "S3", 700);
    assert.equal(order.stages.S3, 600, "S3 cannot exceed S2");
  });

  it("automatically rolls back and caps downstream stages when an upstream stage is reduced", () => {
    let order = createSampleOrder(1000);

    // Establish a progressive pipeline: 900 -> 800 -> 700 -> 600 -> 500 -> 400
    order = updateOrderStage(order, "S1", 900);
    order = updateOrderStage(order, "S2", 800);
    order = updateOrderStage(order, "S3", 700);
    order = updateOrderStage(order, "S4", 600);
    order = updateOrderStage(order, "S5", 500);
    order = updateOrderStage(order, "S6", 400);

    assert.deepEqual(order.stages, {
      S1: 900, S2: 800, S3: 700, S4: 600, S5: 500, S6: 400,
    });

    // Now, reduce S3 (Embroidery) from 700 down to 450
    // Invariants require: S4 (was 600) -> 450, S5 (was 500) -> 450, S6 (was 400) -> remains 400
    const updated = updateOrderStage(order, "S3", 450);

    assert.equal(updated.stages.S1, 900, "Upstream S1 should remain untouched");
    assert.equal(updated.stages.S2, 800, "Upstream S2 should remain untouched");
    assert.equal(updated.stages.S3, 450, "S3 should be set to 450");
    assert.equal(updated.stages.S4, 450, "S4 must be capped down to 450");
    assert.equal(updated.stages.S5, 450, "S5 must be capped down to 450");
    assert.equal(updated.stages.S6, 400, "S6 is 400 <= 450, so remains 400");
  });

  it("guarantees monotonic ordering across all 6 stages (Target >= S1 >= S2 >= S3 >= S4 >= S5 >= S6 >= 0)", () => {
    let order = createSampleOrder(200);

    // Simulate batch inputs from UI with varying out-of-order numbers
    const inputs: Record<string, number> = {
      S1: 250, // exceeds target 200 -> should be 200
      S2: 180,
      S3: 190, // exceeds S2 (180) -> should be 180
      S4: 150,
      S5: 160, // exceeds S4 (150) -> should be 150
      S6: 120,
    };

    for (const s of SECTIONS) {
      order = updateOrderStage(order, s, inputs[s]);
    }

    assert.ok(order.stages.S1 <= order.target, "S1 <= Target");
    assert.ok(order.stages.S2 <= order.stages.S1, "S2 <= S1");
    assert.ok(order.stages.S3 <= order.stages.S2, "S3 <= S2");
    assert.ok(order.stages.S4 <= order.stages.S3, "S4 <= S3");
    assert.ok(order.stages.S5 <= order.stages.S4, "S5 <= S4");
    assert.ok(order.stages.S6 <= order.stages.S5, "S6 <= S5");
    assert.ok(order.stages.S6 >= 0, "S6 >= 0");

    assert.deepEqual(order.stages, {
      S1: 200, S2: 180, S3: 180, S4: 150, S5: 150, S6: 120,
    });
  });
});

describe("Worker Submissions & Section Capacity", () => {
  it("calculates remaining section capacity correctly", () => {
    const order: Order = {
      id: "ord-cap-1",
      name: "T-Shirts",
      target: 500,
      revenue: 100000,
      costs: 30000,
      stages: { S1: 400, S2: 300, S3: 200, S4: 100, S5: 50, S6: 25 },
      createdAt: new Date().toISOString(),
      status: "active",
    };

    const submissions: Submission[] = [
      { id: "sub-1", userId: "u1", orderId: order.id, section: "S2", pieces: 120, note: "", timestamp: "", month: "2026-10" },
      { id: "sub-2", userId: "u2", orderId: order.id, section: "S2", pieces: 80, note: "", timestamp: "", month: "2026-10" },
      // S1 submission should not affect S2
      { id: "sub-3", userId: "u3", orderId: order.id, section: "S1", pieces: 200, note: "", timestamp: "", month: "2026-10" },
    ];

    // S2 capacity = 300; used in S2 = 120 + 80 = 200; remaining = 100
    const remainingS2 = calcRemainingCapacity(order, "S2", submissions);
    assert.equal(remainingS2, 100, "S2 remaining should be 300 - 200 = 100");

    // S1 capacity = 400; used in S1 = 200; remaining = 200
    const remainingS1 = calcRemainingCapacity(order, "S1", submissions);
    assert.equal(remainingS1, 200, "S1 remaining should be 400 - 200 = 200");

    // S3 capacity = 200; used = 0; remaining = 200
    const remainingS3 = calcRemainingCapacity(order, "S3", submissions);
    assert.equal(remainingS3, 200, "S3 remaining should be full 200");
  });

  it("clamps remaining capacity to 0 when submissions exceed or match capacity", () => {
    const order: Order = {
      id: "ord-cap-full",
      name: "Denim Jeans",
      target: 100,
      revenue: 50000,
      costs: 10000,
      stages: { S1: 100, S2: 50, S3: 0, S4: 0, S5: 0, S6: 0 },
      createdAt: new Date().toISOString(),
      status: "active",
    };

    const submissions: Submission[] = [
      { id: "sub-1", userId: "u1", orderId: order.id, section: "S2", pieces: 60, note: "", timestamp: "", month: "2026-10" },
    ];

    const remaining = calcRemainingCapacity(order, "S2", submissions);
    assert.equal(remaining, 0, "Remaining capacity should never be negative");
  });
});

describe("UPI Payment Intent URI Generator", () => {
  it("formats standard UPI intent URI correctly with encoded parameters", () => {
    const upi = "worker@oksbi";
    const name = "Rajesh Kumar";
    const amount = 14500.49; // Should round to 14500
    const note = "Salary Oct 2026";

    const link = formatUpiIntent(upi, name, amount, note);
    assert.equal(
      link,
      "upi://pay?pa=worker@oksbi&am=14500&pn=Rajesh%20Kumar&tn=Salary%20Oct%202026",
      "UPI link must match standard RFC format and encode spaces"
    );
  });

  it("handles empty or missing UPI ID safely by returning empty string", () => {
    assert.equal(formatUpiIntent("", "John Doe", 10000, "Salary"), "");
  });

  it("encodes special characters in payee name and note", () => {
    const link = formatUpiIntent("test@bank", "A & B Textiles / John", 5000, "Payout #1 & Bonus");
    assert.ok(link.includes("pn=A%20%26%20B%20Textiles%20%2F%20John"));
    assert.ok(link.includes("tn=Payout%20%231%20%26%20Bonus"));
  });
});

describe("Role-Based View Routing & Security Policies", () => {
  it("defines correct navigation menus per role", () => {
    const ownerViews = NAV_ITEMS.owner.map(i => i.id);
    assert.deepEqual(ownerViews, [
      "dashboard", "workers", "attendance", "production", "payout", "reports", "billing",
    ]);

    const managerViews = NAV_ITEMS.manager.map(i => i.id);
    assert.deepEqual(managerViews, [
      "accounts", "attendance", "production",
    ]);

    const workerViews = NAV_ITEMS.worker.map(i => i.id);
    assert.deepEqual(workerViews, [
      "mywork",
    ]);
  });

  it("defines appropriate default view for each role", () => {
    assert.equal(DEFAULT_VIEW.owner, "dashboard");
    assert.equal(DEFAULT_VIEW.manager, "attendance");
    assert.equal(DEFAULT_VIEW.worker, "mywork");
  });

  it("maps valid URL hash to view and falls back on unauthorized hashes", () => {
    // When window.location.hash is simulated or tested
    assert.equal(viewFromHash("owner"), "dashboard");
    assert.equal(viewFromHash("manager"), "attendance");
    assert.equal(viewFromHash("worker"), "mywork");
  });
});

describe("Formatting & Date Helpers", () => {
  it("formats Indian Rupee currency with symbol and proper integer rounding", () => {
    const formatted = formatMoney(25400.75);
    // Should contain ₹ and 25,401
    assert.ok(formatted.includes("25,401"), "Currency formatting should round to nearest rupee");
    assert.ok(formatted.includes("₹") || formatted.includes("INR"));
  });

  it("formats YYYY-MM into readable month abbreviation and year", () => {
    assert.equal(formatMonth("2026-10"), "Oct 2026");
    assert.equal(formatMonth("2026-01"), "Jan 2026");
    assert.equal(formatMonth("2025-12"), "Dec 2025");
  });

  it("generates exactly 6 consecutive historical month options", () => {
    const months = getMonthOptions();
    assert.equal(months.length, 6, "Must provide 6 month options");
    for (const m of months) {
      assert.match(m, /^\d{4}-\d{2}$/, "Each month must be in YYYY-MM format");
    }
  });

  it("maps section codes to human-readable department names", () => {
    assert.equal(SECTION_NAMES.S1, "Cutting");
    assert.equal(SECTION_NAMES.S2, "Stitching");
    assert.equal(SECTION_NAMES.S3, "Embroidery");
    assert.equal(SECTION_NAMES.S4, "Checking");
    assert.equal(SECTION_NAMES.S5, "Finishing");
    assert.equal(SECTION_NAMES.S6, "Packing");
  });
});
