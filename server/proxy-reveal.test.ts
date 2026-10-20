import { expect, it, vi } from "vitest";
import { Service } from "./service";
import { StateStore, StoredStateSchema } from "./state";
import type { FamilyAdapter } from "./adapter";
import type { Family } from "../shared/model";
import { proxyView } from "../shared/proxy";

const { readProxy } = vi.hoisted(() => ({ readProxy: vi.fn() }));
vi.mock("./proxy", () => ({ readProxy, saveProxy: vi.fn(), testProxy: vi.fn() }));
const state = StoredStateSchema.parse({accounts:[{id:"codex-main",family:"codex",label:"Test",kind:"main",home:null,createdAt:"2026-10-21"}]});
const service = new Service({} as Record<Family,FamilyAdapter>, { read:async()=>state } as StateStore);
it("reveals only the explicitly selected account password, never in normal views", async () => {
  const config = {type:"http" as const,host:"proxy.example.com",port:8080,username:"demo",password:"test-password"};
  readProxy.mockResolvedValue(config);
  expect(proxyView(config)).not.toHaveProperty("password");
  expect(await service.revealProxyPassword("codex-main")).toEqual({password:"test-password"});
  expect(readProxy).toHaveBeenLastCalledWith("codex",null);
});
it("rejects unknown accounts before reading any credentials", async () => {
  readProxy.mockClear();
  await expect(service.revealProxyPassword("unknown")).rejects.toThrow();
  expect(readProxy).not.toHaveBeenCalled();
});
