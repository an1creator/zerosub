# Accounts for Paseo

Your Claude and ChatGPT accounts in one place. Choose an account for each chat, keep track of limits, and continue on another account when needed.

![Account overview and usage limits](images/1.png)

## What you can do

- **Add multiple accounts** without signing out of your current one.
- **Choose an account per chat** or set a default for new chats.
- **Keep working when limits run out** with automatic account switching.
- **Use a separate proxy for each account** — HTTP, HTTPS, or SOCKS5, with optional login and password.
- **Use English or Russian** — the plugin follows your Paseo language.

## Install

You need Paseo 0.12 or later, with Codex or Claude already set up.

1. Open **Settings → Plugins** and enable plugins.
2. Paste this into the plugin source field:

   ```text
   git:an1creator/zerosub
   ```

3. Install, then open **Accounts** in the sidebar.

Already using ZeroSub? Remove the old plugin entry before installing this version. Keep your accounts — do not delete them from the Accounts screen.

## Choose an account

Click **Add account** and sign in. In a chat, use the account button to switch. Enable **Automatic switching** to let the plugin choose another available account when a limit is reached.

![Choosing an account from a chat](images/3.png)

When switching Codex accounts, your work continues in a new chat with the previous conversation included.

## Set up a proxy

Click the **globe** on an account card. Choose a proxy type, enter the host and port, then add a username and password if required. Click **Test**, then **Save**.

Restart open chats to apply changes. Browser sign-in uses your browser’s connection.

## Credits

Based on [ZeroSub by Kapybara](https://github.com/kapybara-org/zerosub). Screenshots from the original project. MIT license.
