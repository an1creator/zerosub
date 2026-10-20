import http from "node:http";
import https from "node:https";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { SocksClient } from "socks";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { z } from "zod";
import { ProxyStoredSchema, type ProxyConfig, type ProxyInput } from "../shared/proxy";
import type { Family } from "../shared/model";
import { Mutex, readJson, writeJsonAtomic } from "./json-file";
import { dataDir } from "./paths";

const storeSchema = z.record(z.string(), ProxyStoredSchema);
const lock = new Mutex();
const key = (family: Family, home: string | null) => `${family}:${home ?? "main"}`;
async function readStore() {
  // An unreadable or invalid store must never silently switch to a direct connection.
  return storeSchema.parse((await readJson(join(dataDir(), "proxies.json"))) ?? {});
}
export async function readProxy(family: Family, home: string | null): Promise<ProxyConfig | null> {
  return (await readStore())[key(family, home)] ?? null;
}
export async function saveProxy(family: Family, home: string | null, input: ProxyInput | null): Promise<void> {
  await lock.run(async () => {
    const all = await readStore();
    const id = key(family, home);
    if (input) {
      const config = ProxyStoredSchema.parse({ ...input, password: input.password ?? all[id]?.password ?? "" });
      if (config.password && !config.username) throw new Error("Для пароля прокси укажите логин.");
      if (config.type !== "socks5" && config.username.includes(":")) throw new Error("Логин HTTP-прокси не должен содержать двоеточие.");
      all[id] = config;
    } else delete all[id];
    await writeJsonAtomic(join(dataDir(), "proxies.json"), all);
  });
}
export function proxyUrl(config: ProxyConfig): URL {
  const url = new URL(`${config.type === "socks5" ? "socks5h" : config.type}://${config.host}:${config.port}`);
  url.username = config.username;
  url.password = config.password;
  return url;
}
function agentFor(config: ProxyConfig) {
  return config.type === "socks5"
    ? new SocksProxyAgent(proxyUrl(config), { timeout: 15_000 })
    : new HttpsProxyAgent(proxyUrl(config));
}

/** Establish a byte tunnel only. Target TLS remains end-to-end with the provider. */
export async function tunnel(config: ProxyConfig, host: string, port: number): Promise<net.Socket> {
  if (config.type === "socks5") {
    const result = await SocksClient.createConnection({
      proxy: { host: config.host.replace(/^\[|\]$/g, ""), port: config.port, type: 5,
        userId: config.username || undefined, password: config.password || undefined },
      command: "connect", destination: { host, port }, timeout: 15_000,
    });
    return result.socket;
  }
  return new Promise((resolve, reject) => {
    const authority = `${net.isIPv6(host) ? `[${host}]` : host}:${port}`;
    const headers: Record<string, string> = { Host: authority };
    if (config.username) headers["Proxy-Authorization"] = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
    const request = (config.type === "https" ? https : http).request({
      hostname: config.host.replace(/^\[|\]$/g, ""), port: config.port, method: "CONNECT", path: authority, headers,
    });
    const timer = setTimeout(() => request.destroy(new Error("Proxy timeout")), 15_000);
    request.on("error", () => { clearTimeout(timer); reject(new Error("Не удалось соединиться с прокси. Проверьте адрес, сертификат и доступность.")); });
    request.on("connect", (response, socket, head) => {
      clearTimeout(timer);
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(new Error(response.statusCode === 407 ? "Прокси отклонил логин или пароль." : `Прокси отклонил соединение (HTTP ${response.statusCode}).`));
      } else {
        if (head.length) socket.unshift(head);
        resolve(socket);
      }
    });
    request.end();
  });
}

