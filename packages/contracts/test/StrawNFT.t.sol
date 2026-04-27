// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {StrawNFT} from "../src/StrawNFT.sol";

contract StrawNFTTest is Test {
    StrawNFT internal straw;

    function setUp() public {
        straw = new StrawNFT();
    }

    function testMintStarterStraw() public {
        address alice = address(0xA11CE);
        uint256 tokenId = straw.mintStarterStraw(alice);

        assertEq(tokenId, 1);
        assertEq(straw.ownerOf(tokenId), alice);
        assertEq(straw.balanceOf(alice), 1);
    }
}
