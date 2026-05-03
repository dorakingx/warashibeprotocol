// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Minimal {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title WarashibeEscrow
/// @notice Trustless P2P NFT-for-NFT swaps: maker escrows their NFT; any holder of the desired NFT can accept.
contract WarashibeEscrow {
    struct Offer {
        uint256 offerId;
        address maker;
        address makerTokenAddress;
        uint256 makerTokenId;
        address desiredTokenAddress;
        uint256 desiredTokenId;
        bool isActive;
    }

    uint256 public nextOfferId = 1;
    mapping(uint256 => Offer) public offers;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed maker,
        address indexed makerTokenAddress,
        uint256 makerTokenId,
        address desiredTokenAddress,
        uint256 desiredTokenId
    );
    event OfferAccepted(uint256 indexed offerId, address indexed taker, address indexed maker);
    event OfferCancelled(uint256 indexed offerId);

    function createOffer(
        address makerTokenAddress,
        uint256 makerTokenId,
        address desiredTokenAddress,
        uint256 desiredTokenId
    ) external returns (uint256 offerId) {
        require(makerTokenAddress != address(0) && desiredTokenAddress != address(0), "ZERO_COLLECTION");

        offerId = nextOfferId++;
        IERC721Minimal(makerTokenAddress).transferFrom(msg.sender, address(this), makerTokenId);

        offers[offerId] = Offer({
            offerId: offerId,
            maker: msg.sender,
            makerTokenAddress: makerTokenAddress,
            makerTokenId: makerTokenId,
            desiredTokenAddress: desiredTokenAddress,
            desiredTokenId: desiredTokenId,
            isActive: true
        });

        emit OfferCreated(
            offerId, msg.sender, makerTokenAddress, makerTokenId, desiredTokenAddress, desiredTokenId
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
