import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits, type Address } from "viem";

import { network } from "hardhat";

describe("BuildingTokenFactory", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper function to deploy BuildingRegistry
  async function deployBuildingRegistry(owner: Address) {
    return await viem.deployContract("BuildingRegistry", [owner]);
  }

  // Helper function to deploy BuildingTokenFactory
  async function deployBuildingTokenFactory(
    owner: Address,
    buildingRegistry: Address
  ) {
    return await viem.deployContract("BuildingTokenFactory", [
      owner,
      buildingRegistry,
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
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const ownerAddress = await factory.read.owner();
      assert.equal(
        ownerAddress.toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });

    it("Should set the correct building registry", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const registryAddress = await factory.read.buildingRegistry();
      assert.equal(registryAddress.toLowerCase(), registry.address.toLowerCase());
    });

    it("Should revert if buildingRegistry is zero address", async function () {
      const [owner] = await viem.getWalletClients();

      await assert.rejects(
        viem.deployContract("BuildingTokenFactory", [
          owner.account.address,
          "0x0000000000000000000000000000000000000000",
        ]),
        /BuildingTokenFactory: buildingRegistry cannot be zero address/
      );
    });

    it("Should have zero tokens initially", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      assert.equal(await factory.read.getTotalTokensCreated(), 0n);
      const allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 0);
    });
  });

  describe("createBuildingToken", function () {
    it("Should create a token with correct parameters", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      // Create building first
      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const name = "Building Tower A Token";
      const symbol = "BTA";
      const totalSupply = parseUnits("1000000", 18); // 1M tokens

      // Create token and verify event was emitted
      await viem.assertions.emit(
        factory.write.createBuildingToken(
          [
            1n, // buildingId
            name,
            symbol,
            totalSupply,
            tokenOwner.account.address,
          ],
          { account: owner.account }
        ),
        factory,
        "BuildingTokenCreated"
      );

      // Get token address and verify it was created
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // Verify token properties
      const token = await viem.getContractAt("BuildingToken", tokenAddress);
      assert.equal(await token.read.name(), name);
      assert.equal(await token.read.symbol(), symbol);
      assert.equal(await token.read.buildingId(), 1n);
      assert.equal(
        (
          await token.read.balanceOf([tokenOwner.account.address])
        ).toString(),
        totalSupply.toString()
      );

      // Verify factory state
      assert.equal(await factory.read.getTotalTokensCreated(), 1n);
      const allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 1);
      assert.equal(allTokens[0].toLowerCase(), tokenAddress.toLowerCase());
    });

    it("Should handle token contract setting gracefully (try-catch)", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      // Create building
      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const name = "Building Tower A Token";
      const symbol = "BTA";
      const totalSupply = parseUnits("1000000", 18);

      // Create token - should succeed even if setTokenContract fails
      // (factory contract calls it, not owner/developer, so it will fail silently)
      await factory.write.createBuildingToken(
        [1n, name, symbol, totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Verify token was created successfully
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // Token contract may or may not be set in BuildingRegistry
      // (depends on whether factory contract has permission - try-catch handles it gracefully)
      const building = await registry.read.getBuilding([1n]);
      // Just verify building still exists - token contract setting is optional
      assert.equal(building[0], 1n); // building exists
    });

    it("Should not revert if setting token contract fails (non-owner/developer)", async function () {
      const [owner, developer, oracle, tokenOwner, other] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      
      // Deploy factory with different owner (not building registry owner)
      const factory = await deployBuildingTokenFactory(
        other.account.address,
        registry.address
      );

      // Create building first
      await createBuilding(
        registry,
        owner,
        "Test Building",
        "ipfs://test",
        developer.account.address,
        oracle.account.address,
        3
      );

      const name = "Building Tower A Token";
      const symbol = "BTA";
      const totalSupply = parseUnits("1000000", 18);

      // Create token - should succeed even if setting token contract fails
      await factory.write.createBuildingToken(
        [1n, name, symbol, totalSupply, tokenOwner.account.address],
        { account: other.account }
      );

      // Verify token was still created
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // Verify token contract was NOT set in BuildingRegistry (since other is not owner/developer)
      const building = await registry.read.getBuilding([1n]);
      assert.equal(
        building[5], // tokenContract
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      await assert.rejects(
        factory.write.createBuildingToken(
          [
            1n,
            "Test Token",
            "TEST",
            totalSupply,
            tokenOwner.account.address,
          ],
          { account: unauthorized.account }
        ),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if token already exists for building", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      // Create token first time
      await factory.write.createBuildingToken(
        [1n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Try to create token again for same building
      await assert.rejects(
        factory.write.createBuildingToken(
          [
            1n,
            "Another Token",
            "ANOTHER",
            totalSupply,
            tokenOwner.account.address,
          ],
          { account: owner.account }
        ),
        /BuildingTokenFactory: token already exists for this building/
      );
    });

    it("Should revert if initialOwner is zero address", async function () {
      const [owner, developer, oracle] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      await assert.rejects(
        factory.write.createBuildingToken(
          [
            1n,
            "Test Token",
            "TEST",
            totalSupply,
            "0x0000000000000000000000000000000000000000",
          ],
          { account: owner.account }
        ),
        /BuildingTokenFactory: initialOwner cannot be zero address/
      );
    });

    it("Should revert if totalSupply is zero", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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
        factory.write.createBuildingToken(
          [1n, "Test Token", "TEST", 0n, tokenOwner.account.address],
          { account: owner.account }
        ),
        /BuildingTokenFactory: totalSupply must be greater than zero/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, tokenOwner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const totalSupply = parseUnits("1000000", 18);

      await assert.rejects(
        factory.write.createBuildingToken(
          [999n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
          { account: owner.account }
        ),
        /building does not exist/
      );
    });

    it("Should create multiple tokens for different buildings", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const totalSupply = parseUnits("1000000", 18);

      // Create building 1
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create building 2
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create token for building 1
      await factory.write.createBuildingToken(
        [1n, "Building 1 Token", "B1T", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Create token for building 2
      await factory.write.createBuildingToken(
        [2n, "Building 2 Token", "B2T", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Verify both tokens exist
      const token1Address = await factory.read.getBuildingToken([1n]);
      const token2Address = await factory.read.getBuildingToken([2n]);

      assert.notEqual(token1Address, "0x0000000000000000000000000000000000000000");
      assert.notEqual(token2Address, "0x0000000000000000000000000000000000000000");
      assert.notEqual(token1Address.toLowerCase(), token2Address.toLowerCase());

      // Verify factory state
      assert.equal(await factory.read.getTotalTokensCreated(), 2n);
      const allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 2);

      // Verify tokens have correct building IDs
      const token1 = await viem.getContractAt("BuildingToken", token1Address);
      const token2 = await viem.getContractAt("BuildingToken", token2Address);
      assert.equal(await token1.read.buildingId(), 1n);
      assert.equal(await token2.read.buildingId(), 2n);
    });

    it("Should mint tokens to initial owner", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("5000000", 18); // 5M tokens

      // Create token
      await factory.write.createBuildingToken(
        [1n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Verify initial owner received all tokens
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      const token = await viem.getContractAt("BuildingToken", tokenAddress);
      const balance = await token.read.balanceOf([tokenOwner.account.address]);
      assert.equal(balance.toString(), totalSupply.toString());

      // Verify no other address has tokens
      const ownerBalance = await token.read.balanceOf([owner.account.address]);
      assert.equal(ownerBalance, 0n);
    });

    it("Should return the token address", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      // Create token and get return value
      const tx = await factory.write.createBuildingToken(
        [1n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Verify via getBuildingToken
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");
    });
  });

  describe("getBuildingToken", function () {
    it("Should return token address for existing token", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      // Create token
      await factory.write.createBuildingToken(
        [1n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // Verify it's a valid ERC20 token
      const token = await viem.getContractAt("BuildingToken", tokenAddress);
      assert.equal(await token.read.name(), "Test Token");
    });

    it("Should return zero address for non-existent token", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const tokenAddress = await factory.read.getBuildingToken([999n]);
      assert.equal(tokenAddress, "0x0000000000000000000000000000000000000000");
    });
  });

  describe("getTotalTokensCreated", function () {
    it("Should return correct count", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      // Initially zero
      assert.equal(await factory.read.getTotalTokensCreated(), 0n);

      // Create building 1
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create token for building 1
      await factory.write.createBuildingToken(
        [1n, "Token 1", "T1", parseUnits("1000000", 18), tokenOwner.account.address],
        { account: owner.account }
      );
      assert.equal(await factory.read.getTotalTokensCreated(), 1n);

      // Create building 2
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create token for building 2
      await factory.write.createBuildingToken(
        [2n, "Token 2", "T2", parseUnits("1000000", 18), tokenOwner.account.address],
        { account: owner.account }
      );
      assert.equal(await factory.read.getTotalTokensCreated(), 2n);
    });
  });

  describe("getAllTokens", function () {
    it("Should return all token addresses", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      // Initially empty
      const initialTokens = await factory.read.getAllTokens();
      assert.equal(initialTokens.length, 0);

      // Create building 1
      await createBuilding(
        registry,
        owner,
        "Building 1",
        "ipfs://1",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create token for building 1
      await factory.write.createBuildingToken(
        [1n, "Token 1", "T1", parseUnits("1000000", 18), tokenOwner.account.address],
        { account: owner.account }
      );

      const token1Address = await factory.read.getBuildingToken([1n]);
      let allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 1);
      assert.equal(allTokens[0].toLowerCase(), token1Address.toLowerCase());

      // Create building 2
      await createBuilding(
        registry,
        owner,
        "Building 2",
        "ipfs://2",
        developer.account.address,
        oracle.account.address,
        3
      );

      // Create token for building 2
      await factory.write.createBuildingToken(
        [2n, "Token 2", "T2", parseUnits("1000000", 18), tokenOwner.account.address],
        { account: owner.account }
      );

      const token2Address = await factory.read.getBuildingToken([2n]);
      allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 2);
      assert.equal(allTokens[0].toLowerCase(), token1Address.toLowerCase());
      assert.equal(allTokens[1].toLowerCase(), token2Address.toLowerCase());
    });

    it("Should maintain order of token creation", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

      const tokenAddresses: Address[] = [];

      // Create multiple buildings and tokens
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

        await factory.write.createBuildingToken(
          [
            BigInt(i),
            `Token ${i}`,
            `T${i}`,
            parseUnits("1000000", 18),
            tokenOwner.account.address,
          ],
          { account: owner.account }
        );

        const tokenAddress = await factory.read.getBuildingToken([BigInt(i)]);
        tokenAddresses.push(tokenAddress);
      }

      // Verify order
      const allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 3);
      for (let i = 0; i < 3; i++) {
        assert.equal(
          allTokens[i].toLowerCase(),
          tokenAddresses[i].toLowerCase()
        );
      }
    });
  });

  describe("buildingTokens mapping", function () {
    it("Should allow direct access to token address via public mapping", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
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

      const totalSupply = parseUnits("1000000", 18);

      // Create token
      await factory.write.createBuildingToken(
        [1n, "Test Token", "TEST", totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // Access via public mapping
      const tokenAddress = await factory.read.buildingTokens([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // Verify it matches getBuildingToken
      const tokenAddressViaGetter = await factory.read.getBuildingToken([1n]);
      assert.equal(tokenAddress.toLowerCase(), tokenAddressViaGetter.toLowerCase());
    });
  });

  describe("Integration tests", function () {
    it("Should handle complete token creation lifecycle", async function () {
      const [owner, developer, oracle, tokenOwner] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const factory = await deployBuildingTokenFactory(
        owner.account.address,
        registry.address
      );

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

      // 2. Create token
      const name = "Lifecycle Token";
      const symbol = "LIFE";
      const totalSupply = parseUnits("10000000", 18); // 10M tokens

      await factory.write.createBuildingToken(
        [1n, name, symbol, totalSupply, tokenOwner.account.address],
        { account: owner.account }
      );

      // 3. Verify token was created and registered
      const tokenAddress = await factory.read.getBuildingToken([1n]);
      assert.notEqual(tokenAddress, "0x0000000000000000000000000000000000000000");

      // 4. Verify token properties
      const token = await viem.getContractAt("BuildingToken", tokenAddress);
      assert.equal(await token.read.name(), name);
      assert.equal(await token.read.symbol(), symbol);
      assert.equal(await token.read.buildingId(), 1n);
      assert.equal(
        (
          await token.read.balanceOf([tokenOwner.account.address])
        ).toString(),
        totalSupply.toString()
      );
      assert.equal(
        (await token.read.owner()).toLowerCase(),
        tokenOwner.account.address.toLowerCase()
      );

      // 5. Verify factory state
      assert.equal(await factory.read.getTotalTokensCreated(), 1n);
      const allTokens = await factory.read.getAllTokens();
      assert.equal(allTokens.length, 1);
      assert.equal(allTokens[0].toLowerCase(), tokenAddress.toLowerCase());

      // 6. Verify token contract may or may not be set in BuildingRegistry
      // (depends on whether factory owner has permission - try-catch handles gracefully)
      const building = await registry.read.getBuilding([1n]);
      // Token contract may be set if factory owner is building's developer or registry owner
      // Otherwise, the try-catch will silently fail, which is expected behavior
      // We just verify the building still exists and the token was created
      assert.equal(building[0], 1n); // building exists
    });
  });
});

