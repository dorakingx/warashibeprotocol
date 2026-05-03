// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {StrawNFT} from "../src/StrawNFT.sol";
import {WarashibeEscrow} from "../src/WarashibeEscrow.sol";

contract WarashibeEscrowTest is Test {
    WarashibeEscrow internal escrow;
    StrawNFT internal straw;
    StrawNFT internal apple;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        escrow = new WarashibeEscrow();
        straw = new StrawNFT();
        apple = new StrawNFT();
    }

    function test_createOffer() public {
        vm.startPrank(alice);
        uint256 makerId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), makerId);

        uint256 offerId = escrow.createOffer(address(straw), makerId, address(apple), 99);
        vm.stopPrank();

        assertEq(offerId, 1);
        assertEq(straw.ownerOf(makerId), address(escrow));

        (uint256 id, address maker,, uint256 mId, address desiredAddr, uint256 desiredId, bool active) =
            escrow.offers(offerId);
        assertEq(id, offerId);
        assertEq(maker, alice);
        assertEq(mId, makerId);
        assertEq(desiredAddr, address(apple));
        assertEq(desiredId, 99);
        assertTrue(active);
    }

    function test_acceptOffer() public {
        vm.startPrank(alice);
        uint256 strawId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), strawId);
        uint256 offerId = escrow.createOffer(address(straw), strawId, address(apple), 1);
        vm.stopPrank();

        vm.startPrank(bob);
        uint256 appleId = apple.mintStarterStraw(bob);
        assertEq(appleId, 1);
        apple.approve(address(escrow), appleId);
        escrow.acceptOffer(offerId);
        vm.stopPrank();

        assertEq(straw.ownerOf(strawId), bob);
        assertEq(apple.ownerOf(appleId), alice);

        (,,,,,, bool active) = escrow.offers(offerId);
        assertFalse(active);
    }

    function test_cancelOffer() public {
        vm.startPrank(alice);
        uint256 strawId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), strawId);
        uint256 offerId = escrow.createOffer(address(straw), strawId, address(apple), 1);

        escrow.cancelOffer(offerId);
        vm.stopPrank();

        assertEq(straw.ownerOf(strawId), alice);

        (,,,,,, bool active) = escrow.offers(offerId);
        assertFalse(active);
    }

    function test_RevertWhen_cancelNotMaker() public {
        vm.startPrank(alice);
        uint256 strawId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), strawId);
        uint256 offerId = escrow.createOffer(address(straw), strawId, address(apple), 1);
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert(bytes("NOT_MAKER"));
        escrow.cancelOffer(offerId);
    }

    function test_RevertWhen_acceptInactiveOffer() public {
        vm.startPrank(alice);
        uint256 strawId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), strawId);
        uint256 offerId = escrow.createOffer(address(straw), strawId, address(apple), 1);
        escrow.cancelOffer(offerId);
        vm.stopPrank();

        vm.startPrank(bob);
        apple.mintStarterStraw(bob);
        apple.approve(address(escrow), 1);
        vm.expectRevert(bytes("OFFER_INACTIVE"));
        escrow.acceptOffer(offerId);
        vm.stopPrank();
    }

    function test_RevertWhen_acceptAsMaker() public {
        vm.startPrank(alice);
        uint256 strawId = straw.mintStarterStraw(alice);
        straw.approve(address(escrow), strawId);
        uint256 offerId = escrow.createOffer(address(straw), strawId, address(apple), 1);
        vm.expectRevert(bytes("MAKER_CANNOT_ACCEPT"));
        escrow.acceptOffer(offerId);
        vm.stopPrank();
    }
}
