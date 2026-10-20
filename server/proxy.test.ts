import { afterEach, describe, expect, it } from "vitest";
import http from "node:http";
import net from "node:net";
import https from "node:https";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tunnel, createBridge, readProxy, saveProxy, proxyEnvironment, closeBridges, proxyUrl } from "./proxy";
import { proxyView, ProxyInputSchema, type ProxyConfig } from "../shared/proxy";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { await closeBridges(); for (const stop of cleanups.splice(0).reverse()) await stop(); });
async function listen(server: net.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const sockets = new Set<net.Socket>();
  server.on("connection", (s) => { sockets.add(s); s.on("close", () => sockets.delete(s)); });
  cleanups.push(() => { for (const s of sockets) s.destroy(); server.close(); });
  return (server.address() as net.AddressInfo).port;
}
const config = (port: number, type: ProxyConfig["type"] = "http"): ProxyConfig => ({ type, host: "127.0.0.1", port, username: "user", password: "p@ss:word" });
function onceData(socket: net.Socket) { return new Promise<Buffer>((resolve, reject) => { socket.once("data", resolve); socket.once("error", reject); }); }

it("HTTP CONNECT sends proxy credentials only to the proxy and transports bytes", async () => {
  const proxy = http.createServer();
  let seen = "";
  proxy.on("connect", (req, socket) => {
    seen = String(req.headers["proxy-authorization"]);
    expect(req.url).toBe("provider.test:443");
    socket.write("HTTP/1.1 200 OK\r\n\r\n"); socket.on("data", (b) => socket.write(b));
  });
  const socket = await tunnel(config(await listen(proxy)), "provider.test", 443);
  const reply = onceData(socket); socket.write("hello"); expect((await reply).toString()).toBe("hello"); socket.destroy();
  expect(seen).toBe(`Basic ${Buffer.from("user:p@ss:word").toString("base64")}`);
});

it("HTTP rejection fails without a direct retry or credential disclosure", async () => {
  const proxy = http.createServer();
  proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"));
  await expect(tunnel(config(await listen(proxy)), "must-not-resolve.invalid", 443)).rejects.toThrow("логин или пароль");
});

it("SOCKS5 authenticates and sends the domain to the proxy, not local DNS", async () => {
  let credentials = "", destination = "";
  const proxy = net.createServer((socket) => {
    let step = 0;
    socket.on("data", (b) => {
      if (step === 0) { expect(b[0]).toBe(5); socket.write(Buffer.from([5, 2])); }
      else if (step === 1) {
        const n = b[1]!; credentials = `${b.subarray(2, 2+n)}:${b.subarray(3+n)}`;
        socket.write(Buffer.from([1, 0]));
      } else if (step === 2) {
        expect(b[3]).toBe(3); destination = b.subarray(5, 5+b[4]!).toString();
        socket.write(Buffer.from([5,0,0,1,127,0,0,1,1,187]));
      } else socket.write(b);
      step++;
    });
  });
  const socket = await tunnel(config(await listen(proxy), "socks5"), "must-not-resolve.invalid", 443);
  const reply = onceData(socket); socket.write("through socks"); expect((await reply).toString()).toBe("through socks"); socket.destroy();
  expect(credentials).toBe("user:p@ss:word"); expect(destination).toBe("must-not-resolve.invalid");
});

it("SOCKS5 rejects incorrect authentication", async () => {
  const proxy = net.createServer((s) => { let step=0; s.on("data", () => s.write(Buffer.from(step++===0 ? [5,2] : [1,1]))); });
  await expect(tunnel(config(await listen(proxy), "socks5"), "invalid.invalid", 443)).rejects.toThrow();
});

