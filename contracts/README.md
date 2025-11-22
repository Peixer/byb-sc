# BuildingToken - Real Estate Construction RWA Protocol

## Overview

The BuildingToken contract represents fractional ownership of a single building in a Real Estate Construction RWA (Real World Asset) protocol. Each building has its own token deployment, enabling investors to own fractions of specific real estate projects.

## Architecture

### Core Contracts

1. **IBuildingRegistry.sol** - Interface for the BuildingRegistry contract
   - Defines the structure for building information
   - Includes building status (Planning, UnderConstruction, Completed, Cancelled)
   - Supports milestone tracking for construction progress

2. **BuildingToken.sol** - Main ERC20 token contract
   - Implements fractional ownership through ERC20 standard
   - Links to a specific building in the BuildingRegistry
   - Includes optional transfer restrictions for regulatory compliance

3. **MockBuildingRegistry.sol** - Mock implementation for testing
   - Used for testing and development purposes

## BuildingToken Features

### Fractional Ownership
- Each token represents a fractional share of a specific building
- Immutable `buildingId` links the token to building data
- Standard ERC20 functionality (18 decimals by default)

### Building Information Access
- `getBuildingInfo()` retrieves real-time building data from the registry:
  - Building name
  - Metadata URI (IPFS or other storage)
  - Developer address
  - Construction status
  - Milestone information

### Transfer Restrictions (Optional)
For regulatory compliance, the contract supports restricting token transfers:

- **Transfer Restriction Flag**: Can be enabled/disabled by the owner
- **Whitelist System**: When restrictions are active, only whitelisted addresses can transfer tokens
- **Flexible Control**: Owner can add/remove addresses from the whitelist
- **Minting/Burning**: Always allowed regardless of restrictions

### Events
- `TransfersRestricted(bool restricted)` - Emitted when transfer restrictions change
- `WhitelistUpdated(address indexed account, bool allowed)` - Emitted when whitelist changes

## Deployment

### Constructor Parameters

```solidity
constructor(
    string memory name_,           // e.g., "Tower A Token"
    string memory symbol_,         // e.g., "TWRA"
    uint256 totalSupply_,          // Total tokens to mint (e.g., 1000000 * 10**18)
    uint256 buildingId_,           // ID from BuildingRegistry
    address registryAddress_,      // Address of BuildingRegistry contract
    address initialOwner_          // Address to receive tokens and contract ownership
)
```

### Example Deployment

```solidity
// Deploy BuildingRegistry first
BuildingRegistry registry = new BuildingRegistry();

// Register a building
registry.registerBuilding(1, "Tower A", "ipfs://...", developer, BuildingStatus.UnderConstruction);

// Deploy token for building #1
BuildingToken token = new BuildingToken(
    "Tower A Token",
    "TWRA",
    1000000 * 10**18,  // 1 million tokens
    1,                  // buildingId
    address(registry),
    owner
);
```

## Usage Examples

### Basic Token Operations

```solidity
// Transfer tokens (when not restricted)
token.transfer(recipient, amount);

// Check building information
(string memory name, , , , ) = token.getBuildingInfo();
```

### Managing Transfer Restrictions

```solidity
// Enable transfer restrictions (owner only)
token.setTransfersRestricted(true);

// Whitelist addresses (owner only)
token.updateWhitelist(investor1, true);
token.updateWhitelist(investor2, true);

// Now only whitelisted addresses can transfer
```

## Security Features

1. **Immutable References**: buildingId and buildingRegistry cannot be changed after deployment
2. **Access Control**: Uses OpenZeppelin Ownable for admin functions
3. **Input Validation**: Checks for zero addresses and invalid parameters
4. **Standard Compliance**: Fully ERC20 compliant for compatibility with wallets and exchanges

## Testing

The project includes comprehensive test coverage in `BuildingToken.t.sol`:

- Initial supply and ownership
- Building information retrieval
- Transfer restriction mechanisms
- Whitelist management
- Edge cases and error conditions

Run tests with:
```bash
npx hardhat test
```

Or to run only Solidity tests:
```bash
npx hardhat test solidity
```

## Integration

### For Developers

1. Deploy a BuildingRegistry contract for your platform
2. Register buildings in the registry
3. Deploy a BuildingToken for each building
4. Distribute tokens to investors
5. Optionally enable transfer restrictions for compliance

### For Frontend/DApp Integration

The contract is fully ERC20 compliant and can be integrated with standard Ethereum tools:
- Web3.js / Ethers.js
- MetaMask and other wallets
- Uniswap and other DEXs (if transfers unrestricted)
- Block explorers

## License

MIT License

## Dependencies

- OpenZeppelin Contracts v5.4.0
  - ERC20: Token standard implementation
  - Ownable: Access control
- Solidity ^0.8.20 (compatible with 0.8.28 and other versions >= 0.8.20)

**Note on Solidity Version**: The contracts use `pragma solidity ^0.8.20;` which means they are compatible with any compiler version from 0.8.20 onwards. This provides maximum compatibility while ensuring access to necessary features. The project's Hardhat configuration may use a specific version (e.g., 0.8.28) which is fully compatible.
