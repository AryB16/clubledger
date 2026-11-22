import { baseSepolia } from 'viem/chains'

// The ONLY place the contract address, chain, RPCs and explorer live (SPEC §3.1).
export const CHAIN = baseSepolia // id 84532
export const CONTRACT_ADDRESS = '0x210312F9C553a02A9864CC9685854A72d49D4F7e' as const
const primary = (import.meta.env?.VITE_RPC_URL as string | undefined)?.trim()
export const RPC_URLS = [...new Set([primary, 'https://sepolia.base.org'].filter((u): u is string => !!u))]
export const EXPLORER = 'https://sepolia.basescan.org'
export const REPO_URL = 'https://github.com/AryB16/clubledger'

export const contractUrl = `${EXPLORER}/address/${CONTRACT_ADDRESS}`
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (addr: string) => `${EXPLORER}/address/${addr}`
