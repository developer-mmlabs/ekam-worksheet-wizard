import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

test("multi chapter selection, generation, preview, finalize, and mode isolation", { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const ids = [1, 2, 3].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    const chapters = ids.map((id, i) => ({ id, number: i + 1, name: ["Plants Around Us", "Animals and Habitats", "Water and Weather"][i], subject_id: "science" }));
    let submitted;
    let finalized = false;
    await page.route("**/rest/v1/**", async (route) => {
      const table = new URL(route.request().url()).pathname.split("/").at(-1);
      const body = table === "grades" ? [{ id: "grade-4", number: 4, name: "Grade 4", band: "primary" }, { id: "grade-7", number: 7, name: "Grade 7", band: "middle" }]
        : table === "subjects" ? [{ id: "science", slug: "science", name: "Science", grade_id: "grade-4" }]
        : chapters;
      await route.fulfill({ json: body });
    });
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/school-settings") return route.fulfill({ json: { id: "school" } });
      if (url.pathname.endsWith("chapter-status")) return route.fulfill({ json: { worksheets: submitted && url.searchParams.has("chapterIds") ? [{ id: "worksheet", setNumber: 1, isFinalized: finalized, status: "completed", pdfUrl: "about:blank" }] : [], nextSetNumber: finalized && url.searchParams.has("chapterIds") ? 2 : 1 } });
      if (url.pathname === "/api/generate") { submitted = route.request().postDataJSON(); return route.fulfill({ json: { success: true, worksheetId: "worksheet", setNumber: 1 } }); }
      if (url.pathname.endsWith("/status")) return route.fulfill({ json: { status: "completed", pdfUrl: "about:blank", setNumber: 1, isFinalized: false } });
      if (url.pathname.endsWith("/finalize")) { finalized = true; return route.fulfill({ json: { success: true, nextSetNumber: 2 } }); }
      throw new Error(`Unexpected API request ${url.pathname}`);
    });
    await page.goto(process.env.UI_TEST_URL ?? "http://localhost:3001");
    await page.getByRole("button", { name: "Multi Chapter", exact: true }).click();
    await page.getByLabel("Grade", { exact: true }).selectOption("grade-4");
    await page.getByLabel("Subject", { exact: true }).selectOption("science");
    await page.getByRole("checkbox", { name: "Ch 1: Plants Around Us" }).check();
    assert.equal(await page.getByRole("button", { name: "Generate Worksheet", exact: true }).isDisabled(), true);
    await page.getByRole("checkbox", { name: "Ch 2: Animals and Habitats" }).check();
    const generate = page.getByRole("button", { name: "Generate Set 1", exact: true });
    await generate.waitFor();
    assert.equal(await generate.isEnabled(), true);
    await page.getByRole("searchbox", { name: "Search chapters" }).fill("Water");
    assert.equal(await page.getByRole("checkbox").count(), 1);
    assert.equal(await page.getByText("2 selected", { exact: true }).count(), 1);
    await page.getByRole("searchbox").fill("");
    await mkdir(".playwright-mcp", { recursive: true });
    await page.screenshot({ path: ".playwright-mcp/multi-chapter-desktop.png", fullPage: true });
    await generate.click();
    assert.deepEqual(submitted.chapterIds, ids.slice(0, 2));
    assert.equal(submitted.chapterId, undefined);
    assert.equal(await page.getByRole("button", { name: "Single Chapter", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Finalize", exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole("button", { name: "Manual", exact: true }).isVisible(), true);
    assert.equal(await page.getByRole("link", { name: "Download", exact: true }).isVisible(), true);
    await page.getByRole("button", { name: "Finalize", exact: true }).click();
    await page.getByRole("button", { name: "Generate Set 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Single Chapter", exact: true }).click();
    assert.equal(await page.getByRole("checkbox").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Finalize", exact: true }).count(), 0);
    await page.getByLabel("Chapter", { exact: true }).selectOption(ids[0]);
    await page.getByRole("button", { name: "Generate Set 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Multi Chapter", exact: true }).click();
    assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: ".playwright-mcp/multi-chapter-mobile.png", fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.getByLabel("Grade", { exact: true }).selectOption("grade-7");
    assert.equal(await page.getByRole("checkbox", { checked: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Generate Worksheet", exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("History refreshes status, retries failures and retains the previous PDF", { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    let status = "failed", retryCount = 0;
    await page.route("**/api/worksheets", (route) => route.fulfill({ json: [{
      id: "worksheet", status, pdf_url: "about:blank", is_finalized: false, attempt_kind: "generate",
      error_message: status === "failed" ? "2/3 chapters complete; Ch 3 failed. Saved work is kept; Retry resumes it." : null,
      progress: status === "processing" ? "2/3 chapters complete; Ch 3: questions 1/2" : "Waiting for worker", created_at: "2020-01-01T00:00:00Z",
      chapter: { number: 1, name: "Plants", subject: { name: "Science", grade: { name: "Grade 6" } } },
    }] }));
    await page.route("**/api/generate/retry", (route) => {
      assert.equal(route.request().postDataJSON().worksheetId, "worksheet");
      retryCount++; status = "pending";
      return route.fulfill({ json: { success: true, worksheetId: "worksheet" } });
    });
    await page.goto((process.env.UI_TEST_URL ?? "http://localhost:3001") + "/admin/worksheets");
    await page.getByText("2/3 chapters complete; Ch 3 failed. Saved work is kept; Retry resumes it.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Previous PDF" }).isVisible(), true);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByText("Pending", { exact: true }).waitFor();
    assert.equal(retryCount, 1);
    assert.equal(await page.getByRole("button", { name: "Retry", exact: true }).count(), 0);
    status = "processing";
    await page.clock.fastForward(10000);
    await page.getByText("2/3 chapters complete; Ch 3: questions 1/2").waitFor();
    status = "completed";
    await page.clock.fastForward(10000);
    await page.getByText("Completed", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Preview", exact: true }).isVisible(), true);
  } finally { await browser.close(); }
});
