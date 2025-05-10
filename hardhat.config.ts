import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";

import "./task/swap";

const mnemonic: string = vars.get("MNEMONIC");
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    base: {
      url: "https://base-mainnet.g.alchemy.com/v2/ZlzkGJhwX4ik8IQeDXVoM5A3YLbVIMpe",
      accounts: {
        mnemonic,
      },
      chainId: 8453,
    },
    hardhat: {
      accounts: {
        count: 10,
        mnemonic,
      },
      forking: {
        url: "https://base-mainnet.g.alchemy.com/v2/ZlzkGJhwX4ik8IQeDXVoM5A3YLbVIMpe",
      },
      chains: {
        1337: {
          hardforkHistory: {
            london: 2000000,
          },
        },
      },
    },
  },
};

export default config;
