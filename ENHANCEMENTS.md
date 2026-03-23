# OptionsVault Enhancement Roadmap

> **Hackathon Status**: ✅ Ready for demo
> Current implementation covers core functionality. Items below are post-hackathon improvements.

---

## Critical Security (Post-Hackathon)

### 1. Upgradeability Pattern
```solidity
// Add UUPS proxy for bug fixes post-deployment
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
```
**Why**: Can't fix bugs or add features without redeploying and migrating state.

### 2. Fix `receive()` Stuck Funds Risk
```solidity
// Current: accepts HBAR without tracking
receive() external payable {}

// Fix: reject or track
receive() external payable {
    revert("Use depositHBAR()");
}
```

### 3. Separate Writer/Buyer Model
```solidity
// Current: msg.sender is both writer AND buyer
// Fix: Add buyer parameter to writeOption
function writeOption(WriteParams calldata wp, uint256 maxPremium, address buyer) external payable;
```

### 4. Enforce European Exercise Style
```solidity
function exercise(uint256 tokenId, bytes[] calldata pythUpdateData) external payable {
    Position storage pos = positions[tokenId];
    // Add: European options only exercisable at expiry
    require(block.timestamp >= pos.expiry, "Option not yet exercisable");
    // ...
}
```

---

## Risk Management

### 5. Circuit Breakers
```solidity
uint256 public constant MAX_IV_WAD = 3e18;      // 300% IV cap
uint256 public constant MIN_IV_WAD = 0.05e18;  // 5% IV floor
uint256 public constant MAX_PRICE_CHANGE = 0.5e18; // 50% max price move

error IVOutOfBounds(uint256 sigma);
error PriceMoveTooLarge(uint256 oldPrice, uint256 newPrice);
```

### 6. Position & Exposure Limits
```solidity
uint256 public maxPositionSizeWad = 100_000e18;  // Max 100k per position
uint256 public maxTotalExposureWad;               // Total vault exposure cap
mapping(address => uint256) public writerExposure;

error PositionTooLarge(uint256 size, uint256 max);
error ExposureLimitReached(uint256 current, uint256 max);
```

### 7. Minimum Premium
```solidity
uint256 public minPremiumWad = 0.001e18;  // Prevent dust/spam options

error PremiumTooLow(uint256 premium, uint256 minimum);
```

---

## Access Control

### 8. Role-Based Permissions
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER");
bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER");
```

### 9. Timelock for Admin Functions
```solidity
import "@openzeppelin/contracts/governance/TimelockController.sol";

// Critical changes (fee updates, pause) require 24h delay
uint256 public constant TIMELOCK_DELAY = 24 hours;
```

---

## Missing Features

### 10. Emergency Withdrawal
```solidity
function emergencyWithdrawAll(address token) external onlyOwner whenPaused {
    // Return all unlocked collateral to writers
    // Only callable when paused
}
```

### 11. Liquidation Mechanism
```solidity
function liquidate(uint256 tokenId) external {
    Position storage pos = positions[tokenId];
    uint256 currentCollateralValue = _getCollateralValue(pos);
    require(currentCollateralValue < pos.collateralWad * 80 / 100, "Not undercollateralized");
    // Liquidate position, reward caller
}
```

### 12. Batch Operations
```solidity
function batchDeposit(address[] calldata tokens, uint256[] calldata amounts) external payable;
function batchWithdraw(address[] calldata tokens, uint256[] calldata amounts) external;
```

---

## View Functions

### 13. Analytics & Frontend Support
```solidity
function getActivePositionsByWriter(address writer) external view returns (uint256[] memory);
function getTotalValueLocked(address token) external view returns (uint256);
function getOpenInterest(string calldata symbol) external view returns (uint256 calls, uint256 puts);
function getWriterPositions(address writer) external view returns (Position[] memory);
```

---

## Gas Optimization

### 14. Use bytes32 for Symbols
```solidity
// Current (expensive):
string symbol;

// Optimized:
bytes32 symbol;  // Fixed size, cheaper storage
```

### 15. Pack Structs
```solidity
// Reorder Position struct fields for optimal packing
struct Position {
    uint128 strikeWad;      // Slot 1
    uint128 sizeWad;        // Slot 1
    uint64  expiry;         // Slot 2
    uint64  createdAt;      // Slot 2
    // ... etc
}
```

---

## Hedera-Specific

### 16. HTS Native Token Support
```solidity
// Use Hedera Token Service for option NFTs instead of ERC-721
// Lower fees, native Hedera integration
```

### 17. Fallback for HIP-1215
```solidity
// If HSS scheduling fails, allow keeper-based expiry
mapping(uint256 => bool) public needsManualExpiry;
```

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Fix receive() | Low | High |
| 🔴 P0 | European exercise check | Low | High |
| 🟠 P1 | Separate writer/buyer | Medium | High |
| 🟠 P1 | IV bounds | Low | Medium |
| 🟠 P1 | Position limits | Low | Medium |
| 🟡 P2 | UUPS upgrade | High | High |
| 🟡 P2 | Role-based access | Medium | Medium |
| 🟢 P3 | Batch operations | Medium | Low |
| 🟢 P3 | bytes32 symbols | Low | Low |

---

## Hackathon Scope

**In Scope (Done):**
- ✅ HBAR collateral deposit/withdraw
- ✅ Covered calls & cash-secured puts
- ✅ Black-Scholes pricing
- ✅ Pyth oracle integration
- ✅ Option NFT minting
- ✅ Exercise & settlement
- ✅ HIP-1215 auto-expiry scheduling
- ✅ Tinybar/WAD unit conversion

**Out of Scope (Post-Hackathon):**
- ❌ Production security hardening
- ❌ Multi-sig / governance
- ❌ Liquidation engine
- ❌ American-style options
- ❌ Multi-asset collateral pools
