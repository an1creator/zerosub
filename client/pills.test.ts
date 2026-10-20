import { expect,it,vi } from "vitest";
import { buttonFor } from "./pills";
import type { PluginClientContext } from "@getpaseo/plugin/client";
import { StateViewSchema } from "../shared/model";
import type { ZeroSubStore } from "./store";
vi.mock("react-native",()=>({NativeModules:{},Platform:{OS:"web"}}));
it("opens one account picker screen instead of host popover menus",()=>{
 const openScreen=vi.fn();
 const accounts=["a","b"].map(id=>({id,family:"codex",label:id,kind:"main",email:null,plan:null,organization:null,status:"ready",isDefault:id==="a",limitedUntil:null,usage:null,agentCount:1,home:null}));
 const state=StateViewSchema.parse({accounts,agents:[],logins:[],providers:{codex:"codex"},canReopen:true,showComposerPill:true,warnings:[]});
 const button=buttonFor({openScreen} as unknown as PluginClientContext,{} as ZeroSubStore,state,{id:"agent-a",workspaceId:"workspace-a",provider:"codex"});
 expect(button?.behavior.kind).toBe("action");
 if(button?.behavior.kind!=="action")throw new Error("Expected action");
 (button.behavior.onPress as ()=>unknown)();
 expect(openScreen).toHaveBeenCalledExactlyOnceWith({screenId:"account-picker",params:{agentId:"agent-a",workspaceId:"workspace-a"}});
});