it("HTTPS proxy rejects an untrusted certificate", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zerosub-tls-")); cleanups.push(() => rm(dir, { recursive:true, force:true }));
  execFileSync("openssl", ["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(dir,"key.pem"),"-out",join(dir,"cert.pem"),"-subj","/CN=localhost","-days","1"], { stdio:"ignore" });
  const proxy = https.createServer({ key:await readFile(join(dir,"key.pem")), cert:await readFile(join(dir,"cert.pem")) });
  proxy.on("tlsClientError", () => undefined);
  await expect(tunnel(config(await listen(proxy), "https"), "provider.test",443)).rejects.toThrow("сертификат");
});

it("loopback bridge requires a secret and never forwards HTTP plaintext", async () => {
  let connects=0; const upstream=http.createServer(); upstream.on("connect",(_r,s)=>{connects++;s.end();});
  const bridge=await createBridge(config(await listen(upstream))); cleanups.push(bridge.close);
  const url=new URL(bridge.url);
  const status=await new Promise<number|undefined>((resolve,reject)=>{
    const r=http.request({hostname:url.hostname,port:url.port,method:"CONNECT",path:"example.test:443"});
    r.on("connect",(res,s)=>{resolve(res.statusCode);s.destroy();});r.on("error",reject);r.end();
  });
  expect(status).toBe(407);expect(connects).toBe(0);
});

it("stores separate account proxies with private permissions and a write-only password", async () => {
  const dir=await mkdtemp(join(tmpdir(),"zerosub-proxies-")); const old=process.env.PASEO_HOME; process.env.PASEO_HOME=dir;
  cleanups.push(async()=>{if(old===undefined)delete process.env.PASEO_HOME;else process.env.PASEO_HOME=old;await rm(dir,{recursive:true,force:true});});
  await saveProxy("codex","/account-a",config(10001)); await saveProxy("codex","/account-b",config(10002,"socks5"));
  await saveProxy("codex","/account-a",{type:"https",host:"127.0.0.1",port:10003,username:"user"});
  expect((await readProxy("codex","/account-a"))?.password).toBe("p@ss:word");
  expect(proxyView(await readProxy("codex","/account-a"))).not.toHaveProperty("password");
  expect((await stat(join(dir,"zerosub/proxies.json"))).mode & 0o777).toBe(0o600);
  const a=await proxyEnvironment("codex","/account-a"), b=await proxyEnvironment("codex","/account-b");
  expect(a.HTTPS_PROXY).not.toBe(b.HTTPS_PROXY); expect(a.NO_PROXY).not.toContain("chatgpt");
  await saveProxy("codex","/account-a",null); expect(await readProxy("codex","/account-a")).toBeNull();
  expect((await readProxy("codex","/account-b"))?.port).toBe(10002);
});

it("validates endpoints and escapes special characters in credentials", () => {
  expect(ProxyInputSchema.safeParse({type:"http",host:"https://evil.test/path",port:80}).success).toBe(false);
  expect(ProxyInputSchema.safeParse({type:"socks5",host:"localhost",port:65536}).success).toBe(false);
  const url=proxyUrl({...config(1080,"socks5"),username:"a@b",password:"x/@:#"});
  expect(decodeURIComponent(url.password)).toBe("x/@:#");expect(url.hostname).toBe("127.0.0.1");expect(url.protocol).toBe("socks5h:");
});

it("two simultaneous CLI bridges keep their authenticated routes separate", async () => {
  async function bridgeFor(marker: string) {
    const upstream=http.createServer();
    upstream.on("connect", (req,socket)=>{
      expect(req.headers["proxy-authorization"]).toBe(`Basic ${Buffer.from("user:p@ss:word").toString("base64")}`);
      socket.write("HTTP/1.1 200 OK\r\n\r\n");socket.on("data",()=>socket.write(marker));
    });
    const bridge=await createBridge(config(await listen(upstream)));cleanups.push(bridge.close);return new URL(bridge.url);
  }
  const [a,b]=await Promise.all([bridgeFor("account-a"),bridgeFor("account-b")]);
  async function through(url: URL) {
    return new Promise<string>((resolve,reject)=>{
      const req=http.request({hostname:url.hostname,port:url.port,method:"CONNECT",path:"provider.invalid:443",
        headers:{"Proxy-Authorization":`Basic ${Buffer.from(`${url.username}:${url.password}`).toString("base64")}`}});
      req.on("error",reject);req.on("connect",(res,socket)=>{
        expect(res.statusCode).toBe(200);socket.once("data",(chunk)=>{resolve(chunk.toString());socket.destroy();});socket.write("PING");
      });req.end();
    });
  }
  expect(await Promise.all([through(a),through(b)])).toEqual(["account-a","account-b"]);
});
