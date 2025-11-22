// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IBuildingRegistryForFactory.sol";

/**
 * @title EscrowManager
 * @notice Manages USDC escrow for building construction projects
 * @dev Holds USDC from token sales and releases funds as construction milestones are completed
 */
contract EscrowManager is Ownable, ReentrancyGuard {
    /// @notice Reference to the BuildingRegistry contract
    IBuildingRegistryForFactory public immutable buildingRegistry;

    /// @notice The USDC token contract address
    address public immutable usdcToken;

    /// @notice Struct containing escrow information for a building
    struct Escrow {
        uint256 buildingId;
        address developer; // Address that will receive released funds
        uint256 totalEscrowed; // Total USDC held in escrow
        uint256 totalReleased; // Total USDC released so far
        uint8 totalMilestones; // Total number of milestones
        uint8 lastReleasedMilestone; // Last milestone that funds were released for (0-indexed)
        mapping(uint8 => uint256) milestoneReleaseAmount; // Amount to release per milestone (0-indexed)
        bool exists;
    }

    /// @notice Mapping from building ID to Escrow struct
    mapping(uint256 => Escrow) public escrows;

    /// @notice Emitted when funds are deposited into escrow
    event FundsDeposited(
        uint256 indexed buildingId,
        address indexed depositor,
        uint256 amount
    );

    /// @notice Emitted when funds are released for a milestone
    event FundsReleased(
        uint256 indexed buildingId,
        uint8 indexed milestone,
        address indexed developer,
        uint256 amount
    );

    /// @notice Emitted when an escrow is configured
    event EscrowConfigured(
        uint256 indexed buildingId,
        address indexed developer,
        uint8 totalMilestones
    );

    /**
     * @notice Constructor sets the contract owner and dependencies
     * @param initialOwner The address that will own the contract
     * @param _buildingRegistry The address of the BuildingRegistry contract
     * @param _usdcToken The address of the USDC ERC20 token contract
     */
    constructor(
        address initialOwner,
        address _buildingRegistry,
        address _usdcToken
    ) Ownable(initialOwner) {
        require(
            _buildingRegistry != address(0),
            "EscrowManager: buildingRegistry cannot be zero address"
        );
        require(
            _usdcToken != address(0),
            "EscrowManager: usdcToken cannot be zero address"
        );

        buildingRegistry = IBuildingRegistryForFactory(_buildingRegistry);
        usdcToken = _usdcToken;
    }

    /**
     * @notice Configures escrow for a building with milestone release amounts
     * @dev Only callable by owner. Sets up how much USDC to release per milestone.
     *      Milestone amounts are 0-indexed (milestone 0, 1, 2, etc.)
     * @param buildingId The ID of the building
     * @param developer The address that will receive released funds
     * @param milestoneAmounts Array of USDC amounts to release for each milestone
     */
    function configureEscrow(
        uint256 buildingId,
        address developer,
        uint256[] memory milestoneAmounts
    ) external onlyOwner {
        require(
            developer != address(0),
            "EscrowManager: developer cannot be zero address"
        );
        require(
            milestoneAmounts.length > 0,
            "EscrowManager: must have at least one milestone"
        );

        // Verify building exists in registry
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint8 totalMilestones,
            ,
            bool exists
        ) = buildingRegistry.getBuilding(buildingId);

        require(exists, "EscrowManager: building does not exist");
        require(
            milestoneAmounts.length == totalMilestones,
            "EscrowManager: milestone amounts length must match building totalMilestones"
        );

        Escrow storage escrow = escrows[buildingId];
        require(
            !escrow.exists,
            "EscrowManager: escrow already configured for this building"
        );

        escrow.buildingId = buildingId;
        escrow.developer = developer;
        escrow.totalMilestones = uint8(milestoneAmounts.length);
        escrow.lastReleasedMilestone = 0;
        escrow.exists = true;

        // Set release amounts for each milestone
        for (uint8 i = 0; i < milestoneAmounts.length; i++) {
            require(
                milestoneAmounts[i] > 0,
                "EscrowManager: milestone amount must be > 0"
            );
            escrow.milestoneReleaseAmount[i] = milestoneAmounts[i];
        }

        emit EscrowConfigured(buildingId, developer, escrow.totalMilestones);
    }

    /**
     * @notice Deposits USDC into escrow for a building
     * @dev Can be called by anyone (typically the BuildingSaleManager)
     * @param buildingId The ID of the building
     * @param amount The amount of USDC to deposit
     */
    function depositFunds(
        uint256 buildingId,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "EscrowManager: amount must be > 0");
        require(
            escrows[buildingId].exists,
            "EscrowManager: escrow not configured for this building"
        );

        // Transfer USDC from caller to this contract
        IERC20 usdc = IERC20(usdcToken);
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "EscrowManager: USDC transfer failed"
        );

        escrows[buildingId].totalEscrowed += amount;

        emit FundsDeposited(buildingId, msg.sender, amount);
    }

    /**
     * @notice Releases funds for the next available milestone
     * @dev Checks BuildingRegistry for milestone confirmations and releases funds for the next milestone
     *      that has been confirmed but not yet released. Can be called by anyone.
     * @param buildingId The ID of the building
     */
    function releaseMilestoneFunds(
        uint256 buildingId
    ) external nonReentrant {
        Escrow storage escrow = escrows[buildingId];
        require(escrow.exists, "EscrowManager: escrow not configured");

        // Get current milestone from BuildingRegistry
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint8 currentMilestone,
            bool exists
        ) = buildingRegistry.getBuilding(buildingId);

        require(exists, "EscrowManager: building does not exist");
        
        // Calculate the next milestone to release
        // lastReleasedMilestone is 0-indexed (0 = no milestones released yet, 1 = milestone 1 released, etc.)
        // currentMilestone is 1-indexed (number of confirmed milestones)
        // The next milestone to release is at index lastReleasedMilestone
        uint8 nextMilestoneIndex = escrow.lastReleasedMilestone;
        
        require(
            currentMilestone > nextMilestoneIndex,
            "EscrowManager: no new milestones available to release"
        );
        require(
            nextMilestoneIndex < escrow.totalMilestones,
            "EscrowManager: all milestones have been released"
        );

        // Get the amount to release for the next milestone
        uint256 amountToRelease = escrow.milestoneReleaseAmount[nextMilestoneIndex];
        
        require(
            amountToRelease > 0,
            "EscrowManager: milestone release amount is zero"
        );
        require(
            escrow.totalEscrowed >= escrow.totalReleased + amountToRelease,
            "EscrowManager: insufficient escrowed funds"
        );

        // Update escrow state - increment to mark this milestone as released
        escrow.lastReleasedMilestone = nextMilestoneIndex + 1;
        escrow.totalReleased += amountToRelease;

        // Transfer USDC to developer
        IERC20 usdc = IERC20(usdcToken);
        require(
            usdc.transfer(escrow.developer, amountToRelease),
            "EscrowManager: USDC transfer to developer failed"
        );

        // Emit event for the released milestone
        // nextMilestoneIndex is 0-indexed, but milestone number is 1-indexed
        emit FundsReleased(
            buildingId,
            nextMilestoneIndex + 1, // Milestone number (1-indexed)
            escrow.developer,
            amountToRelease
        );
    }

    /**
     * @notice Gets escrow information for a building
     * @param buildingId The ID of the building
     * @return totalEscrowed Total USDC held in escrow
     * @return totalReleased Total USDC released so far
     * @return lastReleasedMilestone Last milestone that funds were released for (0-indexed)
     * @return totalMilestones Total number of milestones
     * @return developer Address that receives released funds
     */
    function getEscrowInfo(
        uint256 buildingId
    )
        external
        view
        returns (
            uint256 totalEscrowed,
            uint256 totalReleased,
            uint8 lastReleasedMilestone,
            uint8 totalMilestones,
            address developer
        )
    {
        Escrow storage escrow = escrows[buildingId];
        require(escrow.exists, "EscrowManager: escrow not configured");

        return (
            escrow.totalEscrowed,
            escrow.totalReleased,
            escrow.lastReleasedMilestone,
            escrow.totalMilestones,
            escrow.developer
        );
    }

    /**
     * @notice Gets the release amount for a specific milestone
     * @param buildingId The ID of the building
     * @param milestone The milestone number (0-indexed)
     * @return The amount of USDC to be released for this milestone
     */
    function getMilestoneReleaseAmount(
        uint256 buildingId,
        uint8 milestone
    ) external view returns (uint256) {
        Escrow storage escrow = escrows[buildingId];
        require(escrow.exists, "EscrowManager: escrow not configured");
        return escrow.milestoneReleaseAmount[milestone];
    }

    /**
     * @notice Gets the amount of USDC available to be released for pending milestones
     * @param buildingId The ID of the building
     * @return The total amount that can be released for confirmed but not yet released milestones
     */
    function getPendingReleaseAmount(
        uint256 buildingId
    ) external view returns (uint256) {
        Escrow storage escrow = escrows[buildingId];
        require(escrow.exists, "EscrowManager: escrow not configured");

        // Get current milestone from BuildingRegistry
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint8 currentMilestone,
            bool exists
        ) = buildingRegistry.getBuilding(buildingId);

        if (!exists || currentMilestone <= escrow.lastReleasedMilestone) {
            return 0;
        }

        uint256 totalPending = 0;
        for (
            uint8 i = escrow.lastReleasedMilestone;
            i < currentMilestone;
            i++
        ) {
            totalPending += escrow.milestoneReleaseAmount[i];
        }

        return totalPending;
    }

    /**
     * @notice Emergency function to withdraw funds (only owner)
     * @dev Should only be used in emergency situations
     * @param amount The amount of USDC to withdraw (0 = all)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        IERC20 usdc = IERC20(usdcToken);
        uint256 balance = usdc.balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;

        require(
            withdrawAmount > 0 && withdrawAmount <= balance,
            "EscrowManager: invalid withdrawal amount"
        );

        require(
            usdc.transfer(owner(), withdrawAmount),
            "EscrowManager: withdrawal transfer failed"
        );
    }
}

