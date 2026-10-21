/** Scope open state to the clicked renderer, not every retained copy of the composer. */
export function patchMenuBundle(source) {
  const marker = '/* zerosub: menu owner */';
  const oldSignature = 'function Z(s){const l=(0,o.c)(57),{view:c}=s';
  const newSignature = 'function Z(menuProps){const l=(0,o.c)(57),{view:c}=menuProps';
  if (source.includes(marker)) return source.replace(oldSignature, newSignature);
  const start = source.indexOf('function Z(s){const l=(0,o.c)(57),{view:c}=s');
  const end = source.indexOf('function $(e)', start);
  if (start < 0 || end < 0) throw new Error('Unsupported Paseo button renderer; no files changed');
  let component = source.slice(start, end);
  const signature = 'const L=C;';
  if (!component.includes('C=e=>z.pluginButtonStore.setOpen(u.key,e)') || !component.includes(signature)) {
    throw new Error('Unsupported Paseo menu state; no files changed');
  }
  // Keep the host store's close-on-update and pending semantics. Only the renderer whose
  // trigger was clicked may display the shared open state. Clear ownership after closing.
  component = component.replace(oldSignature, newSignature);
  component = component.replace('const L=C;', `const [menuOwner,setMenuOwner]=(0,s.useState)(false);${marker}(0,s.useEffect)(()=>{if(!u.open)setMenuOwner(false)},[u.open]);const L=(0,s.useCallback)(value=>{setMenuOwner(value);C(value)},[C]);const menuOpen=u.open&&menuOwner;`);
  const split = component.indexOf('const menuOpen=u.open&&menuOwner;') + 'const menuOpen=u.open&&menuOwner;'.length;
  component = component.slice(0, split) + component.slice(split).replaceAll('u.open','menuOpen');
  return source.slice(0,start) + component + source.slice(end);
}
