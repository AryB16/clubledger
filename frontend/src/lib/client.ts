import { createPublicClient, fallback, http } from 'viem'
import { CHAIN, RPC_URLS } from '../config'

/** Public, wallet-free reads. Tries each validated RPC in order. */
export const transport = fallback(RPC_URLS.map((u) => http(u, { timeout: 12_000, retryCount: 1 })))

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport,
  batch: { multicall: true },
})
