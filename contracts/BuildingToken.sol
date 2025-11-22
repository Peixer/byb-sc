// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IBuildingRegistry.sol";

/**
 * @title BuildingToken
 * @notice ERC20 token representing fractional ownership of a single building in a Real Estate Construction RWA protocol
 * @dev This contract is designed to be deployed once per building, with each deployment representing a unique building
 * from the BuildingRegistry. The token enables fractional ownership and includes optional transfer restrictions
 * for regulatory compliance.
 */
contract BuildingToken is ERC20, Ownable {
    /// @notice The unique identifier of the building this token represents
    uint256 public immutable buildingId;  

    /**
     * @notice Constructs a new BuildingToken
     * @param name_ The name of the token (e.g., "Building Tower A Token")
     * @param symbol_ The symbol of the token (e.g., "BTA")
     * @param totalSupply_ The total supply of tokens to mint initially
     * @param buildingId_ The unique identifier of the building from the BuildingRegistry 
     * @param initialOwner_ The address that will receive the initial supply and own the contract
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 buildingId_, 
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) { 
        require(initialOwner_ != address(0), "BuildingToken: initial owner cannot be zero");
        require(totalSupply_ > 0, "BuildingToken: total supply must be greater than zero");

        buildingId = buildingId_; 

        // Mint the total supply to the initial owner
        _mint(initialOwner_, totalSupply_);
    }  
}
