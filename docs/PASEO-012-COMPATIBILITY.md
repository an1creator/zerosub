# Paseo 0.12 usage panels

Paseo 0.12 runs its built-in Codex and Cursor quota checks independently of account sessions. Those checks can return HTTP 403 even when chats work through an account proxy. Built-in usage source IDs are reserved and cannot be replaced by a normal plugin.

The optional Linux desktop compatibility patch routes these requests through the account manager:

- Codex: the proxy associated with the quota request's own credential home.
- Cursor: the proxy of the default Codex account. Cursor authentication remains unchanged.
- Other Codex-compatible harnesses keep their existing routing.

## Apply

From a development checkout with dependencies installed:

```sh
node scripts/install-paseo-usage-fix.mjs
```

The script validates both source signatures, saves private backups under `~/.local/share/zerosub-backups/paseo-usage-*`, and changes only the two built-in usage transports under `/opt/Paseo/resources/builtin-plugins`. It uses `sudo` for those installed files. No credentials are embedded in the patch or its backups.

**Restart Paseo after the current chat finishes.** An app update may overwrite the patch; reapply it if the issue returns. To restore, copy the backed-up `codex-usage.ts` and `cursor-usage.ts` to the respective `server/usage.ts` files and restart Paseo. The unused transport helper can then be removed.

This patch preserves the built-in account identity, quota windows, balances, and report format. Proxy failures do not fall back to a direct connection.

## Duplicate account menu

Some Paseo 0.12 desktop layouts retain multiple renderers for the same chat button. Their shared open state can display two copies of the account menu. The account manager uses the original dropdown; this local patch limits opening to the clicked renderer:

```sh
node scripts/install-paseo-menu-fix.mjs
```

The installer checks the supported bundle signature and JavaScript syntax, backs up the bundle under `~/.local/share/zerosub-backups/paseo-menu-*`, and installs it using `sudo`. Restart Paseo to load it. App updates may overwrite this patch. To undo it, restore the original backed-up `index-*.js` to `/opt/Paseo/resources/app-dist/_expo/static/js/web/` and restart Paseo.
