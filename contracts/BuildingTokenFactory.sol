// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BuildingToken.sol";
import "./IBuildingRegistryForFactory.sol";

/**
 * @title BuildingTokenFactory
 * @notice Factory contract for creating new BuildingToken ERC20 instances for each building
 * @dev Each building gets its own unique ERC20 token deployed through this factory
 */
contract BuildingTokenFactory is Ownable {
    /// @notice Reference to the BuildingRegistry contract
    IBuildingRegistryForFactory public immutable buildingRegistry;

    /// @notice Mapping from building ID to its deployed token address
    mapping(uint256 => address) public buildingTokens;

    /// @notice Array of all deployed token addresses
    address[] public allTokens;

    /// @notice Emitted when a new BuildingToken is created
    event BuildingTokenCreated(
        uint256 indexed buildingId,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 totalSupply,
        address initialOwner
    );

    /**
     * @notice Constructor sets the contract owner and BuildingRegistry address
     * @param initialOwner The address that will own the contract
     * @param _buildingRegistry The address of the BuildingRegistry contract
     */
    constructor(
        address initialOwner,
        address _buildingRegistry
    ) Ownable(initialOwner) {
        require(
            _buildingRegistry != address(0),
            "BuildingTokenFactory: buildingRegistry cannot be zero address"
        );
        buildingRegistry = IBuildingRegistryForFactory(_buildingRegistry);
    }

    /**
     * @notice Creates a new BuildingToken for a building
     * @dev Can only create one token per building. Verifies building exists in registry.
     *      Automatically sets the token contract in BuildingRegistry if caller has permission.
     * @param buildingId The unique identifier of the building
     * @param name The name of the token (e.g., "Building Tower A Token")
     * @param symbol The symbol of the token (e.g., "BTA")
     * @param totalSupply The total supply of tokens to mint initially
     * @param initialOwner The address that will receive the initial supply and own the token
     * @return tokenAddress The address of the newly deployed BuildingToken contract
     */
    function createBuildingToken(
        uint256 buildingId,
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address initialOwner
    ) external returns (address tokenAddress) {
        require(
            buildingTokens[buildingId] == address(0),
            "BuildingTokenFactory: token already exists for this building"
        );
        require(
            initialOwner != address(0),
            "BuildingTokenFactory: initialOwner cannot be zero address"
        );
        require(
            totalSupply > 0,
            "BuildingTokenFactory: totalSupply must be greater than zero"
        );

        // Verify building exists in registry (will revert if it doesn't exist)
        buildingRegistry.getBuilding(buildingId);

        // Deploy new BuildingToken
        BuildingToken newToken = new BuildingToken(
            name,
            symbol,
            totalSupply,
            buildingId,
            initialOwner
        );

        tokenAddress = address(newToken);
        buildingTokens[buildingId] = tokenAddress;
        allTokens.push(tokenAddress);

        // Try to set the token contract in BuildingRegistry
        // This will only succeed if the factory owner has permission (owner or developer)
        // If it fails, the token is still created and can be set manually later
        try buildingRegistry.setTokenContract(buildingId, tokenAddress) {} catch {}

        emit BuildingTokenCreated(
            buildingId,
            tokenAddress,
            name,
            symbol,
            totalSupply,
            initialOwner
        );

        return tokenAddress;
    }

    /**
     * @notice Gets the token address for a specific building
     * @param buildingId The ID of the building
     * @return The address of the BuildingToken contract, or address(0) if not created
     */
    function getBuildingToken(uint256 buildingId) external view returns (address) {
        return buildingTokens[buildingId];
    }

    /**
     * @notice Gets the total number of tokens created by this factory
     * @return The number of tokens created
     */
    function getTotalTokensCreated() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Gets all token addresses created by this factory
     * @return Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
}