// A private loopback HTTP proxy lets all CLIs use the same HTTP CONNECT interface,
// including when the upstream is an authenticated SOCKS5 proxy. Never logs URLs/secrets.
const bridges = new Map<string, Promise<{ url: string; close(): void }>>();
export async function createBridge(config: ProxyConfig): Promise<{ url: string; close(): void }> {
  const password = randomBytes(24).toString("hex");
  const authorization = `Basic ${Buffer.from(`zerosub:${password}`).toString("base64")}`;
  const sockets = new Set<net.Socket>();
  const server = http.createServer((req, res) => {
    if (req.headers["proxy-authorization"] !== authorization) { res.writeHead(407); res.end(); return; }
    // Provider endpoints are HTTPS. Refuse plaintext forwarding instead of leaking tokens.
    res.writeHead(400); res.end("Use HTTPS CONNECT");
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  server.on("connect", async (req, client, head) => {
    client.on("error", () => undefined);
    if (req.headers["proxy-authorization"] !== authorization) { client.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"); return; }
    try {
      const target = new URL(`https://${req.url}`);
      if (target.username || target.password || target.pathname !== "/") throw new Error("Invalid target");
      const upstream = await tunnel(config, target.hostname.replace(/^\[|\]$/g, ""), Number(target.port || 443));
      if (client.destroyed) { upstream.destroy(); return; }
      sockets.add(upstream);
      upstream.on("close", () => { sockets.delete(upstream); client.destroy(); });
      upstream.on("error", () => client.destroy());
      client.on("close", () => upstream.destroy());
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream); upstream.pipe(client);
    } catch { client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  server.unref();
  const port = (server.address() as net.AddressInfo).port;
  return { url: `http://zerosub:${password}@127.0.0.1:${port}`, close: () => { server.close(); for (const socket of sockets) socket.destroy(); } };
}
export function proxyEnvForUrl(url: string): Record<string, string> {
  return { HTTP_PROXY: url, HTTPS_PROXY: url, ALL_PROXY: url, http_proxy: url, https_proxy: url, all_proxy: url,
    NO_PROXY: "localhost,127.0.0.1,::1", no_proxy: "localhost,127.0.0.1,::1" };
}
export async function proxyEnvironment(family: Family, home: string | null): Promise<Record<string, string>> {
  const config = await readProxy(family, home);
  if (!config) return {}; // Preserve the user's system routing when no per-account proxy is set.
  const id = JSON.stringify(config);
  let bridge = bridges.get(id);
  if (!bridge) {
    bridge = createBridge(config);
    bridges.set(id, bridge);
    bridge.catch(() => bridges.delete(id));
  }
  return proxyEnvForUrl((await bridge).url);
}
export async function closeBridges() {
  for (const bridge of bridges.values()) (await bridge.catch(() => null))?.close();
  bridges.clear();
}

/** Claude usage/reset requests must follow the account proxy too. No redirect following. */
export async function accountFetch(family: Family, home: string | null, url: string, init: RequestInit): Promise<Response> {
  const config = await readProxy(family, home);
  if (!config) return fetch(url, init);
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("Требуется HTTPS.");
  return new Promise((resolve, reject) => {
    const request = https.request(target, { method: init.method ?? "GET", headers: init.headers as Record<string, string>,
      agent: agentFor(config), signal: init.signal ?? undefined }, (response) => {
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 2 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
      response.on("error", () => reject(new Error("Ответ через прокси прерван.")));
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode ?? 502,
        headers: Object.fromEntries(Object.entries(response.headers).filter(([, v]) => typeof v === "string") as [string,string][]) })));
    });
    const timer = setTimeout(() => request.destroy(), 20_000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", () => reject(new Error("Запрос через прокси не выполнен. Проверьте подключение и авторизацию прокси.")));
    if (typeof init.body === "string") request.write(init.body);
    request.end();
  });
}
export async function testProxy(config: ProxyConfig, family: Family): Promise<{ ok: boolean; message: string }> {
  // Checks tunnel + verified target TLS, without subscription tokens or third-party IP services.
  const host = family === "codex" ? "chatgpt.com" : "api.anthropic.com";
  return new Promise((resolve) => {
    const request = https.request(`https://${host}/`, { method: "HEAD", agent: agentFor(config) }, (response) => {
      response.resume();
      const socket = response.socket as import("node:tls").TLSSocket;
      const ok = Boolean(socket.encrypted && socket.authorized);
      resolve({ ok, message: ok ? `Соединение с ${host} через прокси установлено (HTTP ${response.statusCode}). Это проверка сети, не подписки.` : "Прокси не установил защищённое соединение с сервисом. Проверьте авторизацию и доступность." });
    });
    const timer = setTimeout(() => request.destroy(), 15_000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", () => resolve({ ok: false, message: "Проверка не прошла: проверьте адрес, порт, логин, пароль и сертификат прокси." }));
    request.end();
  });
}
