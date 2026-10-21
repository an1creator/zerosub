import * as React from "react";
import { act, create } from "react-test-renderer";
import { expect,it } from "vitest";
// @ts-expect-error Local installer helper has no declaration file.
import { patchMenuBundle } from "../scripts/paseo-menu-patch.mjs";
const original='function Z(s){const l=(0,o.c)(57),{view:c}=s;let C=e=>z.pluginButtonStore.setOpen(u.key,e);const L=C;return {open:u.open,onOpenChange:L}}function $(e){}';
it("opens only the clicked composer and releases ownership after host closes it",()=>{
 const patched=patchMenuBundle(original);
 const component=patched.slice(0,patched.indexOf('function $(e)'));
 const render=new Function('s','o','z','u',component+';return Z({view:{}})');
 let first:any,second:any,root:ReturnType<typeof create>;
 let hostOpen=false;
 function Button({id}:{id:number}) {const menu=render(React,{c:()=>[]},{pluginButtonStore:{setOpen:(_key:string,value:boolean)=>{hostOpen=value}}},{open:hostOpen});if(id===1)first=menu;else second=menu;return null;}
 const tree=()=> <><Button id={1}/><Button id={2}/></>;
 act(()=>{root=create(tree());});
 act(()=>{first.onOpenChange(true);root.update(tree());});
 expect([first.open,second.open]).toEqual([true,false]);
 act(()=>{hostOpen=false;root.update(tree());});
 act(()=>{second.onOpenChange(true);root.update(tree());});
 expect([first.open,second.open]).toEqual([false,true]);
 act(()=>{second.onOpenChange(false);root.update(tree());});
 expect([first.open,second.open]).toEqual([false,false]);
 act(()=>root.unmount());
 expect(patchMenuBundle(patched)).toBe(patched);
 expect(()=>patchMenuBundle('unknown version')).toThrow('Unsupported');
});
