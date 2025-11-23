import { network } from "hardhat";
import { decodeEventLog } from "viem";

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

  // Building configuration (uses placeholder/mock data by default, can be overridden via env vars)
  const SKIP_BUILDING_CREATION = process.env.SKIP_BUILDING_CREATION === "true";
  const BUILDING_NAME = process.env.BUILDING_NAME || "Mock Building Project";
  const BUILDING_METADATA_URI = process.env.BUILDING_METADATA_URI || "https://example.com/metadata.json";
  const BUILDING_DEVELOPER = (process.env.BUILDING_DEVELOPER || deployer) as `0x${string}`;
  const BUILDING_ORACLE = (process.env.BUILDING_ORACLE || deployer) as `0x${string}`;
  const BUILDING_TOTAL_MILESTONES = process.env.BUILDING_TOTAL_MILESTONES ? parseInt(process.env.BUILDING_TOTAL_MILESTONES) : 3;

  // Token configuration (placeholder/mock defaults)
  const TOKEN_NAME = process.env.TOKEN_NAME || "Mock Building Token";
  const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "MBT";
  const TOKEN_TOTAL_SUPPLY = process.env.TOKEN_TOTAL_SUPPLY ? BigInt(process.env.TOKEN_TOTAL_SUPPLY) : BigInt("1000000000000000000000000"); // 1M tokens (18 decimals)

  // Sale configuration (placeholder/mock defaults)
  const TOKEN_PRICE = process.env.TOKEN_PRICE ? BigInt(process.env.TOKEN_PRICE) : BigInt("1000000"); // 1 USDC per token (6 decimals USDC)
  const MAX_TOKENS_FOR_SALE = process.env.MAX_TOKENS_FOR_SALE ? BigInt(process.env.MAX_TOKENS_FOR_SALE) : BigInt("500000000000000000000000"); // 500K tokens

  // Escrow configuration (placeholder/mock defaults - distributes evenly across milestones)
  // Default: 100,000 USDC per milestone (300K USDC total for 3 milestones)
  const DEFAULT_MILESTONE_AMOUNT = BigInt("100000000000"); // 100K USDC (6 decimals = 100000 * 10^6)
  const ESCROW_MILESTONE_AMOUNTS = process.env.ESCROW_MILESTONE_AMOUNTS 
    ? process.env.ESCROW_MILESTONE_AMOUNTS.split(",").map(amt => BigInt(amt.trim()))
    : Array(BUILDING_TOTAL_MILESTONES).fill(DEFAULT_MILESTONE_AMOUNT);

  console.log("Configuration:");
  console.log("  USDC Token:", USDC_TOKEN);
  console.log("  Token Treasury:", TOKEN_TREASURY);
  if (!SKIP_BUILDING_CREATION) {
    console.log("  Building Name:", BUILDING_NAME, "(mock/placeholder)");
    console.log("  Building Developer:", BUILDING_DEVELOPER);
    console.log("  Building Oracle:", BUILDING_ORACLE);
    console.log("  Building Total Milestones:", BUILDING_TOTAL_MILESTONES);
    console.log("  Token Name:", TOKEN_NAME, "(mock/placeholder)");
    console.log("  Token Symbol:", TOKEN_SYMBOL, "(mock/placeholder)");
  }
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

  // Post-deployment configuration
  console.log("=".repeat(60));
  console.log("Post-Deployment Configuration");
  console.log("=".repeat(60));

  // Step 1: Set EscrowManager in BuildingSaleManager (required)
  console.log("Step 1: Setting EscrowManager in BuildingSaleManager...");
  const buildingSaleManagerContract = await viem.getContractAt(
    "BuildingSaleManager",
    buildingSaleManager.address
  );
  const setEscrowTx = await buildingSaleManagerContract.write.setEscrowManager([
    escrowManager.address,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: setEscrowTx });
  console.log("✓ EscrowManager set in BuildingSaleManager");
  console.log("");

  // Step 2: Create building with placeholder/mock data (unless skipped)
  let buildingId: bigint | null = null;
  if (!SKIP_BUILDING_CREATION) {
    console.log("Step 2: Creating building with placeholder/mock data...");
    const buildingRegistryContract = await viem.getContractAt(
      "BuildingRegistry",
      buildingRegistry.address
    );
    const createBuildingTx = await buildingRegistryContract.write.createBuilding([
      BUILDING_NAME ?? "TEST BUILDING",
      BUILDING_METADATA_URI ?? "https://example.com/metadata.json",
      BUILDING_DEVELOPER ?? deployer,
      BUILDING_ORACLE ?? deployer,
      BUILDING_TOTAL_MILESTONES ?? 3,  "Test description", "Test location", false
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: createBuildingTx });
    
    // Get the building ID from the BuildingCreated event
    let foundBuildingId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: buildingRegistryContract.abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "BuildingCreated" && decoded.args.buildingId !== undefined) {
          foundBuildingId = decoded.args.buildingId as bigint;
          break;
        }
      } catch {
        // Not our event, continue
      }
    }
    
    if (foundBuildingId !== null) {
      buildingId = foundBuildingId;
    } else {
      // Fallback: use getNextBuildingId - 1
      const nextId = await buildingRegistryContract.read.getNextBuildingId();
      buildingId = nextId - BigInt(1);
      console.log("⚠ Could not find BuildingCreated event, using fallback method");
    }
    
    // Verify the building exists before proceeding
    try {
      const building = await buildingRegistryContract.read.getBuilding([buildingId]);
     
     console.log("building", building); 
    } catch (error) {
      console.error(`✗ Building ${buildingId} does not exist or could not be retrieved:`, error);
      throw error;
    }
    
    console.log(`✓ Building created with ID: ${buildingId}`);
    console.log("");

    // Step 3: Create token for the building
    console.log("Step 3: Creating BuildingToken with placeholder/mock data...");
    const buildingTokenFactoryContract = await viem.getContractAt(
      "BuildingTokenFactory",
      buildingTokenFactory.address
    );
    const createTokenTx = await buildingTokenFactoryContract.write.createBuildingToken([
      buildingId,
      TOKEN_NAME ?? "TEST TOKEN",
      TOKEN_SYMBOL ?? "TT",
      TOKEN_TOTAL_SUPPLY ?? BigInt("100000000000000000"),
      TOKEN_TREASURY ?? deployer,
    ]); 
    await publicClient.waitForTransactionReceipt({ hash: createTokenTx });
    
    // Get the token address
    const tokenAddress = await buildingTokenFactoryContract.read.getBuildingToken([buildingId]);
    console.log(`✓ BuildingToken created at: ${tokenAddress}`);
    console.log("");

    // Step 4: Configure sale
    console.log("Step 4: Configuring sale with placeholder/mock data...");
    const configureSaleTx = await buildingSaleManagerContract.write.configureSale([
      buildingId,
      tokenAddress,
      USDC_TOKEN,
      TOKEN_PRICE,
      MAX_TOKENS_FOR_SALE,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: configureSaleTx });
    console.log("✓ Sale configured");
    console.log("");

    // Step 5: Configure escrow with placeholder/mock data
    if (ESCROW_MILESTONE_AMOUNTS.length === BUILDING_TOTAL_MILESTONES) {
      console.log("Step 5: Configuring escrow with placeholder/mock data...");
      const escrowManagerContract = await viem.getContractAt(
        "EscrowManager",
        escrowManager.address
      );
      const configureEscrowTx = await escrowManagerContract.write.configureEscrow([
        buildingId,
        BUILDING_DEVELOPER,
        ESCROW_MILESTONE_AMOUNTS,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: configureEscrowTx });
      console.log("✓ Escrow configured");
      console.log("");
    } else {
      console.log("⚠ Skipping escrow configuration: milestone amounts count doesn't match total milestones");
      console.log("");
    }
  } else {
    console.log("ℹ Skipping building creation: SKIP_BUILDING_CREATION=true");
    console.log("  Remove SKIP_BUILDING_CREATION env var to create a building with placeholder/mock data");
    console.log("");
  }

  // Final summary
  console.log("=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log("Contract Addresses:");
  console.log("  BuildingRegistry:", buildingRegistry.address);
  console.log("  EscrowManager:", escrowManager.address);
  console.log("  BuildingSaleManager:", buildingSaleManager.address);
  console.log("  BuildingTokenFactory:", buildingTokenFactory.address);
  if (buildingId !== null) {
    console.log("");
    console.log("Created Building:");
    console.log("  Building ID:", buildingId.toString());
    const buildingTokenFactoryContract = await viem.getContractAt(
      "BuildingTokenFactory",
      buildingTokenFactory.address
    );
    const tokenAddress = await buildingTokenFactoryContract.read.getBuildingToken([buildingId]);
    console.log("  Token Address:", tokenAddress);
  }
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });

