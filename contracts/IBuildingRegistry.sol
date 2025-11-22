// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IBuildingRegistry
 * @notice Interface for the BuildingRegistry contract that stores building information
 */
interface IBuildingRegistry {
    /// @notice Enum representing the status of a building
    enum BuildingStatus {
        Planning,
        UnderConstruction,
        Completed,
        Cancelled
    }

    /// @notice Struct containing milestone information
    struct Milestone {
        string description;
        uint256 targetDate;
        bool completed;
    }

    /// @notice Struct containing all building information
    struct BuildingInfo {
        string name;
        string metadataURI;
        address developer;
        BuildingStatus status;
        Milestone[] milestones;
    }

    /**
     * @notice Retrieve information about a specific building
     * @param buildingId The ID of the building
     * @return name The name of the building
     * @return metadataURI The URI pointing to additional metadata
     * @return developer The address of the developer
     * @return status The current status of the building
     * @return milestones Array of milestones for the building
     */
    function getBuildingInfo(uint256 buildingId)
        external
        view
        returns (
            string memory name,
            string memory metadataURI,
            address developer,
            BuildingStatus status,
            Milestone[] memory milestones
        );
}
