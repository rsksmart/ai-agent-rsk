import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LendingPoolModule", (m) => {
  // 1) Deploy MockUSDT0 with initial supply (1,000,000 USDT0, 6 decimals)
  const initialSupply = m.getParameter("initialSupply", 1_000_000n * 10n ** 6n); // 1M USDT0
  const usdt0 = m.contract("MockUSDT0", [initialSupply]);

  // 2) Deploy UmbrellaOracleAdapter (no constructor args)
  const oracle = m.contract("UmbrellaOracleAdapter");

  // 3) Set prices in oracle (RBTC and USDT0)
  // RBTC price: $65,000 (18 decimals)
  const priceRBTC = m.getParameter("priceRBTC", 65_000n * 10n ** 18n);
  // USDT0 price: $1 (18 decimals)
  const priceUSDT0 = m.getParameter("priceUSDT0", 1n * 10n ** 18n);

  // Set batch prices: address(0) for RBTC, usdt0 address for USDT0
  // setBatch(address[] calldata assets, uint256[] calldata prices)
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  m.call(oracle, "setBatch", [[zeroAddress, usdt0], [priceRBTC, priceUSDT0]]);

  // 4) Deploy LendingPool with LTV = 70% (7000 basis points)
  // constructor(address _usdt0, address _oracle, uint256 _ltvBps)
  const ltvBps = m.getParameter("ltvBps", 7000n);
  const pool = m.contract("LendingPool", [usdt0, oracle, ltvBps]);

  // 5) Seed pool with USDT0 liquidity (100,000 USDT0, 6 decimals)
  const seedAmount = m.getParameter("seedAmount", 100_000n * 10n ** 6n);
  // transfer(address to, uint256 amount)
  m.call(usdt0, "transfer", [pool, seedAmount]);

  return { usdt0, oracle, pool };
});



