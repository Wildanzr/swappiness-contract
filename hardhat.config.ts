import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";

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
    hardhat: {
      accounts: {
        count: 10,
        mnemonic,
      },
      forking: {
        url: "https://base-mainnet.g.alchemy.com/v2/ZlzkGJhwX4ik8IQeDXVoM5A3YLbVIMpe",
        blockNumber: 29834328,
        // url: "https://eth-mainnet.g.alchemy.com/v2/ZlzkGJhwX4ik8IQeDXVoM5A3YLbVIMpe",
        // blockNumber: 22396742,
      },
    },
  },
};

export default config;
