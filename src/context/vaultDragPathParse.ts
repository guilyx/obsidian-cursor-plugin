export function parseWikiLinkText(raw: string): string | null {
  const wiki = raw.trim().match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  return wiki?.[1] ?? null;
}

export function parseObsidianFileParam(uri: string): string | null {
  try {
    const url = new URL(uri);
    const fileParam = url.searchParams.get("file");
    return fileParam ? decodeURIComponent(fileParam) : null;
  } catch {
    return null;
  }
}

export function pathsFromHtml(html: string): string[] {
  const paths: string[] = [];
  const appLink = html.match(/href="app:\/\/obsidian\.md\/(.*?)"/);
  if (appLink?.[1]) {
    paths.push(decodeURIComponent(appLink[1]));
  }
  return paths;
}
