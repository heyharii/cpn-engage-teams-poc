/**
 * Microsoft Graph proactive-install: install the CPN Engage app for employees
 * programmatically so the install event fires (→ install-capture stores their
 * conversation ref) — without anyone opening the app. This is how you onboard
 * thousands at once.
 *
 * Requires the bot's app registration to have Graph APPLICATION permissions
 * (admin-consented):
 *   - TeamsAppInstallation.ReadWriteForUser.All   (install for a user)
 *   - AppCatalog.Read.All                          (find the app in the catalog)
 *   - User.Read.All                                (optional: list users)
 */
import { config } from "./config.ts";

const GRAPH = "https://graph.microsoft.com/v1.0";

async function getGraphToken(): Promise<string | null> {
  if (!config.teams.appId || !config.teams.appPassword || !config.teams.tenantId) return null;
  const url = `https://login.microsoftonline.com/${config.teams.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.teams.appId,
    client_secret: config.teams.appPassword,
    scope: "https://graph.microsoft.com/.default"
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) {
    console.warn(`[graph] token failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  return ((await res.json()) as { access_token: string }).access_token;
}

export type DirectoryGraphUser = {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  officeLocation?: string;
  accountEnabled?: boolean;
  userType?: string;
};

/**
 * Fetch the whole directory (paginated) for the local mirror. Requires the
 * User.Read.All application permission. Follows @odata.nextLink until done.
 */
export async function fetchDirectoryUsers(): Promise<DirectoryGraphUser[]> {
  const token = await getGraphToken();
  if (!token) return [];
  const select =
    "id,displayName,userPrincipalName,mail,jobTitle,department,companyName,officeLocation,accountEnabled,userType";
  let url: string | null = `${GRAPH}/users?$select=${select}&$top=100`;
  const all: DirectoryGraphUser[] = [];
  let guard = 0;
  while (url && guard < 200) {
    guard += 1;
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      console.warn(`[graph] directory page failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
      break;
    }
    const json = (await res.json()) as { value?: DirectoryGraphUser[]; "@odata.nextLink"?: string };
    if (json.value) all.push(...json.value);
    url = json["@odata.nextLink"] ?? null;
  }
  return all;
}

export type UserProfile = {
  displayName?: string;
  jobTitle?: string;
  department?: string;
  mail?: string;
  officeLocation?: string;
};

/**
 * Read a user's directory profile (name, job title, department) for enrichment.
 * Requires the User.Read.All application permission (admin-consented). `idOrUpn`
 * may be an AAD object id or a userPrincipalName.
 */
export async function getUserProfile(idOrUpn: string): Promise<UserProfile | null> {
  const token = await getGraphToken();
  if (!token) return null;
  const select = "displayName,jobTitle,department,mail,officeLocation";
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(idOrUpn)}?$select=${select}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.warn(`[graph] profile ${idOrUpn} → ${res.status} ${(await res.text()).slice(0, 160)}`);
    return null;
  }
  return (await res.json()) as UserProfile;
}

/** Find the app's catalog id from its manifest (external) id. */
async function getCatalogAppId(token: string): Promise<string | null> {
  const ext = config.teams.manifestAppId;
  if (!ext) return null;
  const res = await fetch(`${GRAPH}/appCatalogs/teamsApps?$filter=externalId eq '${ext}'`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.warn(`[graph] catalog lookup failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as { value?: { id: string }[] };
  return json.value?.[0]?.id ?? null;
}

/** Install the app for one user (201 created, or 409 already installed = ok). */
async function installForUser(token: string, userId: string, catalogId: string): Promise<"installed" | "exists" | "failed"> {
  const res = await fetch(`${GRAPH}/users/${userId}/teamwork/installedApps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ "teamsApp@odata.bind": `${GRAPH}/appCatalogs/teamsApps/${catalogId}` })
  });
  if (res.status === 201) return "installed";
  if (res.status === 409) return "exists";
  console.warn(`[graph] install ${userId} → ${res.status} ${(await res.text()).slice(0, 160)}`);
  return "failed";
}

/** Proactively install the app for a list of user AAD object ids. */
export async function installAppForUsers(userIds: string[]): Promise<{ installed: number; exists: number; failed: number; error?: string }> {
  const token = await getGraphToken();
  if (!token) return { installed: 0, exists: 0, failed: 0, error: "no graph token (check secret/tenant + Graph permissions)" };
  const catalogId = await getCatalogAppId(token);
  if (!catalogId) return { installed: 0, exists: 0, failed: 0, error: "app not found in org catalog (publish/upload it + set TEAMS_MANIFEST_APP_ID)" };

  let installed = 0, exists = 0, failed = 0;
  for (const id of userIds) {
    const r = await installForUser(token, id, catalogId);
    if (r === "installed") installed += 1;
    else if (r === "exists") exists += 1;
    else failed += 1;
  }
  return { installed, exists, failed };
}
