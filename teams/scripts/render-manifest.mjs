import fs from "node:fs";
import path from "node:path";

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const teamsDir = path.resolve(scriptDir, "..");
const appPackageDir = path.join(teamsDir, "appPackage");
const templatePath = path.join(appPackageDir, "manifest.template.json");
const defaultEnvPath = path.join(teamsDir, ".env.local");
const outputDir = path.join(appPackageDir, "dist");
const outputPath = path.join(outputDir, "manifest.json");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        return [key, value];
      })
  );
}

function requiredEnv(name, env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required env value: ${name}`);
  }
  return value;
}

function uniqueDomains(env) {
  const urlKeys = ["EMPLOYEE_APP_URL", "ADMIN_CONSOLE_URL", "API_BASE_URL"];
  const domains = new Set();

  for (const key of urlKeys) {
    const value = env[key];
    if (!value) {
      continue;
    }
    try {
      domains.add(new URL(value).hostname);
    } catch {
      // ignore malformed URLs here; required replacement handles main validation
    }
  }

  if (env.TEAMS_APP_DOMAIN) {
    domains.add(env.TEAMS_APP_DOMAIN);
  }

  return [...domains];
}

function replaceTemplateValues(template, env) {
  const replacements = {
    TEAMS_APP_ID: requiredEnv("TEAMS_APP_ID", env),
    TEAMS_ENTRA_CLIENT_ID: requiredEnv("TEAMS_ENTRA_CLIENT_ID", env),
    TEAMS_BOT_ID: requiredEnv("TEAMS_BOT_ID", env),
    EMPLOYEE_APP_URL: requiredEnv("EMPLOYEE_APP_URL", env),
    ADMIN_CONSOLE_URL: requiredEnv("ADMIN_CONSOLE_URL", env),
    APPLICATION_ID_URI: requiredEnv("APPLICATION_ID_URI", env),
    TEAMS_APP_DOMAIN: requiredEnv("TEAMS_APP_DOMAIN", env)
  };

  let output = template;

  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`\${{${key}}}`, value);
  }

  return output;
}

function copyIfPresent(fileName) {
  const source = path.join(appPackageDir, fileName);
  const destination = path.join(outputDir, fileName);

  if (fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
  }
}

const envFilePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultEnvPath;
const env = {
  ...parseEnvFile(envFilePath),
  ...process.env
};

const template = fs.readFileSync(templatePath, "utf8");
const replaced = replaceTemplateValues(template, env);
const manifest = JSON.parse(replaced);
manifest.validDomains = uniqueDomains(env);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
copyIfPresent("color.png");
copyIfPresent("outline.png");

console.log(`Manifest rendered to ${outputPath}`);
console.log(`Valid domains: ${manifest.validDomains.join(", ")}`);
