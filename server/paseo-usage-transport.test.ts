import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { usageFetch,usageProxyHome } from "./paseo-usage-transport";
const mocks=vi.hoisted(()=>({read:vi.fn(),fetch:vi.fn()}));
vi.mock("./json-file",()=>({readJson:mocks.read}));
vi.mock("./proxy",()=>({accountFetch:mocks.fetch}));
beforeEach(()=>{vi.stubEnv("CODEX_HOME","/main");vi.clearAllMocks();mocks.read.mockResolvedValue({});mocks.fetch.mockResolvedValue({status:200});});
afterEach(()=>vi.unstubAllEnvs());
it("uses the credential home for each native Codex quota request",async()=>{
 await usageFetch({route:{store:"codex",path:"/account-a/auth.json"}})("https://chatgpt.com/backend-api/wham/usage");
 expect(mocks.fetch).toHaveBeenLastCalledWith("codex","/account-a",expect.any(String),{});
 await usageFetch({route:{store:"codex",path:"/account-b/auth.json"}})("https://chatgpt.com/backend-api/wham/usage");
 expect(mocks.fetch).toHaveBeenLastCalledWith("codex","/account-b",expect.any(String),{});
 expect(usageProxyHome({route:{store:"codex",path:"/main/auth.json"}},{})).toBeNull();
});
it("keeps unrelated harness routing unchanged and uses the default proxy for Cursor",()=>{
 expect(usageProxyHome({route:{store:"pi",path:"/other/auth.json"}},{})).toBeUndefined();
 expect(usageProxyHome({store:"sqlite",locator:"cursor"},{defaults:{codex:"work"},accounts:[{id:"work",family:"codex",home:"/work"}]})).toBe("/work");
});
it("does not fall back to a direct request if the proxy fails",async()=>{
 mocks.fetch.mockRejectedValue(new Error("Proxy unavailable"));
 await expect(usageFetch({route:{store:"codex",path:"/account-a/auth.json"}})("https://chatgpt.com/backend-api/wham/usage")).rejects.toThrow("Proxy unavailable");
});
