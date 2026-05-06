// Verify three.ws integration end-to-end:
// 1. The site loads.
// 2. The three.ws web component script resolves and registers <agent-3d>.
// 3. Our AgentAvatar3D wrapper actually renders <agent-3d> (not the
//    helm-crest fallback) for an agent with a three_ws_agent_id.
// 4. Console is free of catastrophic errors.
//
// Run from /tmp/threews-verify (where Playwright is installed):
//   node /mnt/c/Users/khody/vscode-projects/Gladius-Arena/scripts/verify-three-ws.mjs

import { chromium } from "playwright";

const BASE = process.env.GLADIUS_FRONTEND_URL ?? "http://localhost:5173";
const PROFILE_PATH = "/agents/1"; // Hadrian — has threeWsAgentId in mock data
const SCRIPT_HOST = "three.ws";

const log = (...args) => console.log("[verify]", ...args);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium-browser",
});
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
const networkRequests = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("request", (req) => {
  if (req.url().includes(SCRIPT_HOST)) {
    networkRequests.push({ url: req.url(), method: req.method() });
  }
});
page.on("response", (resp) => {
  if (resp.url().includes(SCRIPT_HOST)) {
    const idx = networkRequests.findIndex((r) => r.url === resp.url() && !r.status);
    if (idx >= 0) networkRequests[idx].status = resp.status();
  }
});

const target = `${BASE}${PROFILE_PATH}`;
log(`navigating to ${target}`);
await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });

log("--- network: three.ws requests ---");
for (const req of networkRequests) {
  log(`  ${req.method} ${req.status ?? "?"} ${req.url}`);
}

const customElementRegistered = await page.evaluate(() =>
  Boolean(window.customElements?.get("agent-3d")),
);
log(`customElements.get('agent-3d'): ${customElementRegistered ? "✓ registered" : "✗ not registered"}`);

const agent3dCount = await page.evaluate(() => document.querySelectorAll("agent-3d").length);
log(`<agent-3d> elements in DOM: ${agent3dCount}`);

const agent3dDetail = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll("agent-3d"));
  return els.map((el) => ({
    agentId: el.getAttribute("agent-id"),
    body: el.getAttribute("body"),
    boundingRect: el.getBoundingClientRect(),
    childNodeCount: el.childNodes.length,
    hasShadowRoot: Boolean(el.shadowRoot),
    expressEmotionType: typeof el.expressEmotion,
  }));
});
log("--- <agent-3d> instance state ---");
for (const el of agent3dDetail) {
  log(`  agent-id=${el.agentId} children=${el.childNodeCount} shadowRoot=${el.hasShadowRoot} expressEmotion=${el.expressEmotionType} size=${Math.round(el.boundingRect.width)}x${Math.round(el.boundingRect.height)}`);
}

const fallbackVisible = await page.evaluate(() => {
  // The fallback rendered by AgentAvatar3D when the script hasn't
  // resolved is an SVG with the helm crest. If <agent-3d> registered
  // and we rendered it, that fallback should be GONE inside the
  // ProfileStage.
  const stage = document.querySelector("[aria-label='three.ws 3D avatar']");
  return Boolean(stage);
});
log(`AgentAvatar3D rendered the live element (vs fallback): ${fallbackVisible ? "✓" : "✗"}`);

log("--- console errors ---");
if (errors.length === 0) log("  (none)");
else errors.forEach((e) => log("  •", e));

await page.screenshot({ path: "/tmp/threews-verify/profile.png", fullPage: false });
log("screenshot: /tmp/threews-verify/profile.png");

await browser.close();

const passed =
  customElementRegistered &&
  agent3dCount > 0 &&
  agent3dDetail.every((e) => e.expressEmotionType === "function") &&
  errors.length === 0;

log(passed ? "\n✓ three.ws fully integrated" : "\n✗ integration incomplete — see above");
process.exit(passed ? 0 : 1);
