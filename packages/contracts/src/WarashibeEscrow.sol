// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Minimal {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @title WarashibeEscrow
/// @notice Boilerplate escrow for trustless NFT-for-NFT swaps.
contract WarashibeEscrow {
    enum TradeStatus {
        None,
        Open,
        DepositedByBoth,
        Completed,
        Cancelled
    }

    struct Trade {
        address maker;
        address taker;
        address makerNft;
        uint256 makerTokenId;
        address takerNft;
        uint256 takerTokenId;
        bool makerDeposited;
        bool takerDeposited;
        TradeStatus status;
    }

    uint256 public nextTradeId = 1;
    mapping(uint256 => Trade) public trades;

    event TradeOpened(
        uint256 indexed tradeId,
        address indexed maker,
        address indexed makerNft,
        uint256 makerTokenId,
        address taker,
        address takerNft,
        uint256 takerTokenId
    );
    event AssetDeposited(uint256 indexed tradeId, address indexed depositor);
    event TradeCompleted(uint256 indexed tradeId);
    event TradeCancelled(uint256 indexed tradeId);

    function openTrade(
        address taker,
        address makerNft,
        uint256 makerTokenId,
        address takerNft,
        uint256 takerTokenId
    ) external returns (uint256 tradeId) {
        require(taker != address(0), "TAKER_REQUIRED");
        require(makerNft != address(0) && takerNft != address(0), "NFT_REQUIRED");

        tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            maker: msg.sender,
            taker: taker,
            makerNft: makerNft,
            makerTokenId: makerTokenId,
            takerNft: takerNft,
            takerTokenId: takerTokenId,
            makerDeposited: false,
            takerDeposited: false,
            status: TradeStatus.Open
        });

        emit TradeOpened(tradeId, msg.sender, makerNft, makerTokenId, taker, takerNft, takerTokenId);
    }

    function deposit(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Open, "TRADE_NOT_OPEN");

        if (msg.sender == trade.maker) {
            require(!trade.makerDeposited, "MAKER_ALREADY_DEPOSITED");
            IERC721Minimal(trade.makerNft).transferFrom(msg.sender, address(this), trade.makerTokenId);
            trade.makerDeposited = true;
        } else if (msg.sender == trade.taker) {
            require(!trade.takerDeposited, "TAKER_ALREADY_DEPOSITED");
            IERC721Minimal(trade.takerNft).transferFrom(msg.sender, address(this), trade.takerTokenId);
            trade.takerDeposited = true;
        } else {
            revert("UNAUTHORIZED_DEPOSITOR");
        }

        emit AssetDeposited(tradeId, msg.sender);

        if (trade.makerDeposited && trade.takerDeposited) {
            trade.status = TradeStatus.DepositedByBoth;
        }
    }

    function completeTrade(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(
            trade.status == TradeStatus.DepositedByBoth,
            "TRADE_NOT_READY"
        );

        IERC721Minimal(trade.makerNft).transferFrom(address(this), trade.taker, trade.makerTokenId);
        IERC721Minimal(trade.takerNft).transferFrom(address(this), trade.maker, trade.takerTokenId);
        trade.status = TradeStatus.Completed;

        emit TradeCompleted(tradeId);
    }

    function cancelTrade(uint256 tradeId) external {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Open || trade.status == TradeStatus.DepositedByBoth, "CANNOT_CANCEL");
        require(msg.sender == trade.maker || msg.sender == trade.taker, "UNAUTHORIZED");

        if (trade.makerDeposited) {
            IERC721Minimal(trade.makerNft).transferFrom(address(this), trade.maker, trade.makerTokenId);
        }
        if (trade.takerDeposited) {
            IERC721Minimal(trade.takerNft).transferFrom(address(this), trade.taker, trade.takerTokenId);
        }

        trade.status = TradeStatus.Cancelled;
        emit TradeCancelled(tradeId);
    }
}
