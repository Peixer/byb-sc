import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits, type Address } from "viem";

import { network } from "hardhat";

describe("BuildingSaleManager", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Helper function to deploy BuildingRegistry
  async function deployBuildingRegistry(owner: Address) {
    return await viem.deployContract("BuildingRegistry", [owner]);
  }

  // Helper function to deploy MockERC20 (quote token like USDC)
  async function deployMockUSDC() {
    return await viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6, // decimals
      parseUnits("1000000", 6), // 1M USDC initial supply
    ]);
  }

  // Helper function to deploy BuildingToken
  async function deployBuildingToken(
    buildingId: bigint,
    totalSupply: bigint,
    owner: Address
  ) {
    return await viem.deployContract("BuildingToken", [
      `Building ${buildingId} Token`,
      `B${buildingId}T`,
      totalSupply,
      buildingId,
      owner,
    ]);
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

  // Helper function to deploy BuildingSaleManager
  async function deployBuildingSaleManager(
    owner: Address,
    buildingRegistry: Address,
    tokenTreasury: Address
  ) {
    return await viem.deployContract("BuildingSaleManager", [
      owner,
      buildingRegistry,
      tokenTreasury,
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

  // Helper function to setup a complete sale scenario
  async function setupSale(
    owner: any,
    developer: any,
    oracle: any,
    treasury: any,
    maxTokensForSale: bigint = parseUnits("1000000", 18),
    tokenPrice: bigint = parseUnits("1", 6) // 1 USDC per token (accounting for decimals)
  ) {
    const registry = await deployBuildingRegistry(owner.account.address);
    const usdc = await deployMockUSDC();
    const saleManager = await deployBuildingSaleManager(
      owner.account.address,
      registry.address,
      treasury.account.address
    );

    // Transfer ownership of BuildingRegistry to BuildingSaleManager
    // This allows BuildingSaleManager to call updateStatus on the registry
    await registry.write.transferOwnership([saleManager.address], {
      account: owner.account,
    });

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

    // Deploy building token
    const buildingToken = await deployBuildingToken(
      1n,
      maxTokensForSale,
      treasury.account.address
    );

    // Configure sale
    await saleManager.write.configureSale(
      [
        1n,
        buildingToken.address,
        usdc.address,
        tokenPrice,
        maxTokensForSale,
      ],
      { account: owner.account }
    );

    return {
      registry,
      usdc,
      saleManager,
      buildingToken,
      buildingId: 1n,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      const ownerAddress = await saleManager.read.owner();
      assert.equal(
        ownerAddress.toLowerCase(),
        owner.account.address.toLowerCase()
      );
    });

    it("Should set the correct building registry", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      const registryAddress = await saleManager.read.buildingRegistry();
      assert.equal(registryAddress.toLowerCase(), registry.address.toLowerCase());
    });

    it("Should set the correct token treasury", async function () {
      const [owner, treasury] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      const treasuryAddress = await saleManager.read.tokenTreasury();
      assert.equal(
        treasuryAddress.toLowerCase(),
        treasury.account.address.toLowerCase()
      );
    });

    it("Should revert if buildingRegistry is zero address", async function () {
      const [owner, treasury] = await viem.getWalletClients();

      await assert.rejects(
        viem.deployContract("BuildingSaleManager", [
          owner.account.address,
          "0x0000000000000000000000000000000000000000",
          treasury.account.address,
        ]),
        /BuildingSaleManager: buildingRegistry cannot be zero address/
      );
    });

    it("Should revert if tokenTreasury is zero address", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);

      await assert.rejects(
        viem.deployContract("BuildingSaleManager", [
          owner.account.address,
          registry.address,
          "0x0000000000000000000000000000000000000000",
        ]),
        /BuildingSaleManager: tokenTreasury cannot be zero address/
      );
    });
  });

  describe("configureSale", function () {
    it("Should configure a sale with correct parameters", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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

      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      const tokenPrice = parseUnits("1", 6);
      const maxTokensForSale = parseUnits("1000000", 18);

      await viem.assertions.emitWithArgs(
        saleManager.write.configureSale(
          [
            1n,
            buildingToken.address,
            usdc.address,
            tokenPrice,
            maxTokensForSale,
          ],
          { account: owner.account }
        ),
        saleManager,
        "SaleConfigured",
        [1n, getAddress(buildingToken.address), getAddress(usdc.address)]
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.buildingId, 1n);
      assert.equal(
        sale.buildingToken.toLowerCase(),
        buildingToken.address.toLowerCase()
      );
      assert.equal(sale.quoteToken.toLowerCase(), usdc.address.toLowerCase());
      assert.equal(sale.tokenPrice, tokenPrice);
      assert.equal(sale.maxTokensForSale, maxTokensForSale);
      assert.equal(sale.tokensSold, 0n);
      assert.equal(sale.published, false);
      assert.equal(sale.open, false);
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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

      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await assert.rejects(
        saleManager.write.configureSale(
          [
            1n,
            buildingToken.address,
            usdc.address,
            parseUnits("1", 6),
            parseUnits("1000000", 18),
          ],
          { account: unauthorized.account }
        ),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if buildingToken is zero address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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
        saleManager.write.configureSale(
          [
            1n,
            "0x0000000000000000000000000000000000000000",
            usdc.address,
            parseUnits("1", 6),
            parseUnits("1000000", 18),
          ],
          { account: owner.account }
        ),
        /BuildingSaleManager: buildingToken cannot be zero address/
      );
    });

    it("Should revert if quoteToken is zero address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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

      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await assert.rejects(
        saleManager.write.configureSale(
          [
            1n,
            buildingToken.address,
            "0x0000000000000000000000000000000000000000",
            parseUnits("1", 6),
            parseUnits("1000000", 18),
          ],
          { account: owner.account }
        ),
        /BuildingSaleManager: quoteToken cannot be zero address/
      );
    });

    it("Should revert if tokenPrice is zero", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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

      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await assert.rejects(
        saleManager.write.configureSale(
          [
            1n,
            buildingToken.address,
            usdc.address,
            0n,
            parseUnits("1000000", 18),
          ],
          { account: owner.account }
        ),
        /BuildingSaleManager: tokenPrice must be > 0/
      );
    });

    it("Should revert if maxTokensForSale is zero", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
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

      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await assert.rejects(
        saleManager.write.configureSale(
          [1n, buildingToken.address, usdc.address, parseUnits("1", 6), 0n],
          { account: owner.account }
        ),
        /BuildingSaleManager: maxTokensForSale must be > 0/
      );
    });

    it("Should revert if building does not exist", async function () {
      const [owner, treasury] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      const buildingToken = await deployBuildingToken(
        999n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await assert.rejects(
        saleManager.write.configureSale(
          [
            999n,
            buildingToken.address,
            usdc.address,
            parseUnits("1", 6),
            parseUnits("1000000", 18),
          ],
          { account: owner.account }
        ),
        /building does not exist/
      );
    });
  });

  describe("publishSale", function () {
    it("Should publish a sale and update building status", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager, registry } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await viem.assertions.emitWithArgs(
        saleManager.write.publishSale([1n], { account: owner.account }),
        saleManager,
        "SalePublished",
        [1n]
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.published, true);

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 1); // Status.Published
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.publishSale([1n], { account: unauthorized.account }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if sale not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      await assert.rejects(
        saleManager.write.publishSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale not configured/
      );
    });

    it("Should revert if sale already published", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });

      await assert.rejects(
        saleManager.write.publishSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale already published/
      );
    });
  });

  describe("openSale", function () {
    it("Should open a sale and update building status", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager, registry } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });

      await viem.assertions.emitWithArgs(
        saleManager.write.openSale([1n], { account: owner.account }),
        saleManager,
        "SaleOpened",
        [1n]
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.open, true);

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 2); // Status.OpenForSale
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });

      await assert.rejects(
        saleManager.write.openSale([1n], { account: unauthorized.account }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if sale not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      await assert.rejects(
        saleManager.write.openSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale not configured/
      );
    });

    it("Should revert if sale not published", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.openSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale must be published first/
      );
    });

    it("Should revert if sale already open", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      await assert.rejects(
        saleManager.write.openSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale already open/
      );
    });
  });

  describe("closeSale", function () {
    it("Should close a sale and update building status", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager, registry } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      await viem.assertions.emitWithArgs(
        saleManager.write.closeSale([1n], { account: owner.account }),
        saleManager,
        "SaleClosed",
        [1n]
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.open, false);

      const building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 3); // Status.Closed
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      await assert.rejects(
        saleManager.write.closeSale([1n], { account: unauthorized.account }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if sale not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      await assert.rejects(
        saleManager.write.closeSale([1n], { account: owner.account }),
        /BuildingSaleManager: sale not configured/
      );
    });
  });

  describe("buyTokens", function () {
    it("Should allow buying tokens when sale is open", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // Mint USDC to buyer and approve
      const quoteAmount = parseUnits("1000", 6); // 1000 USDC
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      // Approve building token transfer from treasury
      const tokensToBuy = quoteAmount / parseUnits("1", 6); // 1000 tokens
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy],
        { account: treasury.account }
      );

      const buyerBalanceBefore = await buildingToken.read.balanceOf([
        buyer.account.address,
      ]);
      const saleBefore = await saleManager.read.getSale([1n]);

      await viem.assertions.emitWithArgs(
        saleManager.write.buyTokens([1n, quoteAmount], {
          account: buyer.account,
        }),
        saleManager,
        "TokensPurchased",
        [1n, getAddress(buyer.account.address), tokensToBuy, quoteAmount]
      );

      const buyerBalanceAfter = await buildingToken.read.balanceOf([
        buyer.account.address,
      ]);
      assert.equal(
        buyerBalanceAfter - buyerBalanceBefore,
        tokensToBuy
      );

      const saleAfter = await saleManager.read.getSale([1n]);
      assert.equal(saleAfter.tokensSold, saleBefore.tokensSold + tokensToBuy);
    });

    it("Should deposit funds to escrow if EscrowManager is set", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      // Deploy EscrowManager
      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      // Set EscrowManager in SaleManager
      await saleManager.write.setEscrowManager([escrowManager.address], {
        account: owner.account,
      });

      // Create building and configure escrow
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
      await escrowManager.write.configureEscrow(
        [1n, developer.account.address, milestoneAmounts],
        { account: owner.account }
      );

      // Setup sale
      const buildingToken = await deployBuildingToken(
        1n,
        parseUnits("1000000", 18),
        treasury.account.address
      );

      await saleManager.write.configureSale(
        [
          1n,
          buildingToken.address,
          usdc.address,
          parseUnits("1", 6),
          parseUnits("1000000", 18),
        ],
        { account: owner.account }
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // Mint USDC to buyer and approve
      const quoteAmount = parseUnits("1000", 6);
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      // Approve building token transfer from treasury
      const tokensToBuy = quoteAmount / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy],
        { account: treasury.account }
      );

      // Buy tokens
      await saleManager.write.buyTokens([1n, quoteAmount], {
        account: buyer.account,
      });

      // Verify funds were deposited to escrow
      const escrowInfo = await escrowManager.read.getEscrowInfo([1n]);
      assert.equal(escrowInfo[0], quoteAmount); // totalEscrowed
    });

    it("Should revert if sale is not open", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      // Sale not opened

      const quoteAmount = parseUnits("1000", 6);
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      await assert.rejects(
        saleManager.write.buyTokens([1n, quoteAmount], {
          account: buyer.account,
        }),
        /BuildingSaleManager: sale is not open/
      );
    });

    it("Should revert if quoteAmount is zero", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      await assert.rejects(
        saleManager.write.buyTokens([1n, 0n], { account: buyer.account }),
        /BuildingSaleManager: quoteAmount must be > 0/
      );
    });

    it("Should revert if quoteAmount too small to buy any tokens", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc } = await setupSale(
        owner,
        developer,
        oracle,
        treasury,
        parseUnits("1000000", 18),
        parseUnits("1000", 6) // Very high price
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      const quoteAmount = parseUnits("1", 6); // Too small
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      await assert.rejects(
        saleManager.write.buyTokens([1n, quoteAmount], {
          account: buyer.account,
        }),
        /BuildingSaleManager: quoteAmount too small to buy any tokens/
      );
    });

    it("Should revert if insufficient tokens available", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury,
        parseUnits("1000", 18) // Small max
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // Try to buy more than available
      const quoteAmount = parseUnits("2000", 6); // Would buy 2000 tokens
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      await buildingToken.write.approve(
        [saleManager.address, parseUnits("2000", 18)],
        { account: treasury.account }
      );

      await assert.rejects(
        saleManager.write.buyTokens([1n, quoteAmount], {
          account: buyer.account,
        }),
        /BuildingSaleManager: insufficient tokens available for sale/
      );
    });
  });

  describe("buybackTokens", function () {
    it("Should allow developer to buy back tokens", async function () {
      const [owner, developer, oracle, treasury, investor] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // First, investor buys some tokens
      const quoteAmount = parseUnits("1000", 6);
      await usdc.write.mint([investor.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: investor.account }
      );

      const tokensToBuy = quoteAmount / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy],
        { account: treasury.account }
      );

      await saleManager.write.buyTokens([1n, quoteAmount], {
        account: investor.account,
      });

      // Now developer buys back tokens
      const buybackAmount = parseUnits("500", 18); // Half of what investor bought
      const quoteNeeded = buybackAmount * parseUnits("1", 6);

      await usdc.write.mint([developer.account.address, quoteNeeded], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteNeeded],
        { account: developer.account }
      );

      await buildingToken.write.approve(
        [saleManager.address, buybackAmount],
        { account: investor.account }
      );

      const investorBalanceBefore = await buildingToken.read.balanceOf([
        investor.account.address,
      ]);
      const developerBalanceBefore = await buildingToken.read.balanceOf([
        developer.account.address,
      ]);

      await viem.assertions.emitWithArgs(
        saleManager.write.buybackTokens(
          [1n, investor.account.address, buybackAmount],
          { account: developer.account }
        ),
        saleManager,
        "TokensBoughtBack",
        [
          1n,
          getAddress(developer.account.address),
          getAddress(investor.account.address),
          buybackAmount,
          quoteNeeded,
        ]
      );

      const investorBalanceAfter = await buildingToken.read.balanceOf([
        investor.account.address,
      ]);
      const developerBalanceAfter = await buildingToken.read.balanceOf([
        developer.account.address,
      ]);

      assert.equal(
        investorBalanceBefore - investorBalanceAfter,
        buybackAmount
      );
      assert.equal(
        developerBalanceAfter - developerBalanceBefore,
        buybackAmount
      );
    });

    it("Should revert if called by non-developer", async function () {
      const [owner, developer, oracle, treasury, unauthorized, investor] =
        await viem.getWalletClients();
      const { saleManager, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      const buybackAmount = parseUnits("100", 18);

      await assert.rejects(
        saleManager.write.buybackTokens(
          [1n, investor.account.address, buybackAmount],
          { account: unauthorized.account }
        ),
        /BuildingSaleManager: caller is not the developer for this building/
      );
    });

    it("Should revert if tokenAmount is zero", async function () {
      const [owner, developer, oracle, treasury, investor] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.buybackTokens(
          [1n, investor.account.address, 0n],
          { account: developer.account }
        ),
        /BuildingSaleManager: tokenAmount must be > 0/
      );
    });

    it("Should revert if investor is zero address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.buybackTokens(
          [1n, "0x0000000000000000000000000000000000000000", parseUnits("100", 18)],
          { account: developer.account }
        ),
        /BuildingSaleManager: investor cannot be zero address/
      );
    });
  });

  describe("oracleUpdatePrice", function () {
    it("Should allow oracle to update price", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      // Set oracle
      await saleManager.write.setOracle([1n, oracle.account.address], {
        account: owner.account,
      });

      const newPrice = parseUnits("2", 6);

      await viem.assertions.emitWithArgs(
        saleManager.write.oracleUpdatePrice([1n, newPrice], {
          account: oracle.account,
        }),
        saleManager,
        "PriceUpdated",
        [1n, newPrice]
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.tokenPrice, newPrice);
    });

    it("Should revert if called by non-oracle", async function () {
      const [owner, developer, oracle, treasury, unauthorized] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.setOracle([1n, oracle.account.address], {
        account: owner.account,
      });

      await assert.rejects(
        saleManager.write.oracleUpdatePrice(
          [1n, parseUnits("2", 6)],
          { account: unauthorized.account }
        ),
        /BuildingSaleManager: caller is not the oracle for this building/
      );
    });

    it("Should revert if newPrice is zero", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.setOracle([1n, oracle.account.address], {
        account: owner.account,
      });

      await assert.rejects(
        saleManager.write.oracleUpdatePrice([1n, 0n], {
          account: oracle.account,
        }),
        /BuildingSaleManager: newPrice must be > 0/
      );
    });
  });

  describe("setOracle", function () {
    it("Should set oracle for a building", async function () {
      const [owner, developer, oracle, treasury, newOracle] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.setOracle([1n, newOracle.account.address], {
        account: owner.account,
      });

      const oracleAddress = await saleManager.read.saleOracles([1n]);
      assert.equal(
        oracleAddress.toLowerCase(),
        newOracle.account.address.toLowerCase()
      );
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.setOracle([1n, oracle.account.address], {
          account: unauthorized.account,
        }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if oracle is zero address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.setOracle(
          [1n, "0x0000000000000000000000000000000000000000"],
          { account: owner.account }
        ),
        /BuildingSaleManager: oracle cannot be zero address/
      );
    });
  });

  describe("setTokenTreasury", function () {
    it("Should update token treasury address", async function () {
      const [owner, developer, oracle, treasury, newTreasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.setTokenTreasury([newTreasury.account.address], {
        account: owner.account,
      });

      const treasuryAddress = await saleManager.read.tokenTreasury();
      assert.equal(
        treasuryAddress.toLowerCase(),
        newTreasury.account.address.toLowerCase()
      );
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.setTokenTreasury([treasury.account.address], {
          account: unauthorized.account,
        }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });

    it("Should revert if tokenTreasury is zero address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.setTokenTreasury([
          "0x0000000000000000000000000000000000000000",
        ], { account: owner.account }),
        /BuildingSaleManager: tokenTreasury cannot be zero address/
      );
    });
  });

  describe("setEscrowManager", function () {
    it("Should set EscrowManager address", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await saleManager.write.setEscrowManager([escrowManager.address], {
        account: owner.account,
      });

      const escrowAddress = await saleManager.read.escrowManager();
      assert.equal(
        escrowAddress.toLowerCase(),
        escrowManager.address.toLowerCase()
      );
    });

    it("Should allow setting EscrowManager to zero address (disable)", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await saleManager.write.setEscrowManager([escrowManager.address], {
        account: owner.account,
      });

      // Disable escrow
      await saleManager.write.setEscrowManager([
        "0x0000000000000000000000000000000000000000",
      ], { account: owner.account });

      const escrowAddress = await saleManager.read.escrowManager();
      assert.equal(escrowAddress, "0x0000000000000000000000000000000000000000");
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const usdc = await deployMockUSDC();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury.account.address
      );

      const escrowManager = await deployEscrowManager(
        owner.account.address,
        registry.address,
        usdc.address
      );

      await assert.rejects(
        saleManager.write.setEscrowManager([escrowManager.address], {
          account: unauthorized.account,
        }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });
  });

  describe("withdrawQuoteTokens", function () {
    it("Should withdraw all quote tokens when amount is zero", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // Buy tokens to deposit quote tokens
      const quoteAmount = parseUnits("1000", 6);
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      const tokensToBuy = quoteAmount / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy],
        { account: treasury.account }
      );

      await saleManager.write.buyTokens([1n, quoteAmount], {
        account: buyer.account,
      });

      // Withdraw all (amount = 0)
      const ownerBalanceBefore = await usdc.read.balanceOf([
        owner.account.address,
      ]);

      await saleManager.write.withdrawQuoteTokens([usdc.address, 0n], {
        account: owner.account,
      });

      const ownerBalanceAfter = await usdc.read.balanceOf([
        owner.account.address,
      ]);
      assert.equal(ownerBalanceAfter - ownerBalanceBefore, quoteAmount);
    });

    it("Should withdraw specific amount", async function () {
      const [owner, developer, oracle, treasury, buyer] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await saleManager.write.publishSale([1n], { account: owner.account });
      await saleManager.write.openSale([1n], { account: owner.account });

      // Buy tokens to deposit quote tokens
      const quoteAmount = parseUnits("1000", 6);
      await usdc.write.mint([buyer.account.address, quoteAmount], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount],
        { account: buyer.account }
      );

      const tokensToBuy = quoteAmount / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy],
        { account: treasury.account }
      );

      await saleManager.write.buyTokens([1n, quoteAmount], {
        account: buyer.account,
      });

      // Withdraw specific amount
      const withdrawAmount = parseUnits("500", 6);
      const ownerBalanceBefore = await usdc.read.balanceOf([
        owner.account.address,
      ]);

      await saleManager.write.withdrawQuoteTokens(
        [usdc.address, withdrawAmount],
        { account: owner.account }
      );

      const ownerBalanceAfter = await usdc.read.balanceOf([
        owner.account.address,
      ]);
      assert.equal(ownerBalanceAfter - ownerBalanceBefore, withdrawAmount);
    });

    it("Should revert if called by non-owner", async function () {
      const [owner, unauthorized, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager, usdc } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      await assert.rejects(
        saleManager.write.withdrawQuoteTokens([usdc.address, parseUnits("100", 6)], {
          account: unauthorized.account,
        }),
        /OwnableUnauthorizedAccount|Ownable: account is not the owner/
      );
    });
  });

  describe("getSale", function () {
    it("Should return correct sale information", async function () {
      const [owner, developer, oracle, treasury] =
        await viem.getWalletClients();
      const { saleManager, buildingToken, usdc } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      const sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.buildingId, 1n);
      assert.equal(
        sale.buildingToken.toLowerCase(),
        buildingToken.address.toLowerCase()
      );
      assert.equal(sale.quoteToken.toLowerCase(), usdc.address.toLowerCase());
      assert.equal(sale.tokenPrice, parseUnits("1", 6));
      assert.equal(sale.maxTokensForSale, parseUnits("1000000", 18));
      assert.equal(sale.tokensSold, 0n);
      assert.equal(sale.published, false);
      assert.equal(sale.open, false);
    });

    it("Should revert if sale not configured", async function () {
      const [owner] = await viem.getWalletClients();
      const registry = await deployBuildingRegistry(owner.account.address);
      const treasury = await viem.getWalletClients();
      const saleManager = await deployBuildingSaleManager(
        owner.account.address,
        registry.address,
        treasury[0].account.address
      );

      await assert.rejects(
        saleManager.read.getSale([1n]),
        /BuildingSaleManager: sale not configured/
      );
    });
  });

  describe("Integration tests", function () {
    it("Should handle complete sale lifecycle", async function () {
      const [owner, developer, oracle, treasury, buyer1, buyer2] =
        await viem.getWalletClients();
      const { saleManager, usdc, buildingToken, registry } = await setupSale(
        owner,
        developer,
        oracle,
        treasury
      );

      // 1. Configure sale (already done in setupSale)
      let sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.published, false);
      assert.equal(sale.open, false);

      // 2. Publish sale
      await saleManager.write.publishSale([1n], { account: owner.account });
      sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.published, true);
      let building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 1); // Status.Published

      // 3. Open sale
      await saleManager.write.openSale([1n], { account: owner.account });
      sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.open, true);
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 2); // Status.OpenForSale

      // 4. Buy tokens
      const quoteAmount1 = parseUnits("1000", 6);
      await usdc.write.mint([buyer1.account.address, quoteAmount1], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount1],
        { account: buyer1.account }
      );

      const tokensToBuy1 = quoteAmount1 / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy1],
        { account: treasury.account }
      );

      await saleManager.write.buyTokens([1n, quoteAmount1], {
        account: buyer1.account,
      });

      sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.tokensSold, tokensToBuy1);

      // 5. Another buyer
      const quoteAmount2 = parseUnits("500", 6);
      await usdc.write.mint([buyer2.account.address, quoteAmount2], {
        account: owner.account,
      });
      await usdc.write.approve(
        [saleManager.address, quoteAmount2],
        { account: buyer2.account }
      );

      const tokensToBuy2 = quoteAmount2 / parseUnits("1", 6);
      await buildingToken.write.approve(
        [saleManager.address, tokensToBuy2],
        { account: treasury.account }
      );

      await saleManager.write.buyTokens([1n, quoteAmount2], {
        account: buyer2.account,
      });

      sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.tokensSold, tokensToBuy1 + tokensToBuy2);

      // 6. Close sale
      await saleManager.write.closeSale([1n], { account: owner.account });
      sale = await saleManager.read.getSale([1n]);
      assert.equal(sale.open, false);
      building = await registry.read.getBuilding([1n]);
      assert.equal(building[6], 3); // Status.Closed
    });
  });
});

