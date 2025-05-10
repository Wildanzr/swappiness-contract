import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SwappinessModule = buildModule("SwappinessModule", (m) => {
  const swappiness = m.contract("Swappiness", []);

  return { swappiness };
});

export default SwappinessModule;
