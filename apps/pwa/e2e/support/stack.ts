/** Is the local stack up? The tests never start servers. */
async function answers(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });
    return res.status > 0;
  } catch {
    return false;
  }
}

export async function stackDownReason(
  pwaUrl: string,
  apiUrl: string,
  hubUrl: string,
): Promise<string | null> {
  const [pwa, api, hub] = await Promise.all([
    answers(pwaUrl),
    answers(`${apiUrl}/api/v1/health`),
    answers(`${hubUrl}/oidc/.well-known/openid-configuration`),
  ]);
  const down = [
    !pwa && `PWA ${pwaUrl}`,
    !api && `API ${apiUrl}`,
    !hub && `Hub ${hubUrl}`,
  ].filter(Boolean);
  return down.length
    ? `Local stack not reachable (${down.join(", ")}). Start it (operator: \`bun run dev:pwa\` here + \`bun run dev\` in stageholder-identity) and rerun.`
    : null;
}

/** Poll the API health endpoint until it answers 200 or the budget runs out. */
export async function waitForApi(
  apiUrl: string,
  budgetMs = 60_000,
): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status === 200) return true;
    } catch {
      /* restarting */
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  return false;
}
