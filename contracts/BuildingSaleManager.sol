// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IBuildingRegistry
 * @notice Interface for interacting with the BuildingRegistry contract
 */
interface IBuildingRegistry {
    enum Status {
        Draft,
        Published,
        OpenForSale,
        Closed
    }

    /**
     * @notice Updates the status of a building
     * @param buildingId The ID of the building
     * @param newStatus The new status to set
     */
    function updateStatus(uint256 buildingId, Status newStatus) external;

    /**
     * @notice Gets full building data by ID
     * @param buildingId The ID of the building to retrieve
     * @return id The building ID
     * @return name The building name
     * @return metadataURI The metadata URI
     * @return developer The developer address
     * @return oracle The oracle address
     * @return tokenContract The token contract address
     * @return status The current status
     * @return totalMilestones Total number of milestones
     * @return currentMilestone Current milestone number
     * @return exists Whether the building exists
     */
    function getBuilding(uint256 buildingId) external view returns (
        uint256,
        string memory,
        string memory,
        address,
        address,
        address,
        Status,
        uint8,
        uint8,
        bool
    );
}

/**
 * @title IEscrowManager
 * @notice Interface for interacting with the EscrowManager contract
 */
interface IEscrowManager {
    /**
     * @notice Deposits funds into escrow for a building
     * @param buildingId The ID of the building
     * @param amount The amount of quote tokens to deposit
     */
    function depositFunds(uint256 buildingId, uint256 amount) external;
}

/**
 * @title BuildingSaleManager
 * @author Real Estate Construction RWA Protocol
 * @notice Manages the sale and capital flow layer for real estate construction projects
 * @dev Handles token sales, price updates, and integrates with BuildingRegistry
 */
