import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const teamsDir = path.resolve(scriptDir, "..");
const distDir = path.join(teamsDir, "appPackage", "dist");
const manifestPath = path.join(distDir, "manifest.json");
const colorIconPath = path.join(distDir, "color.png");
const outlineIconPath = path.join(distDir, "outline.png");
const zipPath = path.join(distDir, "cpn-engage-teams-app.zip");

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest not found at ${manifestPath}. Run the render step first.`);
}

if (!fs.existsSync(colorIconPath) || !fs.existsSync(outlineIconPath)) {
  throw new Error("Packaged icons are missing. Ensure render step copied color.png and outline.png.");
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

execFileSync("zip", ["-j", zipPath, manifestPath, colorIconPath, outlineIconPath], {
  stdio: "inherit"
});

console.log(`Packaged Teams app zip at ${zipPath}`);
