/** Stand-in for expo-crypto under Jest, backed by the Web Crypto API. */
export const randomUUID = (): string => globalThis.crypto.randomUUID();

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' } as const;

export async function digestStringAsync(_alg: string, data: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
