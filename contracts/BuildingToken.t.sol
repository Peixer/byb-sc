// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BuildingToken} from "./BuildingToken.sol";
import {MockBuildingRegistry} from "./MockBuildingRegistry.sol";
import {IBuildingRegistry} from "./IBuildingRegistry.sol";
import {Test} from "forge-std/Test.sol";

contract BuildingTokenTest is Test {
    BuildingToken public token;
    MockBuildingRegistry public registry;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    
    uint256 public constant BUILDING_ID = 1;
    uint256 public constant TOTAL_SUPPLY = 1000000 * 10**18;
    
    function setUp() public {
        // Deploy mock registry
        registry = new MockBuildingRegistry();
        
        // Register a building
        registry.registerBuilding(
            BUILDING_ID,
            "Tower A",
            "ipfs://QmTest123",
            address(0x4),
            IBuildingRegistry.BuildingStatus.UnderConstruction
        );
        
        // Add some milestones
        registry.addMilestone(BUILDING_ID, "Foundation Complete", block.timestamp + 30 days, false);
        registry.addMilestone(BUILDING_ID, "Structure Complete", block.timestamp + 180 days, false);
        
        // Deploy token
        token = new BuildingToken(
            "Tower A Token",
            "TWRA",
            TOTAL_SUPPLY,
            BUILDING_ID,
            address(registry),
            owner
        );
    }
    
    function test_InitialSupply() public view {
        require(token.totalSupply() == TOTAL_SUPPLY, "Total supply should match");
        require(token.balanceOf(owner) == TOTAL_SUPPLY, "Owner should have all tokens");
    }
    
    function test_BuildingId() public view {
        require(token.buildingId() == BUILDING_ID, "Building ID should match");
    }
    
    function test_GetBuildingInfo() public view {
        (
            string memory name,
            string memory metadataURI,
            address developer,
            IBuildingRegistry.BuildingStatus status,
            IBuildingRegistry.Milestone[] memory milestones
        ) = token.getBuildingInfo();
        
        require(keccak256(bytes(name)) == keccak256(bytes("Tower A")), "Name should match");
        require(keccak256(bytes(metadataURI)) == keccak256(bytes("ipfs://QmTest123")), "Metadata URI should match");
        require(developer == address(0x4), "Developer should match");
        require(status == IBuildingRegistry.BuildingStatus.UnderConstruction, "Status should match");
        require(milestones.length == 2, "Should have 2 milestones");
    }
    
    function test_TransfersNotRestrictedByDefault() public {
        vm.prank(owner);
        token.transfer(user1, 1000);
        
        require(token.balanceOf(user1) == 1000, "Transfer should succeed");
    }
    
    function test_SetTransfersRestricted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit BuildingToken.TransfersRestricted(true);
        token.setTransfersRestricted(true);
        
        require(token.transfersRestricted() == true, "Transfers should be restricted");
    }
    
    function test_SetTransfersRestrictedOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        token.setTransfersRestricted(true);
    }
    
    function test_UpdateWhitelist() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit BuildingToken.WhitelistUpdated(user1, true);
        token.updateWhitelist(user1, true);
        
        require(token.isWhitelisted(user1) == true, "User1 should be whitelisted");
    }
    
    function test_UpdateWhitelistOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        token.updateWhitelist(user2, true);
    }
    
    function test_TransferRestrictedToWhitelistedAddresses() public {
        // Enable restrictions
        vm.prank(owner);
        token.setTransfersRestricted(true);
        
        // Try transfer without whitelist - should fail
        vm.prank(owner);
        vm.expectRevert("BuildingToken: transfer restricted to whitelisted addresses only");
        token.transfer(user1, 1000);
        
        // Whitelist both addresses
        vm.prank(owner);
        token.updateWhitelist(owner, true);
        vm.prank(owner);
        token.updateWhitelist(user1, true);
        
        // Now transfer should work
        vm.prank(owner);
        token.transfer(user1, 1000);
        
        require(token.balanceOf(user1) == 1000, "Transfer should succeed with whitelist");
    }
    
    function test_TransferBetweenWhitelistedUsers() public {
        // Enable restrictions and whitelist users
        vm.prank(owner);
        token.setTransfersRestricted(true);
        
        vm.prank(owner);
        token.updateWhitelist(owner, true);
        vm.prank(owner);
        token.updateWhitelist(user1, true);
        vm.prank(owner);
        token.updateWhitelist(user2, true);
        
        // Transfer from owner to user1
        vm.prank(owner);
        token.transfer(user1, 1000);
        
        // Transfer from user1 to user2
        vm.prank(user1);
        token.transfer(user2, 500);
        
        require(token.balanceOf(user2) == 500, "Transfer between whitelisted users should work");
    }
    
    function test_TransferFromNonWhitelistedFails() public {
        // Enable restrictions and whitelist only user2
        vm.prank(owner);
        token.setTransfersRestricted(true);
        
        vm.prank(owner);
        token.updateWhitelist(owner, true);
        vm.prank(owner);
        token.updateWhitelist(user1, true);
        
        // Transfer some tokens to user1
        vm.prank(owner);
        token.transfer(user1, 1000);
        
        // Remove user1 from whitelist
        vm.prank(owner);
        token.updateWhitelist(user1, false);
        
        // Whitelist user2
        vm.prank(owner);
        token.updateWhitelist(user2, true);
        
        // Try to transfer from non-whitelisted user1 to whitelisted user2 - should fail
        vm.prank(user1);
        vm.expectRevert("BuildingToken: transfer restricted to whitelisted addresses only");
        token.transfer(user2, 500);
    }
    
    function test_CannotWhitelistZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("BuildingToken: cannot whitelist zero address");
        token.updateWhitelist(address(0), true);
    }
    
    function test_ConstructorValidation() public {
        // Test zero registry address
        vm.expectRevert("BuildingToken: registry address cannot be zero");
        new BuildingToken(
            "Test",
            "TST",
            TOTAL_SUPPLY,
            BUILDING_ID,
            address(0),
            owner
        );
        
        // Test zero initial owner
        vm.expectRevert("BuildingToken: initial owner cannot be zero");
        new BuildingToken(
            "Test",
            "TST",
            TOTAL_SUPPLY,
            BUILDING_ID,
            address(registry),
            address(0)
        );
        
        // Test zero total supply
        vm.expectRevert("BuildingToken: total supply must be greater than zero");
        new BuildingToken(
            "Test",
            "TST",
            0,
            BUILDING_ID,
            address(registry),
            owner
        );
    }
}
