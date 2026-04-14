import { cookieStorage, createStorage, http, type Storage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { rootstock, rootstockTestnet } from "./chains";


export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || "";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const networks = [rootstockTestnet, rootstock] as [AppKitNetwork, ...AppKitNetwork[]];


export const wagmiAdapter = new WagmiAdapter({
  chains: [rootstockTestnet, rootstock],
  transports: {
    [rootstockTestnet.id]: http(),
    [rootstock.id]: http(),
  },
  storage: createStorage({ storage: cookieStorage }) as Storage,
  ssr: true,
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;