// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StrawNFT
/// @notice Minimal ERC721 implementation for the free starting item.
contract StrawNFT {
    string public name = "Warashibe Straw";
    string public symbol = "STRAW";

    uint256 private _nextTokenId = 1;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _ownerOf[tokenId];
        require(owner != address(0), "NOT_MINTED");
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "ZERO_ADDRESS");
        return _balanceOf[owner];
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function approve(address spender, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "NOT_AUTHORIZED");
        _tokenApprovals[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(to != address(0), "ZERO_ADDRESS");
        address owner = ownerOf(tokenId);
        require(owner == from, "WRONG_FROM");
        require(
            msg.sender == owner ||
                msg.sender == _tokenApprovals[tokenId] ||
                _operatorApprovals[owner][msg.sender],
            "NOT_AUTHORIZED"
        );

        unchecked {
            _balanceOf[from]--;
            _balanceOf[to]++;
        }
        _ownerOf[tokenId] = to;
        delete _tokenApprovals[tokenId];

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function mintStarterStraw(address to) external returns (uint256 tokenId) {
        require(to != address(0), "ZERO_ADDRESS");
        tokenId = _nextTokenId++;
        _ownerOf[tokenId] = to;
        _balanceOf[to]++;
        emit Transfer(address(0), to, tokenId);
    }
}
