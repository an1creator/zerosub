import type { StateView } from "./model";
/** Translate plugin-owned diagnostics; preserve unknown provider errors verbatim. */
const messages: Record<string, string> = {
  "That account no longer exists.": "Аккаунт больше не существует.",
  "That agent is no longer available.": "Агент больше недоступен.",
  "That account can't be used with this agent.": "Этот аккаунт нельзя использовать для данного агента.",
  "This agent is working right now. Wait for its turn to finish, then switch.": "Агент сейчас работает. Дождитесь завершения ответа перед переключением.",
  "This agent is working right now. Wait for its turn to finish, then continue it elsewhere.": "Агент сейчас работает. Дождитесь завершения ответа перед переносом.",
  "This sign-in has expired. Start again.": "Срок ожидания входа истёк. Начните заново.",
  "This sign-in has ended. Start again.": "Вход завершён. Начните заново.",
  "Sign-in was canceled.": "Вход отменён.",
  "Sign-in did not finish.": "Вход не завершён.",
  "Sign-in timed out or was closed. Try again.": "Время ожидания входа истекло или окно было закрыто. Повторите попытку.",
  "Sign-in finished, but the account isn't signed in. Try again.": "Вход завершился без авторизации аккаунта. Повторите попытку.",
  "Codex stopped before sign-in finished.": "Codex остановился до завершения входа.",
  "ChatGPT sign-in doesn't use a pasted code. Finish on the sign-in page.": "Завершите вход на странице ChatGPT: вставлять код в это окно не нужно.",
  "If the page says device codes are off, turn on “device code login” in ChatGPT → Settings → Security, or use the browser option.": "Если вход по коду отключён, включите его в ChatGPT → Настройки → Безопасность или войдите через браузер.",
  "Device-code sign-in is turned off for this ChatGPT account. Turn on “device code login” in ChatGPT → Settings → Security, or sign in with the browser option.": "Для этого аккаунта отключён вход по коду. Включите его в ChatGPT → Настройки → Безопасность или войдите через браузер.",
  "Checking the code…": "Проверка кода…",
  "Paste the code from the sign-in page.": "Вставьте код со страницы входа.",
  "That code didn't work. Copy the whole code from the page and paste it again.": "Код не подошёл. Скопируйте его целиком со страницы и вставьте заново.",
  "No banked resets left on this account.": "У аккаунта не осталось запасных сбросов.",
  "Nothing to reset: this account's limits aren't used up, so the reset was kept.": "Лимиты ещё не исчерпаны. Запасной сброс сохранён.",
  "A reset was just used on this account.": "Для этого аккаунта только что использован сброс.",
  "Codex sent an unexpected reply. Refresh usage before trying again.": "Codex вернул неожиданный ответ. Обновите лимиты перед повторной попыткой.",
  "Too many attempts. Wait a minute and try again.": "Слишком много попыток. Подождите минуту и попробуйте снова.",
  "Couldn't use this account's sign-in. Sign it in again, then retry.": "Авторизация недоступна. Войдите в аккаунт заново и повторите попытку.",
  "Claude rejected this account's sign-in. Sign it in again, then retry.": "Claude отклонил авторизацию. Войдите заново и повторите попытку.",
  "The reset can't be used right now.": "Сейчас нельзя использовать этот сброс.",
  "Claude says this account has room again, so the reset was kept.": "Лимит аккаунта уже доступен. Запасной сброс сохранён.",
};
export function localizeMessage(message: string): string {
  if (messages[message]) return messages[message];
  return message
    .replace(/^(.+) is signed out\. Sign it in first\.$/, "$1: сначала войдите в аккаунт.")
    .replace(/^(.+) is disabled\. Enable it in Accounts first\.$/, "$1: включите аккаунт в разделе «Аккаунты».")
    .replace(/^(.+) is disabled\. Enable it before making it the default\.$/, "$1: сначала включите аккаунт.")
    .replace(/^(.+) isn't installed on the daemon machine\.$/, "$1 не установлен на хосте Paseo.")
    .replace(/^Codex usage limits reset(.*)\.$/, "Лимиты Codex сброшены$1.")
    .replace(/^That reset was already used(.*)\.$/, "Этот сброс уже использован$1.")
    .replace(/ · (\d+) left(?=\.|$)/, " · осталось: $1");
}

export function localizeState(state: StateView): StateView {
  return { ...state,
            warnings: state.warnings.map(localizeMessage),
            logins: state.logins.map((login) => ({ ...login, message: login.message ? localizeMessage(login.message) : null })),
            accounts: state.accounts.map((account) => ({ ...account, usage: account.usage ? { ...account.usage,
              error: account.usage.error ? localizeMessage(account.usage.error) : null,
              resets: account.usage.resets ? { ...account.usage.resets, blockedReason: account.usage.resets.blockedReason ? localizeMessage(account.usage.resets.blockedReason) : null } : null,
            } : null })),
          };
}
