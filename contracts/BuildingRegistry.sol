// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BuildingRegistry
 * @author Real Estate Construction RWA Protocol
 * @notice Registry contract for managing onchain real estate construction projects
 * @dev Tracks buildings, milestones, and associated token contracts
 */
contract BuildingRegistry is Ownable {
    /**
     * @notice Status enum for building lifecycle
     */
    enum Status {
        Draft,
        Published,
        OpenForSale,
        Closed
    }

    /**
     * @notice Building struct containing all project information
     * @dev Packed for gas efficiency where possible
     */
    struct Building {
        uint256 id;
        string name;
        string metadataURI;
        string description;
        string location;
        address developer;
        address oracle;
        address tokenContract;
        Status status;
        uint8 totalMilestones;
        uint8 currentMilestone;
        bool exists;
        bool featured;
    }

    /// @notice Mapping from building ID to Building struct
    mapping(uint256 => Building) public buildings;

    /// @notice Mapping to track admin addresses allowed to create buildings
    mapping(address => bool) public admins;

    /// @notice Counter for auto-incrementing building IDs
    uint256 private _nextBuildingId = 1;

    /**
     * @notice Emitted when a new building is created
     * @param buildingId The unique identifier of the building
     * @param developer The address of the construction company
     */
    event BuildingCreated(
        uint256 indexed buildingId,
        address indexed developer
    );

    /**
     * @notice Emitted when a building's status is updated
     * @param buildingId The unique identifier of the building
     * @param newStatus The new status of the building
     */
    event BuildingStatusUpdated(
        uint256 indexed buildingId,
        Status newStatus
    );

    /**
     * @notice Emitted when a milestone is confirmed
     * @param buildingId The unique identifier of the building
     * @param milestone The milestone number that was confirmed
     */
    event MilestoneConfirmed(
        uint256 indexed buildingId,
        uint8 milestone
    );

    /**
     * @notice Emitted when an admin is added or removed
     * @param admin The address of the admin
     * @param isAdmin Whether the address is now an admin
     */
    event AdminUpdated(address indexed admin, bool isAdmin);

    /**
     * @notice Constructor sets the contract owner
     * @param initialOwner The address that will own the contract
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Modifier to check if caller is owner or admin
     */
    modifier onlyOwnerOrAdmin() {
        require(
            owner() == msg.sender || admins[msg.sender],
            "BuildingRegistry: caller is not owner or admin"
        );
        _;
    }

    /**
     * @notice Modifier to check if caller is owner or the building's developer
     * @param buildingId The ID of the building to check
     */
    modifier onlyOwnerOrDeveloper(uint256 buildingId) {
        require(
            owner() == msg.sender || buildings[buildingId].developer == msg.sender,
            "BuildingRegistry: caller is not owner or developer"
        );
        _;
    }

    /**
     * @notice Modifier to check if caller is the building's oracle
     * @param buildingId The ID of the building to check
     */
    modifier onlyOracle(uint256 buildingId) {
        require(
            buildings[buildingId].oracle == msg.sender,
            "BuildingRegistry: caller is not the oracle"
        );
        _;
    }

    /**
     * @notice Creates a new building registration
     * @dev Auto-increments building ID. Can be called by anyone.
     * @param name The name of the building project
     * @param metadataURI URI pointing to offchain plans and documentation
     * @param developer The address of the construction company
     * @param oracle The address authorized to confirm milestones
     * @param totalMilestones Total number of milestones for this project (must be > 0)
     * @return buildingId The unique identifier assigned to this building
     */
    function createBuilding(
        string memory name,
        string memory metadataURI,
        address developer,
        address oracle,
        uint8 totalMilestones,
        string memory description,
        string memory location,
        bool featured
    ) external returns (uint256 buildingId) {
        require(totalMilestones > 0, "BuildingRegistry: totalMilestones must be > 0");
        require(developer != address(0), "BuildingRegistry: developer cannot be zero address");
        require(oracle != address(0), "BuildingRegistry: oracle cannot be zero address");

        buildingId = _nextBuildingId;
        _nextBuildingId++;

        buildings[buildingId] = Building({
            id: buildingId,
            name: name,
            metadataURI: metadataURI,
            developer: developer,
            oracle: oracle,
            tokenContract: address(0),
            status: Status.Draft,
            totalMilestones: totalMilestones,
            currentMilestone: 0,
            exists: true,
            featured: featured,
            description: description,
            location: location
        });

        emit BuildingCreated(buildingId, developer);
    }

    /**
     * @notice Sets the token contract address for a building
     * @dev Only callable by owner or the building's developer
     * @param buildingId The ID of the building
     * @param tokenContract The address of the ERC20 or ERC1155 contract
     */
    function setTokenContract(
        uint256 buildingId,
        address tokenContract
    ) external onlyOwnerOrDeveloper(buildingId) {
        require(buildings[buildingId].exists, "BuildingRegistry: building does not exist");
        require(tokenContract != address(0), "BuildingRegistry: tokenContract cannot be zero address");

        buildings[buildingId].tokenContract = tokenContract;
    }

    /**
     * @notice Confirms a milestone for a building
     * @dev Only callable by the building's oracle. Increments currentMilestone up to totalMilestones.
     * @param buildingId The ID of the building
     */
    function confirmMilestone(uint256 buildingId) external onlyOracle(buildingId) {
        require(buildings[buildingId].exists, "BuildingRegistry: building does not exist");
        
        Building storage building = buildings[buildingId];
        require(
            building.currentMilestone < building.totalMilestones,
            "BuildingRegistry: all milestones already confirmed"
        );

        building.currentMilestone++;
        emit MilestoneConfirmed(buildingId, building.currentMilestone);
    }

    /**
     * @notice Updates the status of a building
     * @dev Only callable by owner or the building's developer
     * @param buildingId The ID of the building
     * @param newStatus The new status to set
     */
    function updateStatus(
        uint256 buildingId,
        Status newStatus
    ) external onlyOwnerOrDeveloper(buildingId) {
        require(buildings[buildingId].exists, "BuildingRegistry: building does not exist");

        buildings[buildingId].status = newStatus;
        emit BuildingStatusUpdated(buildingId, newStatus);
    }

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
    function getBuilding(
        uint256 buildingId
    ) external view returns (
        uint256 id,
        string memory name,
        string memory metadataURI,
        address developer,
        address oracle,
        address tokenContract,
        Status status,
        uint8 totalMilestones,
        uint8 currentMilestone,
        bool exists,
        bool featured,
        string memory description,
        string memory location
    ) {
        Building memory building = buildings[buildingId];
        require(building.exists, "BuildingRegistry: building does not exist");
        return (
            building.id,
            building.name,
            building.metadataURI,
            building.developer,
            building.oracle,
            building.tokenContract,
            building.status,
            building.totalMilestones,
            building.currentMilestone,
            building.exists,
            building.featured,
            building.description,
            building.location
        );
    }

    /**
     * @notice Adds or removes an admin address
     * @dev Only callable by the owner
     * @param admin The address to add or remove
     * @param isAdmin Whether the address should be an admin
     */
    function setAdmin(address admin, bool isAdmin) external onlyOwner {
        require(admin != address(0), "BuildingRegistry: admin cannot be zero address");
        admins[admin] = isAdmin;
        emit AdminUpdated(admin, isAdmin);
    }

    /**
     * @notice Gets the next building ID that will be assigned
     * @return The next building ID
     */
    function getNextBuildingId() external view returns (uint256) {
        return _nextBuildingId;
    }

    /**
     * @notice Gets the total number of buildings created
     * @return The total number of buildings (nextBuildingId - 1)
     */
    function getTotalBuildings() external view returns (uint256) {
        return _nextBuildingId > 0 ? _nextBuildingId - 1 : 0;
    }

    /**
     * @notice Lists all building IDs
     * @dev Returns all building IDs from 1 to _nextBuildingId - 1
     * @return An array of all building IDs
     */
    function listBuildingIds() external view returns (uint256[] memory) {
        uint256 total = _nextBuildingId > 0 ? _nextBuildingId - 1 : 0;
        uint256[] memory buildingIds = new uint256[](total);
        
        for (uint256 i = 0; i < total; i++) {
            buildingIds[i] = i + 1;
        }
        
        return buildingIds;
    }

    /**
     * @notice Lists building IDs in a paginated range
     * @dev Useful for gas-efficient pagination when there are many buildings
     * @param offset The starting index (0-based)
     * @param limit The maximum number of building IDs to return
     * @return buildingIds An array of building IDs in the specified range
     * @return total The total number of buildings available
     */
    function listBuildings(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory buildingIds, uint256 total) {
        total = _nextBuildingId > 0 ? _nextBuildingId - 1 : 0;
        
        if (offset >= total) {
            return (new uint256[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 length = end - offset;
        buildingIds = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            buildingIds[i] = offset + i + 1;
        }
        
        return (buildingIds, total);
    }
}

