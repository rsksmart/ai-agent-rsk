import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidWalletAddress(address: string): boolean {
	const regex = /^(0x)?[0-9a-fA-F]{40}$/;

	return regex.test(address);
}

type TokenSearchCacheEntry = { address: string | null; expiresAtMs: number };
const tokenSearchCache = new Map<string, TokenSearchCacheEntry>();

export async function findToken(query: string): Promise<string | null> {
	try {
		const tokenLowerCase = query.toLowerCase();
		const cacheKey = tokenLowerCase;
		const now = Date.now();
		const cached = tokenSearchCache.get(cacheKey);
		if (cached && cached.expiresAtMs > now) {
			return cached.address;
		}

		// Secure-by-default: prefer an explicit allowlist for token resolution.
		// If allowlist is present and doesn't contain the token, we refuse to fall back to explorer search
		// unless explicitly enabled (unsafe).
		const allowlistRaw = process.env.NEXT_PUBLIC_TOKEN_ADDRESS_ALLOWLIST_JSON?.trim();
		if (allowlistRaw) {
			try {
				const parsed = JSON.parse(allowlistRaw) as unknown;
				if (parsed && typeof parsed === "object") {
					const record = parsed as Record<string, unknown>;
					const v = record[tokenLowerCase] ?? record[tokenLowerCase.toUpperCase()] ?? record[query] ?? record[query.toUpperCase()];
					const addr = typeof v === "string" ? v : null;
					const normalized = addr && isValidWalletAddress(addr) ? addr : null;
					// Cache both hits and misses when allowlist is configured.
					tokenSearchCache.set(cacheKey, { address: normalized, expiresAtMs: now + 5 * 60_000 });
					return normalized;
				}
			} catch {
				// If allowlist is malformed, treat as not configured and continue below.
			}
		}

		const allowUnsafeDiscovery = process.env.NEXT_PUBLIC_ALLOW_UNSAFE_TOKEN_DISCOVERY === "true";
		if (!allowUnsafeDiscovery) {
			// No allowlist match, and unsafe discovery disabled: refuse untrusted external resolution.
			tokenSearchCache.set(cacheKey, { address: null, expiresAtMs: now + 60_000 });
			return null;
		}

		const defaultBaseUrl = "https://rootstock-testnet.blockscout.com";
		const rawBaseUrl = process.env.NEXT_PUBLIC_BLOCKSCOUT_API_BASE_URL?.trim();
		let baseUrl = defaultBaseUrl;
		if (rawBaseUrl) {
			const allowUnsafe = process.env.NEXT_PUBLIC_ALLOW_UNSAFE_BLOCKSCOUT_URL === "true";
			try {
				const u = new URL(rawBaseUrl);
				const allowedHosts = new Set([
					"rootstock-testnet.blockscout.com",
					"rootstock.blockscout.com",
				]);
				if (!allowUnsafe && (u.protocol !== "https:" || !allowedHosts.has(u.hostname))) {
					baseUrl = defaultBaseUrl;
				} else {
					baseUrl = `${u.protocol}//${u.host}`;
				}
			} catch {
				baseUrl = defaultBaseUrl;
			}
		}

		const response = await fetch(
			`${baseUrl}/api/v2/tokens?q=${encodeURIComponent(tokenLowerCase)}&type=ERC-20`,
			{ headers: { accept: "application/json" } }
		);

		if (!response.ok) {
			throw new Error(`API call failed with status: ${response.status}`);
		}

		const data = await response.json();

		if (data.items && data.items.length > 0) {
			const address = typeof data.items[0]?.address === "string" ? data.items[0].address : null;
			const normalized = address && isValidWalletAddress(address) ? address : null;
			tokenSearchCache.set(cacheKey, { address: normalized, expiresAtMs: now + 5 * 60_000 });
			return normalized;
		}

		tokenSearchCache.set(cacheKey, { address: null, expiresAtMs: now + 60_000 });
		return null;
	} catch {
		return null;
	}
}