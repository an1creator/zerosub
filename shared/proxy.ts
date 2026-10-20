import { z } from "zod";

export const ProxyFieldsSchema = z.object({
  type: z.enum(["http", "https", "socks5"]),
  host: z.string().trim().min(1).max(253).refine(
    (host) => !/[\s/@?#\\]/.test(host) && (!host.includes(":") || /^\[[0-9a-fA-F:]+\]$/.test(host)),
    "Укажите имя сервера или IP без схемы и порта; IPv6 — в квадратных скобках.",
  ),
  port: z.number().int().min(1).max(65535),
  username: z.string().max(255).default(""),
});
export const ProxyInputSchema = ProxyFieldsSchema.extend({
  // undefined keeps the existing password; empty string explicitly removes it.
  password: z.string().max(255).optional(),
});
export const ProxyStoredSchema = ProxyFieldsSchema.extend({ password: z.string().max(255).default("") });
export const ProxyViewSchema = ProxyFieldsSchema.extend({ hasPassword: z.boolean() });
export type ProxyInput = z.input<typeof ProxyInputSchema>;
export type ProxyConfig = z.output<typeof ProxyStoredSchema>;
export type ProxyView = z.output<typeof ProxyViewSchema>;
export function proxyView(config: ProxyConfig | null): ProxyView | null {
  if (!config) return null;
  const { password, ...fields } = config;
  return { ...fields, hasPassword: Boolean(password) };
}
