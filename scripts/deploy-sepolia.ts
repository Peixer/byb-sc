import { network } from "hardhat";

async function main() {
  // Connect to sepolia network
  const { viem } = await network.connect({
    network: "sepolia",
    chainType: "l1",
  });

  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  console.log("Deploying Counter contract to Sepolia...");
  console.log("Deployer address:", walletClient.account.address);

  // Get the deployer's balance
  const balance = await publicClient.getBalance({
    address: walletClient.account.address,
  });
  console.log("Deployer balance:", balance.toString(), "wei");

  // Deploy the Counter contract
  const counter = await viem.deployContract("Counter");

  console.log("Counter contract deployed at:", counter.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment error:", error);
    process.exit(1);
  });

