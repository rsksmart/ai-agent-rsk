import { cookieStorage, createStorage, http } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { rootstock, rootstockTestnet } from './chains'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || ""

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [rootstockTestnet, rootstock] as [AppKitNetwork, ...AppKitNetwork[]]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  chains: [rootstockTestnet, rootstock],
  transports: {
    [rootstockTestnet.id]: http(), 
    [rootstock.id]: http(), 
  },
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig