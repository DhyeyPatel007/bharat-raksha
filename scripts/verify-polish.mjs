// scripts/verify-polish.mjs
const BASE = "http://localhost:3100";

async function main() {
  console.log("Checking /api/upi/cases...");
  const res = await fetch(`${BASE}/api/upi/cases`);
  const data = await res.json();

  for (const c of data.cases) {
    const sum = c.juror_reports.reduce((acc, j) => acc + j.scoreContribution, 0);
    console.log(`Case ${c.case_id}: score=${c.score}, juror_sum=${sum}, verdict=${c.verdict}`);
    if (sum !== c.score) {
      throw new Error(`Mismatch for ${c.case_id}: sum ${sum} !== score ${c.score}`);
    }
  }

  console.log("\nChecking PDF header & filename...");
  const pdfRes = await fetch(`${BASE}/api/upi/cases/UPI-CASE-A/dossier.pdf`);
  const cd = pdfRes.headers.get("content-disposition");
  console.log("Content-Disposition:", cd);
  if (!cd.includes("bharatraksha-dossier-UPI-CASE-A.pdf")) {
    throw new Error(`Unexpected Content-Disposition: ${cd}`);
  }

  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  const pdfStr = pdfBuf.toString("binary");
  if (pdfStr.includes("PHALANX UPI // BHARAT RAKSHA")) {
    throw new Error("Found old Phalanx header in PDF!");
  }
  if (pdfStr.includes("[HI]")) {
    throw new Error("Found broken [HI] placeholder in PDF!");
  }
  console.log("PDF verified: No Phalanx header, No [HI] broken placeholder!");

  console.log("\nALL POLISH CHECKS PASSED!");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
