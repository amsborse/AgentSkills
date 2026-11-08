// Real screenshots of a running page at the widths that matter, in both themes.
// Usage: node shoot.mjs <projectDir> <outDir> <baseUrl> [query] [themeKey]
//   projectDir: where @playwright/test is installed; query e.g. "?heroTime=4"
//   themeKey: localStorage key for the theme (omit if the site has none)
import { createRequire } from "node:module";
import path from "node:path";

const [projectDir, out, baseUrl, query = "", themeKey = ""] = process.argv.slice(2);
if (!projectDir || !out || !baseUrl) {
  console.error("usage: node shoot.mjs <projectDir> <outDir> <baseUrl> [query] [themeKey]");
  process.exit(1);
}
const require = createRequire(path.resolve(projectDir, "package.json"));
const { chromium } = require("@playwright/test");

const shots = [
  ["dark-1440", 1440, 900, "dark"],
  ["light-1440", 1440, 900, "light"],
  ["dark-1920", 1920, 1080, "dark"],
  ["dark-834", 834, 1112, "dark"],
  ["dark-390", 390, 844, "dark"],
];
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--enable-gpu"] });
let failed = false;
for (const [name, w, h, theme] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
  if (themeKey) await ctx.addInitScript(([k, t]) => localStorage.setItem(k, t), [themeKey, theme]);
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") {
      failed = true;
      console.error(name, "console error:", m.text());
    }
  });
  await page.goto(`${baseUrl}${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
await browser.close();
console.log(failed ? "done WITH console errors" : "ok");
process.exit(failed ? 2 : 0);
