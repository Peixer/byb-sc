# 🏗️ Real Estate Construction RWA Protocol

<div align="center">
  <h1 align="center">Building Tokenization Platform</h1> 
  <h3>◦ Tokenize real estate construction projects. Enable fractional ownership, manage sales, and track construction milestones on-chain.</h3>
</div>

> **A comprehensive smart contract system for real estate construction tokenization with escrow management and milestone-based fund releases**

Built with **Hardhat 3 Beta**, TypeScript, and OpenZeppelin security standards.

## 🎯 Project Overview

The **Real Estate Construction RWA Protocol** is a production-ready smart contract system that enables fractional ownership of real estate construction projects through ERC20 tokens. The protocol manages the complete lifecycle from building registration to token sales, escrow management, and milestone-based fund releases.

### ✨ Key Features

- **🏢 Building Registry**: On-chain registry for managing construction projects with status tracking
- **🪙 Fractional Ownership**: ERC20 tokens representing fractional shares of specific buildings
- **🏭 Token Factory**: Automated deployment of unique tokens for each building
- **💰 Sale Management**: Complete token sale system with dynamic pricing and USDC integration
- **🔒 Escrow System**: Secure milestone-based fund release mechanism for construction projects
- **📊 Milestone Tracking**: On-chain construction progress tracking with milestone verification
- **🛡️ Security First**: Built with OpenZeppelin contracts and comprehensive access controls
- **🧪 Fully Tested**: Complete test suite covering all contract functionality

## 🏗️ Contract Architecture

### Core Contracts

| Contract | Purpose | Key Features |
|----------|---------|--------------|
| `BuildingRegistry` | Central registry for buildings | Status management, milestone tracking, admin controls |
| `BuildingToken` | ERC20 fractional ownership tokens | Transfer restrictions, building data access |
| `BuildingTokenFactory` | Automated token deployment | One token per building, registry integration |
| `BuildingSaleManager` | Token sale management | Dynamic pricing, USDC payments, sale lifecycle |
| `EscrowManager` | Construction fund escrow | Milestone-based releases, developer payments |

### Security Features

- **Access Control**: OpenZeppelin Ownable for admin functions
- **Reentrancy Protection**: ReentrancyGuard on critical functions
- **Input Validation**: Comprehensive parameter validation
- **Safe Token Operations**: Standard ERC20 compliance
- **Event Logging**: Complete transaction audit trail
- **Immutable References**: Critical addresses cannot be changed after deployment

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Hardhat 3 Beta
- TypeScript
- Ethereum wallet with testnet funds (for deployment)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd byb-sc

# Install dependencies
npm install

# Compile contracts
npx hardhat compile
```

### Testing

```bash
# Run all tests
npx hardhat test

# Run specific test suites
npx hardhat test test/BuildingRegistry.ts
npx hardhat test test/BuildingSaleManager.ts
npx hardhat test test/BuildingTokenFactory.ts
npx hardhat test test/EscrowManager.ts

# Run only Solidity tests
npx hardhat test solidity

# Run only TypeScript/Node.js tests
npx hardhat test nodejs
```

## 📋 Usage Examples

### 1. Deploy the Protocol

```typescript
// Deploy all contracts using the deployment script
npx hardhat run scripts/deploy-all.ts --network localhost
```

### 2. Register a Building

```typescript
// Register a new building in the registry
await buildingRegistry.createBuilding(
  "Tower A",                    // Building name
  "ipfs://...",                 // Metadata URI
  developerAddress,             // Developer address
  oracleAddress,                // Oracle address (for price updates)
  5                             // Total milestones
);
```

### 3. Deploy Token for Building

```typescript
// Create a token for the building via factory
await buildingTokenFactory.createToken(
  buildingId,                   // Building ID from registry
  "Tower A Token",              // Token name
  "TWRA",                       // Token symbol
  parseEther("1000000"),        // Total supply (1M tokens)
  treasuryAddress               // Initial owner/treasury
);
```

### 4. Configure and Open Sale

```typescript
// Configure sale parameters
await buildingSaleManager.configureSale(
  buildingId,
  tokenAddress,
  usdcAddress,
  parseUnits("100", 6),         // Price: 100 USDC per token
  parseEther("500000")          // Max tokens for sale (500K)
);

// Publish the sale
await buildingSaleManager.publishSale(buildingId);

// Open the sale for purchases
await buildingSaleManager.openSale(buildingId);
```

### 5. Purchase Tokens

```typescript
// Approve USDC spending
await usdc.write.approve([
  buildingSaleManagerAddress,
  parseUnits("10000", 6)        // 10,000 USDC
]);

