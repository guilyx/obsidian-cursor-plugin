export function parseBridgeUrl(bridgeUrl: string): { host: string; port: number } {
  const url = new URL(bridgeUrl);
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  return { host: url.hostname, port };
}
