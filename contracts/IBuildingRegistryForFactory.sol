// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBuildingRegistryForFactory
 * @notice Interface for BuildingRegistry contract used by BuildingTokenFactory
 * @dev This interface matches the actual BuildingRegistry contract implementation
 */
interface IBuildingRegistryForFactory {
    enum Status {
        Draft,
        Published,
        OpenForSale,
        Closed
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
     * @return featured Whether the building is featured
     * @return description The building description
     * @return location The building location
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
        bool,
        bool,
        string memory,
        string memory
    );

    /**
     * @notice Sets the token contract address for a building
     * @param buildingId The ID of the building
     * @param tokenContract The address of the ERC20 contract
     */
    function setTokenContract(uint256 buildingId, address tokenContract) external;
}

