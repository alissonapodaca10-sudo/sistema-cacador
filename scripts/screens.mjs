// Walks the built app in an iPhone-sized headless Chrome and saves a screenshot of each screen.
// Usage: node scripts/screens.mjs <url> <outDir>
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url = "http://localhost:4173/sistema-cacador/", outDir = "screens"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: `${outDir}/${name}.png` });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = async (text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    if (el) el.click();
    return !!el;
  }, text);
  if (!ok) throw new Error(`button not found: ${text}`);
  await wait(500);
};

await page.goto(url, { waitUntil: "networkidle0" });
await wait(800);
await shot("01-onboarding");
await clickText("Aceitar");
await page.type("input.field", "Shoteiri");
await clickText("Despertar");
await clickText("Confirmar");
await shot("02-dailies");

// Complete the reading daily: earns gold and XP.
await page.evaluate(() => [...document.querySelectorAll(".task")].find((t) => t.textContent.includes("Ler"))?.querySelector(".check")?.click());
await wait(700);
await clickText("Confirmar").catch(() => {});
await shot("03-daily-done");

for (const [tab, name] of [["Status", "04-status"], ["Hábitos", "05-habits"], ["Missões", "06-todos"], ["Arsenal", "08-arsenal"], ["Loja", "09-shop"]]) {
  await clickText(tab);
  await wait(600);
  await shot(name);
}

await clickText("Trajes");
await shot("10-shop-outfits");
await clickText("Armas");
await page.evaluate(() => document.querySelectorAll(".card-wrap")[1]?.click());
await wait(600);
await shot("11-item-detail");
await clickText("Fechar");

await clickText("Portais");
await clickText("Entrar");
await clickText("Confirmar");
await wait(500);
await shot("12-gate");
// Practice attack: tap the hunter, capture mid-strike.
await page.evaluate(() => document.querySelector(".fighter.hero:not([style*='opacity'])")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await wait(420);
await shot("13-attack");
await wait(1200);
await page.evaluate(() => document.querySelector(".fighter.enemy:not([style*='opacity'])")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await wait(430);
await shot("14-defense");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await browser.close();
