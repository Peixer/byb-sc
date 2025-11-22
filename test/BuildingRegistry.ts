import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, type Address } from "viem";

import { network } from "hardhat";

describe("BuildingRegistry", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper function to deploy BuildingRegistry
  async function deployBuildingRegistry(owner: Address) {
    return await viem.deployContract("BuildingRegistry", [owner]);
  }

  // Helper function to create a building
  async function createBuilding(
    registry: any,
    signer: any,
    name: string = "Test Building",
    metadataURI: string = "ipfs://test",
    developer: Address,
    oracle: Address,
    totalMilestones: number = 5,
    description: string = "Test description",
    location: string = "Test location",
    featured: boolean = false
  ) {
    return await registry.write.createBuilding(
      [name, metadataURI, developer, oracle, totalMilestones, description, location, featured],
      { account: signer.account }
    );
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const ownerAddress = await registry.read.owner();
      assert.equal(
        ownerAddress.toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });
  });

  describe("createBuilding", function () {
    it("Should create a building with correct parameters", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const name = "Test Building";
      const metadataURI = "ipfs://test123";
      const totalMilestones = 5;

      await viem.assertions.emitWithArgs(
        registry.write.createBuilding(
          [name, metadataURI, developer.account.address, oracle.account.address, totalMilestones, "Test description", "Test location", false],
          { account: owner.account }
        ),
        registry,
        "BuildingCreated",
        [1n, getAddress(developer.account.address)]
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[0], 1n); // id
      assert.equal(building[1], name);
      assert.equal(building[2], metadataURI);
      assert.equal(building[3].toLowerCase(), developer.account.address.toLowerCase());
      assert.equal(building[4].toLowerCase(), oracle.account.address.toLowerCase());
      assert.equal(building[5], "0x0000000000000000000000000000000000000000"); // tokenContract
      assert.equal(building[6], 0); // Status.Draft
      assert.equal(building[7], totalMilestones);
      assert.equal(building[8], 0); // currentMilestone
      assert.equal(building[9], true); // exists
    });

    it("Should auto-increment building IDs", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );

      const building1 = await registry.read.getBuilding([1n]);
      const building2 = await registry.read.getBuilding([2n]);

      assert.equal(building1[0], 1n);
      assert.equal(building2[0], 2n);
      assert.equal(await registry.read.getNextBuildingId(), 3n);
    });

    it("Should allow admin to create building", async function () {
      const [owner, admin, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Set admin
      await registry.write.setAdmin([admin.account.address, true], { account: owner.account });

      // Admin creates building
      await createBuilding(
        registry,
        admin,
        "Admin Building",
        "ipfs://admin",
        developer.account.address,
        oracle.account.address,
        3
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[1], "Admin Building");
    });

    it("Should allow anyone to create building", async function () {
      const [owner, unauthorized, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const name = "Unauthorized Building";
      const metadataURI = "ipfs://unauthorized";
      const totalMilestones = 3;

      await viem.assertions.emitWithArgs(
        registry.write.createBuilding(
          [name, metadataURI, developer.account.address, oracle.account.address, totalMilestones, "Test description", "Test location", false],
          { account: unauthorized.account }
        ),
        registry,
        "BuildingCreated",
        [1n, getAddress(developer.account.address)]
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[0], 1n); // id
      assert.equal(building[1], name);
      assert.equal(building[2], metadataURI);
      assert.equal(building[3].toLowerCase(), developer.account.address.toLowerCase());
      assert.equal(building[4].toLowerCase(), oracle.account.address.toLowerCase());
      assert.equal(building[6], 0); // Status.Draft
      assert.equal(building[7], totalMilestones);
      assert.equal(building[9], true); // exists
    });

    it("Should revert if totalMilestones is zero", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        createBuilding(
          registry,
          owner,
          "Test Building",
          "ipfs://test",
          developer.account.address,
          oracle.account.address,
          0
        ),
        /BuildingRegistry: totalMilestones must be > 0/
      );
    });

    it("Should revert if developer is zero address", async function () {
      const [owner, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        createBuilding(
          registry,
          owner,
          "Test Building",
          "ipfs://test",
          "0x0000000000000000000000000000000000000000",
          oracle.account.address,
          3
        ),
        /BuildingRegistry: developer cannot be zero address/
      );
    });

    it("Should revert if oracle is zero address", async function () {
      const [owner, developer] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        createBuilding(
          registry,
          owner,
          "Test Building",
          "ipfs://test",
          developer.account.address,
          "0x0000000000000000000000000000000000000000",
          3
        ),
        /BuildingRegistry: oracle cannot be zero address/
      );
    });
  });

  describe("setTokenContract", function () {
    it("Should set token contract address", async function () {
      const [owner, developer, oracle, tokenContract] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      await registry.write.setTokenContract(
        [1n, tokenContract.account.address],
        { account: developer.account }
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(
        building[5].toLowerCase(),
        tokenContract.account.address.toLowerCase()
      );
    });

    it("Should allow owner to set token contract", async function () {
      const [owner, developer, oracle, tokenContract] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      await registry.write.setTokenContract(
        [1n, tokenContract.account.address],
        { account: owner.account }
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(
        building[5].toLowerCase(),
        tokenContract.account.address.toLowerCase()
      );
    });

    it("Should revert if non-owner/non-developer tries to set token contract", async function () {
      const [owner, developer, oracle, unauthorized, tokenContract] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

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
        registry.write.setTokenContract(
          [1n, tokenContract.account.address],
          { account: unauthorized.account }
        ),
        /BuildingRegistry: caller is not owner or developer/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, developer, tokenContract] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Use owner account since developer check happens before building existence check
      await assert.rejects(
        registry.write.setTokenContract(
          [999n, tokenContract.account.address],
          { account: owner.account }
        ),
        /BuildingRegistry: building does not exist/
      );
    });

    it("Should revert if tokenContract is zero address", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

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
        registry.write.setTokenContract(
          [1n, "0x0000000000000000000000000000000000000000"],
          { account: developer.account }
        ),
        /BuildingRegistry: tokenContract cannot be zero address/
      );
    });
  });

  describe("confirmMilestone", function () {
    it("Should confirm milestone and increment currentMilestone", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const deploymentBlockNumber = await publicClient.getBlockNumber();

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        5
      );

      // Confirm first milestone
      await viem.assertions.emitWithArgs(
        registry.write.confirmMilestone([1n], { account: oracle.account }),
        registry,
        "MilestoneConfirmed",
        [1n, 1]
      );

      let building = await registry.read.getBuilding([1n]);
      assert.equal(building[8], 1); // currentMilestone

      // Confirm second milestone
      await registry.write.confirmMilestone([1n], { account: oracle.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[8], 2); // currentMilestone
    });

    it("Should revert if non-oracle tries to confirm milestone", async function () {
      const [owner, developer, oracle, unauthorized] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        5
      );

      await assert.rejects(
        async () => {
          await registry.write.confirmMilestone([1n], { account: unauthorized.account });
        },
        (error: any) => {
          const errorMessage = error?.message || error?.shortMessage || String(error);
          return /caller is not the oracle|Transaction reverted/.test(errorMessage);
        }
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create a building first
      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Try to confirm milestone for non-existent building
      // Note: The onlyOracle modifier checks first, so for a non-existent building,
      // it will fail with "caller is not the oracle" since buildings[999].oracle is address(0)
      // The existence check happens after the modifier, so it won't be reached
      await assert.rejects(
        async () => {
          await registry.write.confirmMilestone([999n], { account: oracle.account });
        },
        (error: any) => {
          const errorMessage = error?.message || error?.shortMessage || String(error);
          return /caller is not the oracle|Transaction reverted/.test(errorMessage);
        }
      );
    });

    it("Should revert if all milestones are already confirmed", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        2
      );

      // Confirm both milestones
      await registry.write.confirmMilestone([1n], { account: oracle.account });
      await registry.write.confirmMilestone([1n], { account: oracle.account });

      // Try to confirm again
      await assert.rejects(
        registry.write.confirmMilestone([1n], { account: oracle.account }),
        /BuildingRegistry: all milestones already confirmed/
      );
    });
  });

  describe("updateStatus", function () {
    it("Should update building status", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Update to Published
      await viem.assertions.emitWithArgs(
        registry.write.updateStatus([1n, 1], { account: developer.account }), // Status.Published = 1
        registry,
        "BuildingStatusUpdated",
        [1n, 1]
      );

      let building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 1); // Status.Published

      // Update to OpenForSale
      await registry.write.updateStatus([1n, 2], { account: developer.account }); // Status.OpenForSale = 2
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 2); // Status.OpenForSale

      // Update to Closed
      await registry.write.updateStatus([1n, 3], { account: developer.account }); // Status.Closed = 3
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 3); // Status.Closed
    });

    it("Should allow owner to update status", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      await registry.write.updateStatus([1n, 1], { account: owner.account });
      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 1); // Status.Published
    });

    it("Should revert if non-owner/non-developer tries to update status", async function () {
      const [owner, developer, oracle, unauthorized] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

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
        registry.write.updateStatus([1n, 1], { account: unauthorized.account }),
        /BuildingRegistry: caller is not owner or developer/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Use owner account since developer check happens before building existence check
      await assert.rejects(
        registry.write.updateStatus([999n, 1], { account: owner.account }),
        /BuildingRegistry: building does not exist/
      );
    });
  });

  describe("getBuilding", function () {
    it("Should return correct building data", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const name = "Test Building";
      const metadataURI = "ipfs://test123";
      const totalMilestones = 5;

      await createBuilding(
        registry,
        owner,
        name,
        metadataURI,
        developer.account.address,
        oracle.account.address,
        totalMilestones
      );

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[0], 1n); // id
      assert.equal(building[1], name);
      assert.equal(building[2], metadataURI);
      assert.equal(building[3].toLowerCase(), developer.account.address.toLowerCase());
      assert.equal(building[4].toLowerCase(), oracle.account.address.toLowerCase());
      assert.equal(building[5], "0x0000000000000000000000000000000000000000"); // tokenContract
      assert.equal(building[6], 0); // Status.Draft
      assert.equal(building[7], totalMilestones);
      assert.equal(building[8], 0); // currentMilestone
      assert.equal(building[9], true); // exists
    });

    it("Should revert if building does not exist", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        registry.read.getBuilding([999n]),
        /BuildingRegistry: building does not exist/
      );
    });
  });

  describe("setAdmin", function () {
    it("Should add an admin", async function () {
      const [owner, admin] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await viem.assertions.emitWithArgs(
        registry.write.setAdmin([admin.account.address, true], { account: owner.account }),
        registry,
        "AdminUpdated",
        [getAddress(admin.account.address), true]
      );

      assert.equal(await registry.read.admins([admin.account.address]), true);
    });

    it("Should remove an admin", async function () {
      const [owner, admin] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Add admin
      await registry.write.setAdmin([admin.account.address, true], { account: owner.account });
      assert.equal(await registry.read.admins([admin.account.address]), true);

      // Remove admin
      await registry.write.setAdmin([admin.account.address, false], { account: owner.account });
      assert.equal(await registry.read.admins([admin.account.address]), false);
    });

    it("Should revert if non-owner tries to set admin", async function () {
      const [owner, unauthorized, admin] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        registry.write.setAdmin([admin.account.address, true], { account: unauthorized.account }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if admin address is zero", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        registry.write.setAdmin(["0x0000000000000000000000000000000000000000", true], { account: owner.account }),
        /BuildingRegistry: admin cannot be zero address/
      );
    });
  });

  describe("getNextBuildingId", function () {
    it("Should return correct next building ID", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Initially should be 1
      assert.equal(await registry.read.getNextBuildingId(), 1n);

      // After creating a building, should be 2
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );
      assert.equal(await registry.read.getNextBuildingId(), 2n);

      // After creating another building, should be 3
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );
      assert.equal(await registry.read.getNextBuildingId(), 3n);
    });
  });

  describe("getTotalBuildings", function () {
    it("Should return 0 when no buildings exist", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      assert.equal(await registry.read.getTotalBuildings(), 0n);
    });

    it("Should return correct total after creating buildings", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Initially 0
      assert.equal(await registry.read.getTotalBuildings(), 0n);

      // After creating one building
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );
      assert.equal(await registry.read.getTotalBuildings(), 1n);

      // After creating another building
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );
      assert.equal(await registry.read.getTotalBuildings(), 2n);

      // After creating a third building
      await createBuilding(
        registry,
        owner,
        "Building 3",
        "ipfs://3",
        developer.account.address,
        oracle.account.address,
        3
      );
      assert.equal(await registry.read.getTotalBuildings(), 3n);
    });
  });

  describe("listBuildingIds", function () {
    it("Should return empty array when no buildings exist", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const buildingIds = await registry.read.listBuildingIds();
      assert.equal(buildingIds.length, 0);
    });

    it("Should return single building ID", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      const buildingIds = await registry.read.listBuildingIds();
      assert.equal(buildingIds.length, 1);
      assert.equal(buildingIds[0], 1n);
    });

    it("Should return all building IDs in order", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create multiple buildings
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );
      await createBuilding(
        registry,
        owner,
        "Building 3",
        "ipfs://3",
        developer.account.address,
        oracle.account.address,
        3
      );

      const buildingIds = await registry.read.listBuildingIds();
      assert.equal(buildingIds.length, 3);
      assert.equal(buildingIds[0], 1n);
      assert.equal(buildingIds[1], 2n);
      assert.equal(buildingIds[2], 3n);
    });

    it("Should return correct IDs for many buildings", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create 10 buildings
      for (let i = 1; i <= 10; i++) {
        await createBuilding(
          registry,
          owner,
          `Building ${i}`,
          `ipfs://${i}`,
          developer.account.address,
          oracle.account.address,
          3
        );
      }

      const buildingIds = await registry.read.listBuildingIds();
      assert.equal(buildingIds.length, 10);
      for (let i = 0; i < 10; i++) {
        assert.equal(buildingIds[i], BigInt(i + 1));
      }
    });
  });

  describe("listBuildings", function () {
    it("Should return empty array when no buildings exist", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      const [buildingIds, total] = await registry.read.listBuildings([0n, 10n]);
      assert.equal(buildingIds.length, 0);
      assert.equal(total, 0n);
    });

    it("Should return empty array when offset exceeds total", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      const [buildingIds, total] = await registry.read.listBuildings([10n, 5n]);
      assert.equal(buildingIds.length, 0);
      assert.equal(total, 1n);
    });

    it("Should return single building with offset 0", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      const [buildingIds, total] = await registry.read.listBuildings([0n, 10n]);
      assert.equal(buildingIds.length, 1);
      assert.equal(buildingIds[0], 1n);
      assert.equal(total, 1n);
    });

    it("Should return correct paginated results", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create 5 buildings
      for (let i = 1; i <= 5; i++) {
        await createBuilding(
          registry,
          owner,
          `Building ${i}`,
          `ipfs://${i}`,
          developer.account.address,
          oracle.account.address,
          3
        );
      }

      // First page: offset 0, limit 2
      let [buildingIds, total] = await registry.read.listBuildings([0n, 2n]);
      assert.equal(buildingIds.length, 2);
      assert.equal(buildingIds[0], 1n);
      assert.equal(buildingIds[1], 2n);
      assert.equal(total, 5n);

      // Second page: offset 2, limit 2
      [buildingIds, total] = await registry.read.listBuildings([2n, 2n]);
      assert.equal(buildingIds.length, 2);
      assert.equal(buildingIds[0], 3n);
      assert.equal(buildingIds[1], 4n);
      assert.equal(total, 5n);

      // Third page: offset 4, limit 2 (should return only 1)
      [buildingIds, total] = await registry.read.listBuildings([4n, 2n]);
      assert.equal(buildingIds.length, 1);
      assert.equal(buildingIds[0], 5n);
      assert.equal(total, 5n);
    });

    it("Should handle limit larger than available buildings", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create 3 buildings
      for (let i = 1; i <= 3; i++) {
        await createBuilding(
          registry,
          owner,
          `Building ${i}`,
          `ipfs://${i}`,
          developer.account.address,
          oracle.account.address,
          3
        );
      }

      // Request 10 but only 3 exist
      const [buildingIds, total] = await registry.read.listBuildings([0n, 10n]);
      assert.equal(buildingIds.length, 3);
      assert.equal(buildingIds[0], 1n);
      assert.equal(buildingIds[1], 2n);
      assert.equal(buildingIds[2], 3n);
      assert.equal(total, 3n);
    });

    it("Should handle pagination with offset in middle", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create 10 buildings
      for (let i = 1; i <= 10; i++) {
        await createBuilding(
          registry,
          owner,
          `Building ${i}`,
          `ipfs://${i}`,
          developer.account.address,
          oracle.account.address,
          3
        );
      }

      // Get middle section: offset 3, limit 4
      const [buildingIds, total] = await registry.read.listBuildings([3n, 4n]);
      assert.equal(buildingIds.length, 4);
      assert.equal(buildingIds[0], 4n);
      assert.equal(buildingIds[1], 5n);
      assert.equal(buildingIds[2], 6n);
      assert.equal(buildingIds[3], 7n);
      assert.equal(total, 10n);
    });

    it("Should return empty array when offset equals total", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // Create 3 buildings
      for (let i = 1; i <= 3; i++) {
        await createBuilding(
          registry,
          owner,
          `Building ${i}`,
          `ipfs://${i}`,
          developer.account.address,
          oracle.account.address,
          3
        );
      }

      // Offset equals total (3)
      const [buildingIds, total] = await registry.read.listBuildings([3n, 5n]);
      assert.equal(buildingIds.length, 0);
      assert.equal(total, 3n);
    });

    it("Should handle zero limit", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      const [buildingIds, total] = await registry.read.listBuildings([0n, 0n]);
      assert.equal(buildingIds.length, 0);
      assert.equal(total, 1n);
    });
  });

  describe("buildings mapping", function () {
    it("Should allow direct access to building data via public mapping", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        5
      );

      // Access building via public mapping
      // Struct order: id, name, metadataURI, description, location, developer, oracle, tokenContract, status, totalMilestones, currentMilestone, exists, featured
      const building = await registry.read.buildings([1n]);
      assert.equal(building[0], 1n); // id
      assert.equal(building[1], "Test Building"); // name
      assert.equal(building[2], "ipfs://test"); // metadataURI
      assert.equal(building[3], "Test description"); // description
      assert.equal(building[4], "Test location"); // location
      assert.equal(building[5].toLowerCase(), developer.account.address.toLowerCase()); // developer
      assert.equal(building[6].toLowerCase(), oracle.account.address.toLowerCase()); // oracle
      assert.equal(building[7], "0x0000000000000000000000000000000000000000"); // tokenContract
      assert.equal(building[8], 0); // Status.Draft
      assert.equal(building[9], 5); // totalMilestones
      assert.equal(building[10], 0); // currentMilestone
      assert.equal(building[11], true); // exists
      assert.equal(building[12], false); // featured
    });
  });

  describe("Integration tests", function () {
    it("Should handle complete building lifecycle", async function () {
      const [owner, developer, oracle, tokenContract] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      // 1. Create building
      await createBuilding(
        registry,
        owner,
        "Lifecycle Building",
        "ipfs://lifecycle",
        developer.account.address,
        oracle.account.address,
        3
      );

      let building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 0); // Status.Draft

      // 2. Set token contract
      await registry.write.setTokenContract(
        [1n, tokenContract.account.address],
        { account: developer.account }
      );

      // 3. Update status to Published
      await registry.write.updateStatus([1n, 1], { account: developer.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 1); // Status.Published

      // 4. Update status to OpenForSale
      await registry.write.updateStatus([1n, 2], { account: developer.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 2); // Status.OpenForSale

      // 5. Confirm milestones
      await registry.write.confirmMilestone([1n], { account: oracle.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[8], 1);

      await registry.write.confirmMilestone([1n], { account: oracle.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[8], 2);

      await registry.write.confirmMilestone([1n], { account: oracle.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[8], 3);

      // 6. Update status to Closed
      await registry.write.updateStatus([1n, 3], { account: developer.account });
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 3); // Status.Closed
    });
  });
});

