import { network } from "hardhat";
import { parseUnits, type Address } from "viem";

async function main() {
  // Connect to network
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const deployer = walletClient.account.address;

  console.log("=".repeat(60));
  console.log("Running Sale Operations");
  console.log("=".repeat(60));
  console.log("Deployer address:", deployer);
  console.log("");

  // Configuration - these can be set via environment variables or hardcoded
  const BUILDING_SALE_MANAGER_ADDRESS = "0xc34c7cba85c30e9ac45459e738406490dd28e71b" as `0x${string}`;
  const BUILDING_ID = 1n
  const BUILDING_TOKEN_ADDRESS = "0xA2eA630E63d4d888471118fB88a43eAD78CE7999" as `0x${string}`;
  const QUOTE_TOKEN_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
  
  // Sale configuration
  const TOKEN_PRICE = 1n // 1 USDC per token (6 decimals USDC)
  const MAX_TOKENS_FOR_SALE = parseUnits("500000", 18); // 500K tokens (18 decimals)
  
  // Purchase configuration
  const QUOTE_AMOUNT = 2n; // 1000 USDC 

  console.log("Configuration:");
  console.log("  BuildingSaleManager:", BUILDING_SALE_MANAGER_ADDRESS);
  console.log("  Building ID:", BUILDING_ID.toString());
  console.log("  Building Token:", BUILDING_TOKEN_ADDRESS);
  console.log("  Quote Token:", QUOTE_TOKEN_ADDRESS);
  console.log("  Token Price:", TOKEN_PRICE.toString());
  console.log("  Max Tokens For Sale:", MAX_TOKENS_FOR_SALE.toString());
  console.log("  Quote Amount (for purchase):", QUOTE_AMOUNT.toString());
  console.log("");

  // Get contract instance
  const buildingSaleManager = await viem.getContractAt(
    "BuildingSaleManager",
    BUILDING_SALE_MANAGER_ADDRESS
  );

  // Step 0: Approve Building Token
  console.log("Step 0: Approving building tokens...");
  try {
    // Get the tokenTreasury address from the contract
    const tokenTreasury = await buildingSaleManager.read.tokenTreasury();
    console.log("  Token Treasury:", tokenTreasury);
    
    // Get building token contract instance
    const buildingTokenAbi = [
      {
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const;

    let buildingToken: any;
    try {
      buildingToken = await viem.getContractAt("BuildingToken", BUILDING_TOKEN_ADDRESS);
    } catch {
      // Fallback to using the inline ERC20 ABI
      buildingToken = await viem.getContractAt(buildingTokenAbi as any, BUILDING_TOKEN_ADDRESS);
    }

    // Check if approval is needed
    let needsApproval = true;
    try {
      const allowance = await buildingToken.read.allowance([tokenTreasury, BUILDING_SALE_MANAGER_ADDRESS]);
      console.log("  Current allowance:", allowance.toString());
      needsApproval = allowance < MAX_TOKENS_FOR_SALE;
    } catch (error: any) {
      console.log("  ⚠ Could not check allowance (will attempt approval anyway)");
    }

    if (needsApproval) {
      // Check if deployer is the treasury (can approve directly)
      if (deployer.toLowerCase() === tokenTreasury.toLowerCase()) {
        console.log("  Approving building tokens from treasury (deployer)...");
        const approveTx = await buildingToken.write.approve([
          BUILDING_SALE_MANAGER_ADDRESS,
          MAX_TOKENS_FOR_SALE,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log("✓ Building tokens approved");
      } else {
        console.log("  ⚠ Warning: Token treasury is not the deployer address");
        console.log("  Treasury:", tokenTreasury);
        console.log("  Deployer:", deployer);
        console.log("  You need to approve the BuildingSaleManager from the treasury address");
        console.log("  Approval needed: BuildingToken.approve(");
        console.log("    spender:", BUILDING_SALE_MANAGER_ADDRESS);
        console.log("    amount:", MAX_TOKENS_FOR_SALE.toString());
        console.log("  )");
        throw new Error("Cannot approve: deployer is not the token treasury");
      }
    } else {
      console.log("  ✓ Sufficient allowance already set");
    }
    console.log("");
  } catch (error: any) {
    console.error("✗ Failed to approve building tokens:", error.message);
    throw error;
  }

  // Step 1: Configure Sale
  console.log("Step 1: Configuring sale...");
  try {
    const configureSaleTx = await buildingSaleManager.write.configureSale([
      BUILDING_ID,
      BUILDING_TOKEN_ADDRESS,
      QUOTE_TOKEN_ADDRESS,
      TOKEN_PRICE,
      MAX_TOKENS_FOR_SALE,
    ]);
    const configureReceipt = await publicClient.waitForTransactionReceipt({ hash: configureSaleTx });
    console.log("✓ Sale configured");
    console.log("  Transaction hash:", configureSaleTx);
    console.log("  Block number:", configureReceipt.blockNumber.toString());
    console.log("");
  } catch (error: any) {
    console.error("✗ Failed to configure sale:", error.message);
    throw error;
  }

  // Step 2: Publish Sale
  console.log("Step 2: Publishing sale...");
  try {
    const publishSaleTx = await buildingSaleManager.write.publishSale([BUILDING_ID]);
    const publishReceipt = await publicClient.waitForTransactionReceipt({ hash: publishSaleTx });
    console.log("✓ Sale published");
    console.log("  Transaction hash:", publishSaleTx);
    console.log("  Block number:", publishReceipt.blockNumber.toString());
    console.log("");
  } catch (error: any) {
    console.error("✗ Failed to publish sale:", error.message);
    throw error;
  }

  // Step 3: Open Sale
  console.log("Step 3: Opening sale...");
  try {
    const openSaleTx = await buildingSaleManager.write.openSale([BUILDING_ID]);
    const openReceipt = await publicClient.waitForTransactionReceipt({ hash: openSaleTx });
    console.log("✓ Sale opened");
    console.log("  Transaction hash:", openSaleTx);
    console.log("  Block number:", openReceipt.blockNumber.toString());
    console.log("");
  } catch (error: any) {
    console.error("✗ Failed to open sale:", error.message);
    throw error;
  }

  // Step 4: Buy Tokens
  console.log("Step 4: Buying tokens...");
  try {
    // If MockERC20 doesn't work, try to use standard ERC20 ABI
    // We'll use a minimal ERC20 ABI with just the functions we need
    const erc20Abi = [
      {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
    ] as const;
    // First, check if buyer has enough quote tokens and approve if needed
    // Try to use MockERC20 first (for testnets), fallback to standard ERC20 ABI
    let quoteToken: any;
    try {
      quoteToken = await viem.getContractAt("MockERC20", QUOTE_TOKEN_ADDRESS);
    } catch {
      // Fallback to using the inline ERC20 ABI
      quoteToken = await viem.getContractAt(erc20Abi as any, QUOTE_TOKEN_ADDRESS);
    }

    // Try to check balance (optional - skip if it fails)
    try {
      const buyerBalance = await quoteToken.read.balanceOf([deployer]);
      console.log("  Buyer balance:", buyerBalance.toString());
      
      if (buyerBalance < QUOTE_AMOUNT) {
        console.log("  ⚠ Warning: Buyer balance is less than quote amount");
        console.log("  Make sure to mint/transfer quote tokens to the buyer address");
      }
    } catch (error: any) {
      console.log("  ⚠ Could not check buyer balance (skipping check)");
    }

    // Check allowance and approve if needed
    let needsApproval = true;
    try {
      const allowance = await quoteToken.read.allowance([deployer, BUILDING_SALE_MANAGER_ADDRESS]);
      console.log("  Current allowance:", allowance.toString());
      needsApproval = allowance < QUOTE_AMOUNT;
    } catch (error: any) {
      console.log("  ⚠ Could not check allowance (will attempt approval anyway)");
    }
    
    if (needsApproval) {
      console.log("  Approving quote tokens...");
      try {
        const approveTx = await quoteToken.write.approve([
          BUILDING_SALE_MANAGER_ADDRESS,
          200000000n,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log("  ✓ Quote tokens approved");
      } catch (error: any) {
        console.log("  ⚠ Approval failed, but continuing with purchase attempt");
        // Continue anyway - the buyTokens call will fail if approval is actually needed
      }
    } else {
      console.log("  ✓ Sufficient allowance already set");
    }

    // Buy tokens
    const buyTokensTx = await buildingSaleManager.write.buyTokens([
      BUILDING_ID,
      QUOTE_AMOUNT,
    ]);
    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTokensTx });
    
    // Calculate tokens bought
    const sale = await buildingSaleManager.read.getSale([BUILDING_ID]);
    const tokensBought = sale.tokensSold;
    
    console.log("✓ Tokens purchased");
    console.log("  Transaction hash:", buyTokensTx);
    console.log("  Block number:", buyReceipt.blockNumber.toString());
    console.log("  Tokens bought:", tokensBought.toString());
    console.log("  Quote amount spent:", QUOTE_AMOUNT.toString());
    console.log("");
  } catch (error: any) {
    console.error("✗ Failed to buy tokens:", error.message);
    throw error;
  }

  // Final summary
  console.log("=".repeat(60));
  console.log("Sale Operations Complete!");
  console.log("=".repeat(60));
  
  // Get final sale state
  const finalSale = await buildingSaleManager.read.getSale([BUILDING_ID]);
  console.log("Final Sale State:");
  console.log("  Building ID:", finalSale.buildingId.toString());
  console.log("  Building Token:", finalSale.buildingToken);
  console.log("  Quote Token:", finalSale.quoteToken);
  console.log("  Token Price:", finalSale.tokenPrice.toString());
  console.log("  Max Tokens For Sale:", finalSale.maxTokensForSale.toString());
  console.log("  Tokens Sold:", finalSale.tokensSold.toString());
  console.log("  Published:", finalSale.published);
  console.log("  Open:", finalSale.open);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });

