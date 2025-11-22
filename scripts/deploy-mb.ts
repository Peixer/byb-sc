import hre from "hardhat";

async function main() {
  const { ethers } = hre as any;
  const [signer] = await ethers.getSigners();
  console.log("Deploying with account:", signer.address);

  // Setup MultiBaas deployer
  const mbDeployer = (hre as any).mbDeployer;
  await mbDeployer.setup();

  // Deploy the contract
  const deployResult = await mbDeployer.deploy(
    signer, // or use { signer } as FactoryOptions
    "Counter", // contract name
    [], // constructor arguments
    {
      // optional DeployOptions
      addressAlias: "CounterDeployment",
      startingBlock: "-100", // sync from 100 blocks before current
    }
  );

  console.log("Contract deployed at:", deployResult.contract.address);
  console.log("MultiBaas contract ID:", deployResult.mbContract.id);
  console.log("MultiBaas address ID:", deployResult.mbAddress.id);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("test error", error);
    process.exit(1);
  });