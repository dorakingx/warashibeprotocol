// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Minimal {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title WarashibeEscrow
/// @notice Trustless P2P NFT-for-NFT swaps: maker escrows their NFT; any holder of the desired NFT can accept.
/// @dev `createOffer` pulls from `maker`; `msg.sender` must be authorized to move that NFT (EOA, smart account, or approved relayer).
contract WarashibeEscrow {
    struct Offer {
        uint256 offerId;
        address maker;
        address makerTokenAddress;
        uint256 makerTokenId;
        address desiredTokenAddress;
        uint256 desiredTokenId;
        address agent;
        bool isActive;
    }

    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) public offers;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed maker,
        address indexed agent,
        address makerTokenAddress,
        uint256 makerTokenId,
        address desiredTokenAddress,
        uint256 desiredTokenId
    );
    event OfferAccepted(uint256 indexed offerId, address indexed taker, address indexed maker);
    event OfferCancelled(uint256 indexed offerId);

    function createOffer(
        address maker,
        address makerTokenAddress,
        uint256 makerTokenId,
        address desiredTokenAddress,
        uint256 desiredTokenId,
        address agent
    ) external returns (uint256 offerId) {
        require(maker != address(0), "ZERO_MAKER");
        require(makerTokenAddress != address(0) && desiredTokenAddress != address(0), "ZERO_COLLECTION");

        offerId = nextOfferId++;
        IERC721Minimal(makerTokenAddress).transferFrom(maker, address(this), makerTokenId);

        offers[offerId] = Offer({
            offerId: offerId,
            maker: maker,
            makerTokenAddress: makerTokenAddress,
            makerTokenId: makerTokenId,
            desiredTokenAddress: desiredTokenAddress,
            desiredTokenId: desiredTokenId,
            agent: agent,
            isActive: true
        });

        emit OfferCreated(
            offerId, maker, agent, makerTokenAddress, makerTokenId, desiredTokenAddress, desiredTokenId
        );
    }

    function acceptOffer(uint256 offerId) external {
        Offer storage offerStorage = offers[offerId];
        require(offerStorage.isActive, "OFFER_INACTIVE");
        require(msg.sender != offerStorage.maker, "MAKER_CANNOT_ACCEPT");

        address maker = offerStorage.maker;
        address makerTokenAddress = offerStorage.makerTokenAddress;
        uint256 makerTokenId = offerStorage.makerTokenId;
        address desiredTokenAddress = offerStorage.desiredTokenAddress;
        uint256 desiredTokenId = offerStorage.desiredTokenId;

        offerStorage.isActive = false;

        IERC721Minimal(desiredTokenAddress).transferFrom(msg.sender, maker, desiredTokenId);
        IERC721Minimal(makerTokenAddress).transferFrom(address(this), msg.sender, makerTokenId);

        emit OfferAccepted(offerId, msg.sender, maker);
    }

    function cancelOffer(uint256 offerId) external {
        Offer storage offerStorage = offers[offerId];
        require(offerStorage.isActive, "OFFER_INACTIVE");
        require(msg.sender == offerStorage.maker, "NOT_MAKER");

        address maker = offerStorage.maker;
        address makerTokenAddress = offerStorage.makerTokenAddress;
        uint256 makerTokenId = offerStorage.makerTokenId;

        offerStorage.isActive = false;

        IERC721Minimal(makerTokenAddress).transferFrom(address(this), maker, makerTokenId);

        emit OfferCancelled(offerId);
    }
}
