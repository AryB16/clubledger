import { createConfig, injected } from 'wagmi'
import { CHAIN } from './config'
import { transport } from './lib/client'

// Connector: injected() only (MetaMask). No RainbowKit, no WalletConnect.
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  multiInjectedProviderDiscovery: false,
  transports: { [CHAIN.id]: transport },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