// Purchase tokens
await buildingSaleManager.write.purchaseTokens([
  buildingId,
  parseEther("100")             // Purchase 100 tokens
]);
```

### 6. Setup Escrow and Release Funds

```typescript
// Setup escrow for a building
await escrowManager.setupEscrow(
  buildingId,
  developerAddress,
  [2000000, 3000000, 5000000],  // Release amounts per milestone (USDC)
  3                              // Total milestones
);

// Release funds for completed milestone (oracle/owner only)
await escrowManager.releaseFunds(buildingId, 0); // Release for milestone 0
```

## 🌐 Deployment

### Local Development

```bash
# Deploy to local Hardhat network
npx hardhat run scripts/deploy-all.ts --network localhost
```

### Testnet Deployment

```bash
# Set your private key for deployment
npx hardhat keystore set SEPOLIA_PRIVATE_KEY

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy-all.ts --network sepolia
```

### Production Deployment

1. Update deployment scripts with production addresses (USDC, etc.)
2. Deploy using Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/YourModule.ts --network mainnet
```

## 🔧 Configuration

### Environment Variables

```bash
# Set your private key for deployment
npx hardhat keystore set SEPOLIA_PRIVATE_KEY

# Or use environment variables
export SEPOLIA_PRIVATE_KEY=your_private_key_here
```

### Contract Configuration

Key addresses to configure:
- **USDC Token**: Update in deployment scripts
- **Oracle Addresses**: Set per building for price updates
- **Treasury Address**: Token holder for sales
- **Developer Addresses**: Recipients of escrow releases

### Network Configuration

The project supports:
- Local Hardhat network
- Sepolia testnet
- Optimism (OP) mainnet simulation
- Custom networks via `hardhat.config.ts`

## 📊 Contract Events

The contracts emit detailed events for monitoring and analytics:

### BuildingRegistry Events
```solidity
event BuildingCreated(uint256 indexed buildingId, string name, address developer);
event StatusUpdated(uint256 indexed buildingId, Status newStatus);
event MilestoneUpdated(uint256 indexed buildingId, uint8 milestone);
```

### BuildingSaleManager Events
```solidity
event SaleConfigured(uint256 indexed buildingId, address token, address quoteToken);
event SalePublished(uint256 indexed buildingId);
event SaleOpened(uint256 indexed buildingId);
event TokensPurchased(uint256 indexed buildingId, address buyer, uint256 amount, uint256 cost);
```

### EscrowManager Events
```solidity
event FundsDeposited(uint256 indexed buildingId, address depositor, uint256 amount);
event FundsReleased(uint256 indexed buildingId, uint8 milestone, address developer, uint256 amount);
```

## 🧪 Testing Strategy

Our comprehensive test suite covers:

- ✅ Contract deployment and initialization
- ✅ Building registration and status management
- ✅ Token creation and fractional ownership
- ✅ Sale configuration and token purchases
- ✅ Escrow setup and milestone-based releases
- ✅ Access control and permissions
- ✅ Input validation and error handling
- ✅ Edge cases and security scenarios

## 📈 Protocol Flow

1. **Registration**: Building is registered in `BuildingRegistry` with metadata and milestones
2. **Tokenization**: `BuildingTokenFactory` deploys unique ERC20 token for the building
3. **Sale Setup**: `BuildingSaleManager` configures sale parameters (price, max tokens)
4. **Fundraising**: Investors purchase tokens with USDC
5. **Escrow**: Funds are held in `EscrowManager` until milestones are completed
6. **Construction**: Oracle/owner updates milestones as construction progresses
7. **Release**: Funds are released to developer upon milestone completion
8. **Trading**: Tokens can be transferred (if restrictions allow) representing ownership

## 🔮 Future Enhancements

- [ ] Secondary market integration
- [ ] Multi-token payment support
- [ ] Automated milestone verification via oracles
- [ ] Governance token for protocol decisions
- [ ] Staking mechanisms for token holders
- [ ] Insurance integration for construction risks
- [ ] Cross-chain bridge support

## 📚 Technical Stack

- **Solidity**: ^0.8.20 (compatible with 0.8.28)
- **Hardhat**: 3 Beta with TypeScript
- **OpenZeppelin**: Security-focused libraries (v5.4.0)
- **Viem**: Modern Ethereum library
- **Node.js Test**: Native testing framework
- **TypeScript**: Type-safe development

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npx hardhat test`)
- Code follows Solidity style guide
- Security best practices are followed
- Documentation is updated

---

**Built with ❤️ for the Ethereum ecosystem**
