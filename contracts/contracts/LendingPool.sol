// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title Minimal LendingPool (RBTC collateral, borrow USDT0)
/// @notice Educational boilerplate for quick experiments. NOT AUDITED. DO NOT USE IN PRODUCTION.
contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Address(0) used to query the oracle for native RBTC price.
    address public constant RBTC_ASSET = address(0);

    IERC20 public immutable usdt0;
    IPriceOracle public oracle;

    uint256 public immutable USDT0_SCALE; // 10 ** usdt0Decimals
    uint256 public ltvBps; // Loan To Value in basis points. e.g. 7000 = 70%

    mapping(address => uint256) public collateralRBTC; // in wei (1e18)
    mapping(address => uint256) public debtUSDT0;      // in USDT0 smallest units (e.g., 6 decimals)

    event Deposited(address indexed user, uint256 rbtcAmount);
    event Borrowed(address indexed user, uint256 usdt0Amount);
    event Repaid(address indexed user, uint256 usdt0Amount);
    event Withdrawn(address indexed user, uint256 rbtcAmount);
    event OracleUpdated(address indexed newOracle);
    event LtvUpdated(uint256 newLtvBps);

    constructor(address _usdt0, address _oracle, uint256 _ltvBps) Ownable(msg.sender) {
        require(_usdt0 != address(0), "USDT0_0");
        require(_oracle != address(0), "ORACLE_0");
        require(_ltvBps > 0 && _ltvBps <= 9500, "LTV_RANGE");

        usdt0 = IERC20(_usdt0);
        oracle = IPriceOracle(_oracle);
        ltvBps = _ltvBps;

        uint8 d = IERC20Metadata(_usdt0).decimals();
        USDT0_SCALE = 10 ** uint256(d);
    }

    // ---------------------------- Admin ----------------------------

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "ORACLE_0");
        oracle = IPriceOracle(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setLtvBps(uint256 _ltvBps) external onlyOwner {
        require(_ltvBps > 0 && _ltvBps <= 9500, "LTV_RANGE");
        ltvBps = _ltvBps;
        emit LtvUpdated(_ltvBps);
    }

    // ------------------------- User actions ------------------------

    /// @notice Deposit native RBTC as collateral.
    function depositRBTC() external payable nonReentrant {
        require(msg.value > 0, "ZERO_DEPOSIT");
        collateralRBTC[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Withdraw native RBTC collateral if solvency holds after withdrawal.
    function withdrawRBTC(uint256 amountWei) external nonReentrant {
        require(amountWei > 0, "ZERO_WITHDRAW");
        uint256 current = collateralRBTC[msg.sender];
        require(amountWei <= current, "INSUFFICIENT_COLLATERAL_BAL");

        uint256 newColl = current - amountWei;
        require(_isSolvent(newColl, debtUSDT0[msg.sender]), "HF_LT_1");

        collateralRBTC[msg.sender] = newColl;

        (bool ok, ) = msg.sender.call{value: amountWei}("");
        require(ok, "SEND_FAILED");
        emit Withdrawn(msg.sender, amountWei);
    }

    /// @notice Borrow USDT0 against deposited RBTC.
    function borrowUSDT0(uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO_BORROW");
        uint256 newDebt = debtUSDT0[msg.sender] + amount;
        require(_isSolvent(collateralRBTC[msg.sender], newDebt), "INSUFFICIENT_COLLATERAL");

        debtUSDT0[msg.sender] = newDebt;
        usdt0.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Repay USDT0 debt (needs prior approval).
    function repayUSDT0(uint256 amount) external nonReentrant {
        uint256 debt = debtUSDT0[msg.sender];
        require(debt > 0, "NO_DEBT");

        uint256 pay = amount > debt ? debt : amount;
        require(pay > 0, "ZERO_REPAY");

        usdt0.safeTransferFrom(msg.sender, address(this), pay);
        debtUSDT0[msg.sender] = debt - pay;
        emit Repaid(msg.sender, pay);
    }

    // ------------------------- View helpers ------------------------

    function collateralUsdE18(address user) public view returns (uint256) {
        if (collateralRBTC[user] == 0) return 0;
        uint256 pRBTC = oracle.getPrice(RBTC_ASSET); // USD per RBTC (1e18)
        // collateralRBTC has 18 decimals, priceE18 has 18 decimals => USD value (1e18)
        return (collateralRBTC[user] * pRBTC) / 1e18;
    }

    function debtUsdE18(address user) public view returns (uint256) {
        if (debtUSDT0[user] == 0) return 0;
        uint256 pUSDT0 = oracle.getPrice(address(usdt0)); // USD per USDT0 (1e18, typically 1e18)
        // debt has USDT0 decimals; normalize to 1e18
        return (debtUSDT0[user] * pUSDT0) / USDT0_SCALE;
    }

    function maxBorrowableUsdE18(address user) public view returns (uint256) {
        return (collateralUsdE18(user) * ltvBps) / 10_000;
    }

    /// @notice Health factor in 1e18. >1e18 means solvent.
    function healthFactorE18(address user) public view returns (uint256) {
        uint256 debtUsd = debtUsdE18(user);
        if (debtUsd == 0) return type(uint256).max;
        uint256 maxDebtUsd = maxBorrowableUsdE18(user);
        return (maxDebtUsd * 1e18) / debtUsd;
    }

    /// @notice Account snapshot for quick demos.
    function getAccountData(address user)
        external
        view
        returns (
            uint256 collRbtcWei,
            uint256 debtUsdt0,
            uint256 collUsdE18,
            uint256 debtUsdE18_,
            uint256 maxDebtUsdE18_,
            uint256 healthFactorE18_
        )
    {
        collRbtcWei = collateralRBTC[user];
        debtUsdt0 = debtUSDT0[user];
        collUsdE18 = collateralUsdE18(user);
        debtUsdE18_ = debtUsdE18(user);
        maxDebtUsdE18_ = maxBorrowableUsdE18(user);
        healthFactorE18_ = healthFactorE18(user);
    }

    // ------------------------- Internal ----------------------------

    function _isSolvent(uint256 collWei, uint256 debtUsdt0_) internal view returns (bool) {
        uint256 pRBTC = oracle.getPrice(RBTC_ASSET);
        uint256 pUSDT0 = oracle.getPrice(address(usdt0));
        uint256 collUsd = (collWei * pRBTC) / 1e18;
        uint256 debtUsd = (debtUsdt0_ * pUSDT0) / USDT0_SCALE;
        uint256 maxDebtUsd = (collUsd * ltvBps) / 10_000;
        return debtUsd <= maxDebtUsd;
    }

    // Accept native RBTC
    receive() external payable {
        revert("DIRECT_PAY_NOT_ALLOWED");
    }
}
