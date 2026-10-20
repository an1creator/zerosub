# Accounts for Paseo

Manage Claude and ChatGPT/Codex accounts with per-account proxies. The interface follows Paseo’s language: English or Russian, with English as the fallback.

## Features

- Sign in to multiple accounts and choose one per agent.
- View usage limits and switch accounts automatically when limits are reached.
- Configure HTTP, HTTPS, or SOCKS5 proxies with optional username and password.
- Test API connectivity without sending subscription credentials.

## Install

Requires Paseo 0.12 or later and the Codex and/or Claude CLI on the daemon host.

```sh
paseo plugin install git:an1creator/zerosub --id zerosub
```

To replace an existing ZeroSub installation, back up your account data, then run `paseo plugin remove zerosub` before installing. The plugin keeps the same ID and account storage; removing its registration does not sign accounts out.

## Use

Open **Accounts** in the sidebar. Use the globe button on an account card to configure its proxy. Restart open chats after changing the proxy or reloading the plugin.

Proxy passwords stay on the host in `$PASEO_HOME/zerosub/proxies.json` with owner-only permissions. A configured proxy has no direct fallback. Browser sign-in, tools, and MCP servers may use their own network settings.

Codex account switches create a continuation chat with the previous conversation’s transcript.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run audit:mobile
paseo plugin install /absolute/path/to/zerosub --id zerosub
paseo plugin reload zerosub
```

Translations: `shared/locales/en.ts` and `shared/locales/ru.ts`. HTTPS proxy tests require OpenSSL.

## License

MIT. Based on [ZeroSub by Kapybara](https://github.com/kapybara-org/zerosub).
