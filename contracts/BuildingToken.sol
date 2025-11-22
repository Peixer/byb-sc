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

    /// @notice Reference to the BuildingRegistry contract
    IBuildingRegistry public immutable buildingRegistry;

    /// @notice Flag indicating whether transfers are restricted
    bool public transfersRestricted;

    /// @notice Mapping of addresses that are whitelisted for transfers when restrictions are enabled
    mapping(address => bool) public isWhitelisted;

    /// @notice Emitted when transfer restrictions are updated
    event TransfersRestricted(bool restricted);

    /// @notice Emitted when an address is added to or removed from the whitelist
    event WhitelistUpdated(address indexed account, bool allowed);

    /**
     * @notice Constructs a new BuildingToken
     * @param name_ The name of the token (e.g., "Building Tower A Token")
     * @param symbol_ The symbol of the token (e.g., "BTA")
     * @param totalSupply_ The total supply of tokens to mint initially
     * @param buildingId_ The unique identifier of the building from the BuildingRegistry
     * @param registryAddress_ The address of the BuildingRegistry contract
     * @param initialOwner_ The address that will receive the initial supply and own the contract
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 buildingId_,
        address registryAddress_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        require(registryAddress_ != address(0), "BuildingToken: registry address cannot be zero");
        require(initialOwner_ != address(0), "BuildingToken: initial owner cannot be zero");
        require(totalSupply_ > 0, "BuildingToken: total supply must be greater than zero");

        buildingId = buildingId_;
        buildingRegistry = IBuildingRegistry(registryAddress_);

        // Mint the total supply to the initial owner
        _mint(initialOwner_, totalSupply_);
    }

    /**
     * @notice Retrieves building information from the BuildingRegistry
     * @return name The name of the building
     * @return metadataURI The URI pointing to additional building metadata
     * @return developer The address of the building developer
     * @return status The current status of the building
     * @return milestones Array of milestones for the building
     */
    function getBuildingInfo()
        external
        view
        returns (
            string memory name,
            string memory metadataURI,
            address developer,
            IBuildingRegistry.BuildingStatus status,
            IBuildingRegistry.Milestone[] memory milestones
        )
    {
        return buildingRegistry.getBuildingInfo(buildingId);
    }

    /**
     * @notice Sets whether transfers are restricted
     * @dev Only callable by the contract owner
     * @param restricted True to enable transfer restrictions, false to disable
     */
    function setTransfersRestricted(bool restricted) external onlyOwner {
        transfersRestricted = restricted;
        emit TransfersRestricted(restricted);
    }

    /**
     * @notice Updates the whitelist status of an address
     * @dev Only callable by the contract owner
     * @param account The address to update
     * @param allowed True to whitelist the address, false to remove from whitelist
     */
    function updateWhitelist(address account, bool allowed) external onlyOwner {
        require(account != address(0), "BuildingToken: cannot whitelist zero address");
        isWhitelisted[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    /**
     * @notice Internal function that is called before any transfer of tokens
     * @dev Overrides ERC20's _update function to implement transfer restrictions
     * When transfers are restricted, only whitelisted addresses can send or receive tokens
     * Minting and burning are always allowed regardless of restrictions
     * @param from The address tokens are transferred from
     * @param to The address tokens are transferred to
     * @param value The amount of tokens being transferred
     */
    function _update(address from, address to, uint256 value) internal virtual override {
        // If transfers are restricted, check whitelist (except for minting/burning)
        if (transfersRestricted) {
            // Allow minting (from == address(0)) and burning (to == address(0))
            if (from != address(0) && to != address(0)) {
                require(
                    isWhitelisted[from] && isWhitelisted[to],
                    "BuildingToken: transfer restricted to whitelisted addresses only"
                );
            }
        }

        super._update(from, to, value);
    }
}
