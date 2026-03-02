import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const port = Number.parseInt(process.env.PORT ?? "8080", 10);

function resolvePathname(pathname) {
  if (pathname === "/") {
    return "index.html";
  }
  return pathname.replace(/^\/+/, "");
}

function isSafeDistPath(filePath) {
  const relative = path.relative(distDir, filePath);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const decodedPath = decodeURIComponent(url.pathname);
    const relativePath = resolvePathname(decodedPath);
    const candidatePath = path.join(distDir, relativePath);

    if (isSafeDistPath(candidatePath)) {
      const file = Bun.file(candidatePath);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    const fallback = Bun.file(path.join(distDir, "index.html"));
    if (await fallback.exists()) {
      return new Response(fallback);
    }

    return new Response("Build output not found. Run bun run build first.", { status: 404 });
  },
});

console.log(`Serving dist at http://localhost:${server.port}`);
