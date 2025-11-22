// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IBuildingRegistry.sol";

/**
 * @title MockBuildingRegistry
 * @notice Mock implementation of BuildingRegistry for testing purposes
 */
contract MockBuildingRegistry is IBuildingRegistry {
    mapping(uint256 => BuildingInfo) private buildings;

    /**
     * @notice Registers a new building with the given information
     * @param buildingId The ID of the building
     * @param name The name of the building
     * @param metadataURI The URI for building metadata
     * @param developer The developer's address
     * @param status The initial status of the building
     */
    function registerBuilding(
        uint256 buildingId,
        string memory name,
        string memory metadataURI,
        address developer,
        BuildingStatus status
    ) external {
        buildings[buildingId].name = name;
        buildings[buildingId].metadataURI = metadataURI;
        buildings[buildingId].developer = developer;
        buildings[buildingId].status = status;
    }

    /**
     * @notice Adds a milestone to a building
     * @param buildingId The ID of the building
     * @param description Description of the milestone
     * @param targetDate Target completion date (timestamp)
     * @param completed Whether the milestone is completed
     */
    function addMilestone(
        uint256 buildingId,
        string memory description,
        uint256 targetDate,
        bool completed
    ) external {
        buildings[buildingId].milestones.push(
            Milestone({
                description: description,
                targetDate: targetDate,
                completed: completed
            })
        );
    }

    /**
     * @inheritdoc IBuildingRegistry
     */
    function getBuildingInfo(uint256 buildingId)
        external
        view
        override
        returns (
            string memory name,
            string memory metadataURI,
            address developer,
            BuildingStatus status,
            Milestone[] memory milestones
        )
    {
        BuildingInfo storage building = buildings[buildingId];
        return (
            building.name,
            building.metadataURI,
            building.developer,
            building.status,
            building.milestones
        );
    }
}
