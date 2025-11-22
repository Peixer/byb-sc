import { network } from "hardhat";

async function main() {
  // Connect to network
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const deployer = walletClient.account.address;

  console.log("=".repeat(60));
  console.log("Deploying Real Estate Construction RWA Protocol Contracts");
  console.log("=".repeat(60));
  console.log("Deployer address:", deployer);

  // Get the deployer's balance
  const balance = await publicClient.getBalance({
    address: deployer,
  });
  console.log("Deployer balance:", balance.toString(), "wei");
  console.log("");

  // Configuration - these can be set via environment variables or hardcoded
  // For USDC, you'll need to provide the address for your network
  // Common addresses:
  // - Sepolia: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (USDC testnet)
  // - Mainnet: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  const USDC_TOKEN = (process.env.USDC_TOKEN_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as `0x${string}`;
  
  // Token treasury - address that will hold BuildingTokens to be sold
  // Default to deployer, but can be set to a separate treasury address
  const TOKEN_TREASURY = (process.env.TOKEN_TREASURY_ADDRESS || deployer) as `0x${string}`;

  console.log("Configuration:");
  console.log("  USDC Token:", USDC_TOKEN);
  console.log("  Token Treasury:", TOKEN_TREASURY);
  console.log("");

  // Step 1: Deploy BuildingRegistry
  console.log("Step 1: Deploying BuildingRegistry...");
  const buildingRegistry = await viem.deployContract("BuildingRegistry", [deployer]);
  console.log("✓ BuildingRegistry deployed at:", buildingRegistry.address);
  console.log("");

  // Step 2: Deploy EscrowManager
  console.log("Step 2: Deploying EscrowManager...");
  const escrowManager = await viem.deployContract("EscrowManager", [
    deployer,
    buildingRegistry.address,
    USDC_TOKEN,
  ]);
  console.log("✓ EscrowManager deployed at:", escrowManager.address);
  console.log("");

  // Step 3: Deploy BuildingSaleManager
  console.log("Step 3: Deploying BuildingSaleManager...");
  const buildingSaleManager = await viem.deployContract("BuildingSaleManager", [
    deployer,
    buildingRegistry.address,
    TOKEN_TREASURY,
  ]);
  console.log("✓ BuildingSaleManager deployed at:", buildingSaleManager.address);
  console.log("");

  // Step 4: Deploy BuildingTokenFactory
  console.log("Step 4: Deploying BuildingTokenFactory...");
  const buildingTokenFactory = await viem.deployContract("BuildingTokenFactory", [
    deployer,
    buildingRegistry.address,
  ]);
  console.log("✓ BuildingTokenFactory deployed at:", buildingTokenFactory.address);
  console.log("");

  // Summary
  console.log("=".repeat(60));
  console.log("Deployment Summary");
  console.log("=".repeat(60));
  console.log("BuildingRegistry:", buildingRegistry.address);
  console.log("EscrowManager:", escrowManager.address);
  console.log("BuildingSaleManager:", buildingSaleManager.address);
  console.log("BuildingTokenFactory:", buildingTokenFactory.address);
  console.log("");
  console.log("Next Steps:");
  console.log("1. Set EscrowManager in BuildingSaleManager:");
  console.log(`   buildingSaleManager.setEscrowManager("${escrowManager.address}")`);
  console.log("2. Configure admins in BuildingRegistry if needed:");
  console.log(`   buildingRegistry.setAdmin(adminAddress, true)`);
  console.log("3. Create buildings using BuildingRegistry:");
  console.log(`   buildingRegistry.createBuilding(...)`);
  console.log("4. Create tokens using BuildingTokenFactory:");
  console.log(`   buildingTokenFactory.createBuildingToken(...)`);
  console.log("5. Configure sales using BuildingSaleManager:");
  console.log(`   buildingSaleManager.configureSale(...)`);
  console.log("6. Configure escrow using EscrowManager:");
  console.log(`   escrowManager.configureEscrow(...)`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });

