import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits, type Address } from "viem";

import { network } from "hardhat";

describe("EscrowManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper function to deploy MockERC20 (USDC)
  async function deployMockUSDC() {
    return await viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6, // decimals
      parseUnits("1000000", 6), // 1M USDC initial supply
    ]);
  }

  // Helper function to deploy BuildingRegistry
  async function deployBuildingRegistry(owner: Address) {
    return await viem.deployContract("BuildingRegistry", [owner]);
  }

  // Helper function to deploy EscrowManager
  async function deployEscrowManager(
    owner: Address,
    buildingRegistry: Address,
    usdcToken: Address
  ) {
    return await viem.deployContract("EscrowManager", [
      owner,
      buildingRegistry,
      usdcToken,
    ]);
  }

  // Helper function to create a building
  async function createBuilding(
    registry: any,
    signer: any,
    name: string = "Test Building",
    metadataURI: string = "ipfs://test",
    developer: Address,
    oracle: Address,
    totalMilestones: number = 5
  ) {
    return await registry.write.createBuilding(
      [name, metadataURI, developer, oracle, totalMilestones],
      { account: signer.account }
    );
  }

  // Helper function to mint USDC to an address and approve escrow manager
  async function mintAndApproveUSDC(
    usdc: any,
    to: Address,
    escrowManager: Address,
    amount: bigint,
    minter: any
  ) {
    // Mint USDC to the address
    await usdc.write.mint([to, amount], { account: minter.account });
    // Approve escrow manager to spend
    await usdc.write.approve([escrowManager, amount], { account: to });
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      const ownerAddress = await escrowManager.read.owner();
      assert.equal(
        ownerAddress.toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });

    it("Should set the correct building registry", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      const registryAddress = await escrowManager.read.buildingRegistry();
      assert.equal(registryAddress.toLowerCase(), registry.address.toLowerCase());
    });

    it("Should set the correct USDC token address", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      const usdcAddress = await escrowManager.read.usdcToken();
      assert.equal(usdcAddress.toLowerCase(), usdc.address.toLowerCase());
    });

    it("Should revert if buildingRegistry is zero address", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();

      await assert.rejects(
        viem.deployContract("EscrowManager", [
          owner.account.address,
          "0x0000000000000000000000000000000000000000",
          usdc.address,
        ]),
        /EscrowManager: buildingRegistry cannot be zero address/
      );
    });

    it("Should revert if usdcToken is zero address", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        viem.deployContract("EscrowManager", [
          owner.account.address,
          registry.address,
          "0x0000000000000000000000000000000000000000",
        ]),
        /EscrowManager: usdcToken cannot be zero address/
      );
    });
  });

  describe("configureEscrow", function () {
    it("Should configure escrow with correct parameters", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      // Create building with 3 milestones
      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const milestoneAmounts = [
        parseUnits("1000", 6), // 1000 USDC for milestone 1
        parseUnits("2000", 6), // 2000 USDC for milestone 2
        parseUnits("3000", 6), // 3000 USDC for milestone 3
      ];

      await viem.assertions.emitWithArgs(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, milestoneAmounts],
          { account: owner.account }
        ),
        escrowManager,
        "EscrowConfigured",
        [1n, getAddress(developer.account.address), 3]
      );

      // Verify escrow info
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(
        escrowInfo[4].toLowerCase(),
        developer.account.address.toLowerCase()
      ); // developer
      assert.equal(escrowInfo[3], 3); // totalMilestones
      assert.equal(escrowInfo[0], 0n); // totalEscrowed
      assert.equal(escrowInfo[1], 0n); // totalReleased
      assert.equal(escrowInfo[2], 0); // lastReleasedMilestone

      // Verify milestone amounts
      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 0]),
        parseUnits("1000", 6)
      );
      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 1]),
        parseUnits("2000", 6)
      );
      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 2]),
        parseUnits("3000", 6)
      );
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, milestoneAmounts],
          { account: unauthorized.account }
        ),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if developer is zero address", async function () {
      const [owner, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        owner.account.address,
        oracle.account.address,
        3
      );

      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, "0x0000000000000000000000000000000000000000", milestoneAmounts],
          { account: owner.account }
        ),
        /EscrowManager: developer cannot be zero address/
      );
    });

    it("Should revert if milestone amounts array is empty", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, []],
          { account: owner.account }
        ),
        /EscrowManager: must have at least one milestone/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, developer] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      const milestoneAmounts = [parseUnits("1000", 6)];

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [999n, developer.account.address, milestoneAmounts],
          { account: owner.account }
        ),
        /building does not exist/
      );
    });

    it("Should revert if milestone amounts length doesn't match building totalMilestones", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Provide only 2 milestone amounts when building has 3 milestones
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
      ];

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, milestoneAmounts],
          { account: owner.account }
        ),
        /EscrowManager: milestone amounts length must match building totalMilestones/
      );
    });

    it("Should revert if escrow already configured", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];

      // Configure escrow first time
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Try to configure again
      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, milestoneAmounts],
          { account: owner.account }
        ),
        /EscrowManager: escrow already configured for this building/
      );
    });

    it("Should revert if milestone amount is zero", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const milestoneAmounts = [
        parseUnits("1000", 6),
        0n, // Zero amount
        parseUnits("3000", 6),
      ];

      await assert.rejects(
        escrowManager.write.configureEscrow(
          [1n, developer.account.address, milestoneAmounts],
          { account: owner.account }
        ),
        /EscrowManager: milestone amount must be > 0/
      );
    });
  });

  describe("depositFunds", function () {
    it("Should deposit funds successfully", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Mint USDC to depositor and approve
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );

      // Deposit funds
      await viem.assertions.emitWithArgs(
        escrowManager.write.depositFunds([1n, depositAmount], {
          account: depositor.account,
        }),
        escrowManager,
        "FundsDeposited",
        [1n, getAddress(depositor.account.address), depositAmount]
      );

      // Verify escrow info
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[0], depositAmount); // totalEscrowed
      assert.equal(escrowInfo[1], 0n); // totalReleased

      // Verify USDC balance
      const escrowBalance = await usdc.read.balanceOf([escrowManager.address]);
      assert.equal(escrowBalance, depositAmount);
    });

    it("Should allow multiple deposits", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // First deposit
      const depositAmount1 = parseUnits("2000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount1,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount1], {
        account: depositor.account,
      });

      // Second deposit
      const depositAmount2 = parseUnits("3000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount2,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount2], {
        account: depositor.account,
      });

      // Verify total
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(
        escrowInfo[0],
        depositAmount1 + depositAmount2 // totalEscrowed
      );
    });

    it("Should revert if amount is zero", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      await assert.rejects(
        escrowManager.write.depositFunds([1n, 0n], {
          account: depositor.account,
        }),
        /EscrowManager: amount must be > 0/
      );
    });

    it("Should revert if escrow not configured", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Try to deposit without configuring escrow
      const depositAmount = parseUnits("1000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );

      await assert.rejects(
        escrowManager.write.depositFunds([1n, depositAmount], {
          account: depositor.account,
        }),
        /EscrowManager: escrow not configured for this building/
      );
    });

    it("Should revert if USDC transfer fails", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Try to deposit without approval - should fail with allowance error
      const depositAmount = parseUnits("1000", 6);
      // Note: depositor doesn't have tokens or approval, so transferFrom will fail
      await assert.rejects(
        escrowManager.write.depositFunds([1n, depositAmount], {
          account: depositor.account,
        }),
        /USDC transfer failed|ERC20InsufficientAllowance/
      );
    });
  });

  describe("releaseMilestoneFunds", function () {
    it("Should release funds for milestone 1", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Confirm milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });

      const developerBalanceBefore = await usdc.read.balanceOf([
        developer.account.address,
      ]);

      // Release funds for milestone 1
      await viem.assertions.emitWithArgs(
        escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        }),
        escrowManager,
        "FundsReleased",
        [1n, 1, getAddress(developer.account.address), parseUnits("1000", 6)]
      );

      // Verify escrow info
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[1], parseUnits("1000", 6)); // totalReleased
      assert.equal(escrowInfo[2], 1); // lastReleasedMilestone (0-indexed, so 1 means milestone 1 released)

      // Verify developer received funds
      const developerBalanceAfter = await usdc.read.balanceOf([
        developer.account.address,
      ]);
      assert.equal(
        developerBalanceAfter - developerBalanceBefore,
        parseUnits("1000", 6)
      );
    });

    it("Should release funds for multiple milestones sequentially", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Confirm and release milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      // Confirm and release milestone 2
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      // Verify escrow info after milestone 2
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(
        escrowInfo[1],
        parseUnits("3000", 6)
      ); // totalReleased (1000 + 2000)
      assert.equal(escrowInfo[2], 2); // lastReleasedMilestone
    });

    it("Should revert if escrow not configured", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      await assert.rejects(
        escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        }),
        /EscrowManager: escrow not configured/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      // This will fail because escrow is not configured, but if we configure first
      // and then check building existence, it should fail on building check
      await assert.rejects(
        escrowManager.write.releaseMilestoneFunds([999n], {
          account: owner.account,
        }),
        /EscrowManager: escrow not configured/
      );
    });

    it("Should revert if no new milestones available to release", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Try to release without confirming any milestones
      await assert.rejects(
        escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        }),
        /EscrowManager: no new milestones available to release/
      );
    });

    it("Should revert if all milestones have been released", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Confirm and release all 3 milestones
      for (let i = 0; i < 3; i++) {
        await registry.write.confirmMilestone([1n], {
          account: oracle.account,
        });
        await escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        });
      }

      // Try to release again - after all milestones are released, 
      // currentMilestone (3) equals lastReleasedMilestone (3), so it will fail with "no new milestones"
      await assert.rejects(
        escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        }),
        /EscrowManager: no new milestones available to release|EscrowManager: all milestones have been released/
      );
    });

    it("Should revert if insufficient escrowed funds", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow with large milestone amounts
      const milestoneAmounts = [
        parseUnits("10000", 6), // Large amount
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit insufficient funds
      const depositAmount = parseUnits("5000", 6); // Less than first milestone
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Confirm milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });

      // Try to release - should fail due to insufficient funds
      await assert.rejects(
        escrowManager.write.releaseMilestoneFunds([1n], {
          account: owner.account,
        }),
        /EscrowManager: insufficient escrowed funds/
      );
    });
  });

  describe("getEscrowInfo", function () {
    it("Should return correct escrow information", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      let escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[0], depositAmount); // totalEscrowed
      assert.equal(escrowInfo[1], 0n); // totalReleased
      assert.equal(escrowInfo[2], 0); // lastReleasedMilestone
      assert.equal(escrowInfo[3], 3); // totalMilestones
      assert.equal(
        escrowInfo[4].toLowerCase(),
        developer.account.address.toLowerCase()
      ); // developer

      // Release milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[0], depositAmount); // totalEscrowed (unchanged)
      assert.equal(escrowInfo[1], parseUnits("1000", 6)); // totalReleased
      assert.equal(escrowInfo[2], 1); // lastReleasedMilestone
    });

    it("Should revert if escrow not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await assert.rejects(
        escrowManager.read.getEscrowInfo([1n]),
        /EscrowManager: escrow not configured/
      );
    });
  });

  describe("getMilestoneReleaseAmount", function () {
    it("Should return correct milestone release amount", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 0]),
        parseUnits("1000", 6)
      );
      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 1]),
        parseUnits("2000", 6)
      );
      assert.equal(
        await escrowManager.read.getMilestoneReleaseAmount([1n, 2]),
        parseUnits("3000", 6)
      );
    });

    it("Should revert if escrow not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await assert.rejects(
        escrowManager.read.getMilestoneReleaseAmount([1n, 0]),
        /EscrowManager: escrow not configured/
      );
    });
  });

  describe("getPendingReleaseAmount", function () {
    it("Should return zero if no milestones confirmed", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      const pendingAmount = await escrowManager.read.getPendingReleaseAmount([
        1n,
      ]);
      assert.equal(pendingAmount, 0n);
    });

    it("Should return correct pending amount for confirmed milestones", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Confirm milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      let pendingAmount = await escrowManager.read.getPendingReleaseAmount([
        1n,
      ]);
      assert.equal(pendingAmount, parseUnits("1000", 6));

      // Confirm milestone 2
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      pendingAmount = await escrowManager.read.getPendingReleaseAmount([1n]);
      assert.equal(pendingAmount, parseUnits("3000", 6)); // 1000 + 2000

      // Release milestone 1
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });
      pendingAmount = await escrowManager.read.getPendingReleaseAmount([1n]);
      assert.equal(pendingAmount, parseUnits("2000", 6)); // Only milestone 2 remaining
    });

    it("Should revert if escrow not configured for building", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      // Check pending amount for non-existent escrow
      // This will fail because escrow is not configured for building 999
      await assert.rejects(
        escrowManager.read.getPendingReleaseAmount([999n]),
        /EscrowManager: escrow not configured/
      );
    });

    it("Should revert if escrow not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await assert.rejects(
        escrowManager.read.getPendingReleaseAmount([1n]),
        /EscrowManager: escrow not configured/
      );
    });
  });

  describe("emergencyWithdraw", function () {
    it("Should withdraw all funds when amount is zero", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      const ownerBalanceBefore = await usdc.read.balanceOf([
        owner.account.address,
      ]);

      // Emergency withdraw all (amount = 0 means all)
      await escrowManager.write.emergencyWithdraw([0n], {
        account: owner.account,
      });

      const ownerBalanceAfter = await usdc.read.balanceOf([
        owner.account.address,
      ]);
      assert.equal(
        ownerBalanceAfter - ownerBalanceBefore,
        depositAmount
      );

      // Verify escrow balance is zero
      const escrowBalance = await usdc.read.balanceOf([escrowManager.address]);
      assert.equal(escrowBalance, 0n);
    });

    it("Should withdraw specific amount", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      const withdrawAmount = parseUnits("2000", 6);
      const ownerBalanceBefore = await usdc.read.balanceOf([
        owner.account.address,
      ]);

      // Emergency withdraw specific amount
      await escrowManager.write.emergencyWithdraw([withdrawAmount], {
        account: owner.account,
      });

      const ownerBalanceAfter = await usdc.read.balanceOf([
        owner.account.address,
      ]);
      assert.equal(
        ownerBalanceAfter - ownerBalanceBefore,
        withdrawAmount
      );

      // Verify escrow balance
      const escrowBalance = await usdc.read.balanceOf([escrowManager.address]);
      assert.equal(escrowBalance, depositAmount - withdrawAmount);
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      await assert.rejects(
        escrowManager.write.emergencyWithdraw([parseUnits("1000", 6)], {
          account: unauthorized.account,
        }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if withdrawal amount exceeds balance", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Deposit funds
      const depositAmount = parseUnits("1000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Try to withdraw more than balance
      await assert.rejects(
        escrowManager.write.emergencyWithdraw([parseUnits("2000", 6)], {
          account: owner.account,
        }),
        /EscrowManager: invalid withdrawal amount/
      );
    });
  });

  describe("Integration tests", function () {
    it("Should handle complete escrow lifecycle", async function () {
      const [owner, developer, oracle, depositor] =
        await viem.getWalletClients();
      const usdc = await deployMockUSDC();
      const registry = await deployBuildingRegistry(owner.account.address);
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      // 1. Create building
      await createBuilding(
        registry,
        owner,
        "Complete Lifecycle Building",
        "ipfs://lifecycle",
        developer.account.address,
        oracle.account.address,
        3
      );

      // 2. Configure escrow
      const milestoneAmounts = [
        parseUnits("1000", 6),
        parseUnits("2000", 6),
        parseUnits("3000", 6),
      ];
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // 3. Deposit funds
      const depositAmount = parseUnits("6000", 6);
      await mintAndApproveUSDC(
        usdc,
        depositor.account.address,
        escrowManager.address,
        depositAmount,
        owner
      );
      await escrowManager.write.depositFunds([1n, depositAmount], {
        account: depositor.account,
      });

      // Verify initial state
      let escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[0], depositAmount);
      assert.equal(escrowInfo[1], 0n);

      // 4. Confirm and release milestone 1
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[1], parseUnits("1000", 6));

      // 5. Confirm and release milestone 2
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[1], parseUnits("3000", 6));

      // 6. Confirm and release milestone 3
      await registry.write.confirmMilestone([1n], {
        account: oracle.account,
      });
      await escrowManager.write.releaseMilestoneFunds([1n], {
        account: owner.account,
      });

      escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[1], parseUnits("6000", 6));
      assert.equal(escrowInfo[2], 3); // All milestones released

      // Verify developer received all funds
      const developerBalance = await usdc.read.balanceOf([
        developer.account.address,
      ]);
      // Note: This depends on initial balance, but we know they received 6000 USDC
      assert.equal(developerBalance >= parseUnits("6000", 6), true);
    });
  });
});

