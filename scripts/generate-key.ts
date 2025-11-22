import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";

// Generate a new random private key
const privateKey = generatePrivateKey();

// Get the address from the private key
const address = privateKeyToAddress(privateKey);

console.log("=".repeat(60));
console.log("Generated New Ethereum Account");
console.log("=".repeat(60));
console.log("Address:", address);
console.log("Private Key:", privateKey);
console.log("=".repeat(60));
console.log("\n⚠️  IMPORTANT:");
console.log("- Keep this private key SECURE and NEVER share it");
console.log("- This is for SEPOLIA TESTNET only");
console.log("- Fund this address with Sepolia ETH from a faucet:");
console.log("  https://sepoliafaucet.com/");
console.log("  https://faucet.quicknode.com/ethereum/sepolia");
console.log("\nTo use this in your .env file:");
console.log(`SEPOLIA_PRIVATE_KEY=${privateKey}`);