contract BuildingSaleManager is Ownable, ReentrancyGuard {
    /**
     * @notice Sale struct containing all sale information
     */
    struct Sale {
        uint256 buildingId;
        address buildingToken; // ERC20 fractional token
        address quoteToken; // e.g. USDC
        uint256 tokenPrice; // in smallest units of quoteToken per 1 BuildingToken
        uint256 maxTokensForSale;
        uint256 tokensSold;
        bool published;
        bool open;
    }

    /// @notice Reference to the BuildingRegistry contract
    IBuildingRegistry public buildingRegistry;

    /// @notice Reference to the EscrowManager contract (can be zero address if not set)
    IEscrowManager public escrowManager;

    /// @notice Mapping from building ID to Sale struct
    mapping(uint256 => Sale) public sales;

    /// @notice Mapping from building ID to oracle address for price updates
    mapping(uint256 => address) public saleOracles;

    /// @notice Address that holds the BuildingTokens to be sold (treasury)
    address public tokenTreasury;

    /**
     * @notice Emitted when a sale is configured
     * @param buildingId The unique identifier of the building
     * @param token The BuildingToken contract address
     * @param quoteToken The quote token (stablecoin) address
     */
    event SaleConfigured(
        uint256 indexed buildingId,
        address token,
        address quoteToken
    );

    /**
     * @notice Emitted when a sale is published
     * @param buildingId The unique identifier of the building
     */
    event SalePublished(uint256 indexed buildingId);

    /**
     * @notice Emitted when a sale is opened for purchases
     * @param buildingId The unique identifier of the building
     */
    event SaleOpened(uint256 indexed buildingId);

    /**
     * @notice Emitted when a sale is closed
     * @param buildingId The unique identifier of the building
     */
    event SaleClosed(uint256 indexed buildingId);

    /**
     * @notice Emitted when tokens are purchased
     * @param buildingId The unique identifier of the building
     * @param buyer The address that purchased the tokens
     * @param amountTokens The amount of BuildingTokens purchased
     * @param amountQuote The amount of quote tokens paid
     */
    event TokensPurchased(
        uint256 indexed buildingId,
        address indexed buyer,
        uint256 amountTokens,
        uint256 amountQuote
    );

    /**
     * @notice Emitted when the token price is updated by an oracle
     * @param buildingId The unique identifier of the building
     * @param newPrice The new token price
     */
    event PriceUpdated(
        uint256 indexed buildingId,
        uint256 newPrice
    );

    /**
     * @notice Emitted when tokens are bought back by the builder
     * @param buildingId The unique identifier of the building
     * @param builder The address of the builder buying back tokens
     * @param investor The address of the investor selling tokens
     * @param amountTokens The amount of BuildingTokens bought back
     * @param amountQuote The amount of quote tokens paid
     */
    event TokensBoughtBack(
        uint256 indexed buildingId,
        address indexed builder,
        address indexed investor,
        uint256 amountTokens,
        uint256 amountQuote
    );

    /**
     * @notice Constructor sets the contract owner and dependencies
     * @param initialOwner The address that will own the contract
     * @param _buildingRegistry The address of the BuildingRegistry contract
     * @param _tokenTreasury The address that holds BuildingTokens to be sold
     */
    constructor(
        address initialOwner,
        address _buildingRegistry,
        address _tokenTreasury
    ) Ownable(initialOwner) {
        require(
            _buildingRegistry != address(0),
            "BuildingSaleManager: buildingRegistry cannot be zero address"
        );
        require(
            _tokenTreasury != address(0),
            "BuildingSaleManager: tokenTreasury cannot be zero address"
        );

        buildingRegistry = IBuildingRegistry(_buildingRegistry);
        tokenTreasury = _tokenTreasury;
    }

    /**
     * @notice Modifier to check if caller is the oracle for a specific building
     * @param buildingId The ID of the building to check
     */
    modifier onlyOracleOfBuilding(uint256 buildingId) {
        require(
            saleOracles[buildingId] == msg.sender,
            "BuildingSaleManager: caller is not the oracle for this building"
        );
        _;
    }

    /**
     * @notice Modifier to check if caller is the developer/builder of a specific building
     * @param buildingId The ID of the building to check
     */
    modifier onlyDeveloperOfBuilding(uint256 buildingId) {
        (
            ,
            ,
            ,
            address developer,
            ,
            ,
            ,
            ,
            ,
            bool exists
        ) = buildingRegistry.getBuilding(buildingId);
        require(
            exists,
            "BuildingSaleManager: building does not exist"
        );
        require(
            developer == msg.sender,
            "BuildingSaleManager: caller is not the developer for this building"
        );
        _;
    }

    /**
     * @notice Configures a sale for a building
     * @dev Only callable by owner. Ensures the building exists in BuildingRegistry.
     * @param buildingId The ID of the building
     * @param buildingToken The address of the BuildingToken ERC20 contract
     * @param quoteToken The address of the quote token (e.g. USDC)
     * @param tokenPrice Price in smallest units of quoteToken per 1 BuildingToken
     * @param maxTokensForSale Maximum number of BuildingTokens available for sale
     */
    function configureSale(
        uint256 buildingId,
        address buildingToken,
        address quoteToken,
        uint256 tokenPrice,
        uint256 maxTokensForSale
    ) external onlyOwner {
        require(
            buildingToken != address(0),
            "BuildingSaleManager: buildingToken cannot be zero address"
        );
        require(
            quoteToken != address(0),
            "BuildingSaleManager: quoteToken cannot be zero address"
        );
        require(
            tokenPrice > 0,
            "BuildingSaleManager: tokenPrice must be > 0"
        );
        require(
            maxTokensForSale > 0,
            "BuildingSaleManager: maxTokensForSale must be > 0"
        );

        // Verify building exists in registry (will revert if it doesn't exist)
        // We call getBuilding to ensure the building exists - it reverts if not found
        buildingRegistry.getBuilding(buildingId);

        sales[buildingId] = Sale({
            buildingId: buildingId,
            buildingToken: buildingToken,
            quoteToken: quoteToken,
            tokenPrice: tokenPrice,
            maxTokensForSale: maxTokensForSale,
            tokensSold: 0,
            published: false,
            open: false
        });

        emit SaleConfigured(buildingId, buildingToken, quoteToken);
    }

    /**
     * @notice Publishes a sale, making it visible but not yet open for purchases
     * @dev Only callable by owner. Updates building status to Published.
     * @param buildingId The ID of the building
     */
    function publishSale(uint256 buildingId) external onlyOwner {
        Sale storage sale = sales[buildingId];
        require(
            sale.buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );
        require(
            !sale.published,
            "BuildingSaleManager: sale already published"
        );

        sale.published = true;

        // Update building status in registry
        buildingRegistry.updateStatus(
            buildingId,
            IBuildingRegistry.Status.Published
        );

        emit SalePublished(buildingId);
    }

    /**
     * @notice Opens a sale for token purchases
     * @dev Only callable by owner. Requires sale to be published and not already open.
     * @param buildingId The ID of the building
     */
    function openSale(uint256 buildingId) external onlyOwner {
        Sale storage sale = sales[buildingId];
        require(
            sale.buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );
        require(
            sale.published,
            "BuildingSaleManager: sale must be published first"
        );
        require(
            !sale.open,
            "BuildingSaleManager: sale already open"
        );

        sale.open = true;

        // Update building status in registry
        buildingRegistry.updateStatus(
            buildingId,
            IBuildingRegistry.Status.OpenForSale
        );

        emit SaleOpened(buildingId);
    }

    /**
     * @notice Closes a sale, preventing further purchases
     * @dev Only callable by owner. Updates building status to Closed.
     * @param buildingId The ID of the building
     */
    function closeSale(uint256 buildingId) external onlyOwner {
        Sale storage sale = sales[buildingId];
        require(
            sale.buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );

        sale.open = false;

        // Update building status in registry
        buildingRegistry.updateStatus(
            buildingId,
            IBuildingRegistry.Status.Closed
        );

        emit SaleClosed(buildingId);
    }

    /**
     * @notice Purchases BuildingTokens using quote tokens
     * @dev Non-reentrant. Requires sale to be open. Transfers quote tokens from buyer
     *      and BuildingTokens from treasury to buyer.
     * @param buildingId The ID of the building
     * @param quoteAmount The amount of quote tokens to spend
     */
    function buyTokens(
        uint256 buildingId,
        uint256 quoteAmount
    ) external nonReentrant {
        require(
            quoteAmount > 0,
            "BuildingSaleManager: quoteAmount must be > 0"
        );

        Sale storage sale = sales[buildingId];
        require(
            sale.buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );
        require(
            sale.open,
            "BuildingSaleManager: sale is not open"
        );

        // Calculate tokens to buy: quoteAmount / tokenPrice
        // Note: Assumes tokenPrice accounts for decimal differences between tokens
        uint256 tokensToBuy = quoteAmount / sale.tokenPrice;
        require(
            tokensToBuy > 0,
            "BuildingSaleManager: quoteAmount too small to buy any tokens"
        );

        // Check if we have enough tokens available
        require(
            sale.tokensSold + tokensToBuy <= sale.maxTokensForSale,
            "BuildingSaleManager: insufficient tokens available for sale"
        );

        // Transfer quote tokens from buyer to this contract
        IERC20 quoteToken = IERC20(sale.quoteToken);
        require(
            quoteToken.transferFrom(msg.sender, address(this), quoteAmount),
            "BuildingSaleManager: quote token transfer failed"
        );

        // If EscrowManager is configured, deposit funds to escrow instead of holding them
        if (address(escrowManager) != address(0)) {
            // Reset approval to 0 first (required for some tokens like USDT)
            quoteToken.approve(address(escrowManager), 0);
            
            // Approve EscrowManager to spend the quote tokens
            quoteToken.approve(address(escrowManager), quoteAmount);

            // Deposit funds to escrow (will revert if approval/transfer fails)
            escrowManager.depositFunds(buildingId, quoteAmount);
        }

        // Transfer BuildingTokens from treasury to buyer
        IERC20 buildingToken = IERC20(sale.buildingToken);
        require(
            buildingToken.transferFrom(tokenTreasury, msg.sender, tokensToBuy),
            "BuildingSaleManager: building token transfer failed"
        );

        // Update tokens sold
        sale.tokensSold += tokensToBuy;

        emit TokensPurchased(buildingId, msg.sender, tokensToBuy, quoteAmount);
    }

    /**
     * @notice Sets the oracle address for a building sale
     * @dev Only callable by owner. Oracle can update token prices.
     * @param buildingId The ID of the building
     * @param oracle The address of the oracle
     */
    function setOracle(uint256 buildingId, address oracle) external onlyOwner {
        require(
            oracle != address(0),
            "BuildingSaleManager: oracle cannot be zero address"
        );
        require(
            sales[buildingId].buildingId != 0 || sales[buildingId].buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );

        saleOracles[buildingId] = oracle;
    }

    /**
     * @notice Updates the token price for a building sale
     * @dev Only callable by the oracle for that building. Used for AI/external price evaluation.
     * @param buildingId The ID of the building
     * @param newPrice The new token price in smallest units of quoteToken per 1 BuildingToken
     */
    function oracleUpdatePrice(
        uint256 buildingId,
        uint256 newPrice
    ) external onlyOracleOfBuilding(buildingId) {
        require(
            newPrice > 0,
            "BuildingSaleManager: newPrice must be > 0"
        );
        require(
            sales[buildingId].buildingId != 0 || sales[buildingId].buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );

        sales[buildingId].tokenPrice = newPrice;

        emit PriceUpdated(buildingId, newPrice);
    }

    /**
     * @notice Allows the builder/developer to buy back tokens from investors
     * @dev Non-reentrant. Only callable by the developer of the building.
     *      The developer must approve the contract to transfer quote tokens.
     *      The investor must approve the contract to transfer BuildingTokens.
     * @param buildingId The ID of the building
     * @param investor The address of the investor selling tokens
     * @param tokenAmount The amount of BuildingTokens to buy back
     */
    function buybackTokens(
        uint256 buildingId,
        address investor,
        uint256 tokenAmount
    ) external nonReentrant onlyDeveloperOfBuilding(buildingId) {
        require(
            tokenAmount > 0,
            "BuildingSaleManager: tokenAmount must be > 0"
        );
        require(
            investor != address(0),
            "BuildingSaleManager: investor cannot be zero address"
        );

        Sale storage sale = sales[buildingId];
        require(
            sale.buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );

        // Calculate quote tokens needed: tokenAmount * tokenPrice
        // Note: Assumes tokenPrice accounts for decimal differences between tokens
        uint256 quoteAmount = tokenAmount * sale.tokenPrice;
        require(
            quoteAmount > 0,
            "BuildingSaleManager: quoteAmount calculation resulted in zero"
        );

        // Transfer quote tokens from builder (msg.sender) to investor
        IERC20 quoteToken = IERC20(sale.quoteToken);
        require(
            quoteToken.transferFrom(msg.sender, investor, quoteAmount),
            "BuildingSaleManager: quote token transfer failed"
        );

        // Transfer BuildingTokens from investor to builder (msg.sender)
        IERC20 buildingToken = IERC20(sale.buildingToken);
        require(
            buildingToken.transferFrom(investor, msg.sender, tokenAmount),
            "BuildingSaleManager: building token transfer failed"
        );

        emit TokensBoughtBack(
            buildingId,
            msg.sender,
            investor,
            tokenAmount,
            quoteAmount
        );
    }

    /**
     * @notice Updates the token treasury address
     * @dev Only callable by owner
     * @param _tokenTreasury The new treasury address
     */
    function setTokenTreasury(address _tokenTreasury) external onlyOwner {
        require(
            _tokenTreasury != address(0),
            "BuildingSaleManager: tokenTreasury cannot be zero address"
        );
        tokenTreasury = _tokenTreasury;
    }

    /**
     * @notice Sets the EscrowManager contract address
     * @dev Only callable by owner. Set to zero address to disable escrow deposits.
     * @param _escrowManager The address of the EscrowManager contract
     */
    function setEscrowManager(address _escrowManager) external onlyOwner {
        escrowManager = IEscrowManager(_escrowManager);
    }

    /**
     * @notice Gets sale information for a building
     * @param buildingId The ID of the building
     * @return sale The complete Sale struct
     */
    function getSale(uint256 buildingId) external view returns (Sale memory) {
        require(
            sales[buildingId].buildingId != 0 || sales[buildingId].buildingToken != address(0),
            "BuildingSaleManager: sale not configured"
        );
        return sales[buildingId];
    }

    /**
     * @notice Withdraws quote tokens from the contract
     * @dev Only callable by owner. Useful for collecting sale proceeds.
     * @param quoteToken The address of the quote token to withdraw
     * @param amount The amount to withdraw (0 = all)
     */
    function withdrawQuoteTokens(
        address quoteToken,
        uint256 amount
    ) external onlyOwner {
        IERC20 token = IERC20(quoteToken);
        uint256 balance = token.balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        
        require(
            withdrawAmount > 0 && withdrawAmount <= balance,
            "BuildingSaleManager: invalid withdrawal amount"
        );

        require(
            token.transfer(owner(), withdrawAmount),
            "BuildingSaleManager: withdrawal transfer failed"
        );
    }
}

