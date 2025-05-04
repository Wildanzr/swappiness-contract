import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";

const mnemonic: string = vars.get("MNEMONIC");
const config: HardhatUserConfig = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        count: 10,
        mnemonic,
      },
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/ZlzkGJhwX4ik8IQeDXVoM5A3YLbVIMpe",
        blockNumber: 22396742,
      },
    },
  },
};

export default config;
