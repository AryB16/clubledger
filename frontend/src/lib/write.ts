// The write flow: simulate first → refusal card on revert → otherwise send, wait, invalidate.
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useConnection, useWalletClient } from 'wagmi'
import type { Hash } from 'viem'
import { CLUBLEDGER_ABI } from '../abi/abi'
import { CHAIN, CONTRACT_ADDRESS } from '../config'
import { publicClient } from './client'
import { classifyError } from './refusals'

export type Call =
  | { functionName: 'postEntry'; args: readonly [number, bigint, string, string, string, string] }
  | { functionName: 'correctEntry'; args: readonly [bigint, bigint, string, string, string, string] }
  | { functionName: 'authorizePoster'; args: readonly [`0x${string}`, string] }
  | { functionName: 'revokePoster'; args: readonly [`0x${string}`] }

export type Toast = { text: string; href?: string; tone: 'info' | 'ok' | 'bad' }

export type WriteState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'refused'; reason: string; call: Call; forced?: { status: 'sending' | 'done'; hash?: Hash; error?: string } }
  | { phase: 'sending' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; hash: Hash }

export function useWriteFlow(onToast: (t: Toast | null) => void) {
  const { address } = useConnection()
  const { data: walletClient } = useWalletClient()
  const qc = useQueryClient()
  const [state, setState] = useState<WriteState>({ phase: 'idle' })

  const base = { address: CONTRACT_ADDRESS, abi: CLUBLEDGER_ABI } as const

  async function send(call: Call, gas?: bigint): Promise<{ hash: Hash; ok: boolean }> {
    if (!walletClient || !address) throw new Error('Not connected')
    const hash = await walletClient.writeContract({
      ...base,
      ...(call as { functionName: 'postEntry'; args: readonly [number, bigint, string, string, string, string] }),
      account: address,
      chain: CHAIN,
      ...(gas ? { gas } : {}),
    })
    onToast({ text: 'Recording…', tone: 'info' })
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
    await qc.invalidateQueries()
    return { hash, ok: receipt.status === 'success' }
  }

  /** Simulate; if the rulebook refuses, show the refusal card. Otherwise send for real. */
  async function submit(call: Call): Promise<boolean> {
    if (!address) return false
    setState({ phase: 'checking' })
    onToast(null)
    try {
      await publicClient.simulateContract({ ...base, ...(call as { functionName: "postEntry"; args: readonly [number, bigint, string, string, string, string] }), account: address })
    } catch (err) {
      const c = classifyError(err)
      if (c.kind === 'refused' && c.reason) setState({ phase: 'refused', reason: c.reason, call })
      else setState({ phase: 'error', message: c.message })
      return false
    }
    try {
      setState({ phase: 'sending' })
      const { hash, ok } = await send(call)
      if (ok) {
        setState({ phase: 'done', hash })
        onToast({ text: 'Recorded. View public proof', href: hash, tone: 'ok' })
        return true
      }
      setState({ phase: 'error', message: 'The rulebook refused this when it arrived. Nothing was recorded.' })
      onToast(null)
      return false
    } catch (err) {
      const c = classifyError(err)
      onToast(null)
      if (c.kind === 'refused' && c.reason) setState({ phase: 'refused', reason: c.reason, call })
      else setState({ phase: 'error', message: c.message })
      return false
    }
  }

  /** ?demo=1 only: broadcast the refused call with a fixed gas limit so it fails on the public record. */
  async function sendAnyway() {
    if (state.phase !== 'refused') return
    const { reason, call } = state
    setState({ phase: 'refused', reason, call, forced: { status: 'sending' } })
    try {
      const { hash } = await send(call, 300000n)
      onToast(null)
      setState({ phase: 'refused', reason, call, forced: { status: 'done', hash } })
    } catch (err) {
      onToast(null)
      setState({ phase: 'refused', reason, call, forced: { status: 'done', error: classifyError(err).message } })
    }
  }

  return { state, submit, sendAnyway, reset: () => setState({ phase: 'idle' }) }
}
