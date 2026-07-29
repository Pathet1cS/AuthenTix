// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EventTicketNFT
 * @notice Decentralized E-Ticketing Platform Smart Contract for Optimism Sepolia.
 * Handles NFT ticket minting, resale caps, ticket usage redemption, and access control.
 */
contract EventTicketNFT is ERC721URIStorage, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    struct EventConfig {
        uint256 maxResalePrice;
        uint256 saleDeadline;
        uint256 totalSupply;
        uint256 mintedSupply;
        bool exists;
    }

    struct ResaleListing {
        address seller;
        uint256 price;
        bool isActive;
    }

    // Mapping from eventId => EventConfig
    mapping(uint256 => EventConfig) public events;

    // Mapping from tokenId => eventId
    mapping(uint256 => uint256) public ticketEventId;

    // Mapping from tokenId => isUsed (ticket entry state)
    mapping(uint256 => bool) public isTicketUsed;

    // Mapping from tokenId => ResaleListing
    mapping(uint256 => ResaleListing) public resaleListings;

    // Events
    event EventCreated(
        uint256 indexed eventId,
        uint256 maxResalePrice,
        uint256 saleDeadline,
        uint256 totalSupply
    );

    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed owner,
        string tokenURI
    );

    event TicketTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to
    );

    event TicketUsed(
        uint256 indexed tokenId,
        uint256 indexed eventId
    );

    event ListingCreated(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    event ListingSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );

    event ListingCancelled(
        uint256 indexed tokenId,
        address indexed seller
    );

    constructor(address defaultAdmin, address minterRelayer) ERC721("AuthenTix Ticket", "ATIX") {
        require(defaultAdmin != address(0), "Invalid admin address");
        require(minterRelayer != address(0), "Invalid minter address");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ORGANIZER_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minterRelayer);

        _nextTokenId = 1;
    }

    /**
     * @notice Create an event configuration on-chain.
     */
    function createEvent(
        uint256 eventId,
        uint256 maxResalePrice,
        uint256 saleDeadline,
        uint256 totalSupply
    ) external onlyRole(ORGANIZER_ROLE) whenNotPaused {
        require(!events[eventId].exists, "Event ID already exists");
        require(totalSupply > 0, "Total supply must be > 0");
        require(saleDeadline > block.timestamp, "Deadline must be in the future");

        events[eventId] = EventConfig({
            maxResalePrice: maxResalePrice,
            saleDeadline: saleDeadline,
            totalSupply: totalSupply,
            mintedSupply: 0,
            exists: true
        });

        emit EventCreated(eventId, maxResalePrice, saleDeadline, totalSupply);
    }

    /**
     * @notice Mint a ticket NFT to a buyer wallet. Restrict to MINTER_ROLE (relayer).
     */
    function mintTicket(
        address buyer,
        uint256 eventId,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(buyer != address(0), "Invalid buyer address");
        require(events[eventId].exists, "Event does not exist");
        
        EventConfig storage eventConfig = events[eventId];
        require(eventConfig.mintedSupply < eventConfig.totalSupply, "Event sold out");
        require(block.timestamp <= eventConfig.saleDeadline, "Ticket sale deadline passed");

        uint256 tokenId = _nextTokenId++;
        eventConfig.mintedSupply += 1;
        ticketEventId[tokenId] = eventId;

        _safeMint(buyer, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit TicketMinted(tokenId, eventId, buyer, metadataURI);
        emit TicketTransferred(tokenId, address(0), buyer);

        return tokenId;
    }

    /**
     * @notice Create a resale listing for an owned ticket NFT.
     */
    function createListing(uint256 tokenId, uint256 price) external whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(!isTicketUsed[tokenId], "Ticket already used");

        uint256 eventId = ticketEventId[tokenId];
        EventConfig memory eventConfig = events[eventId];

        require(block.timestamp <= eventConfig.saleDeadline, "Event sale deadline passed");
        require(price <= eventConfig.maxResalePrice, "Price exceeds max resale cap");

        resaleListings[tokenId] = ResaleListing({
            seller: msg.sender,
            price: price,
            isActive: true
        });

        emit ListingCreated(tokenId, msg.sender, price);
    }

    /**
     * @notice Cancel an active resale listing.
     */
    function cancelListing(uint256 tokenId) external whenNotPaused {
        ResaleListing storage listing = resaleListings[tokenId];
        require(listing.isActive, "No active listing");
        require(listing.seller == msg.sender, "Not listing seller");

        listing.isActive = false;

        emit ListingCancelled(tokenId, msg.sender);
    }

    /**
     * @notice Buy a resold ticket NFT.
     */
    function buyResoldTicket(uint256 tokenId) external payable nonReentrant whenNotPaused {
        ResaleListing storage listing = resaleListings[tokenId];
        require(listing.isActive, "Listing not active");
        require(msg.value >= listing.price, "Insufficient payment amount");

        address seller = listing.seller;
        require(ownerOf(tokenId) == seller, "Seller no longer owns token");

        uint256 eventId = ticketEventId[tokenId];
        EventConfig memory eventConfig = events[eventId];
        require(block.timestamp <= eventConfig.saleDeadline, "Event sale deadline passed");
        require(!isTicketUsed[tokenId], "Ticket already used");

        // Mark listing as inactive before transfer to prevent reentrancy
        listing.isActive = false;

        // Transfer funds to seller
        (bool success, ) = payable(seller).call{value: listing.price}("");
        require(success, "ETH transfer to seller failed");

        // Refund excess payment
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSuccess, "ETH refund failed");
        }

        // Transfer NFT to buyer
        _transfer(seller, msg.sender, tokenId);

        emit TicketTransferred(tokenId, seller, msg.sender);
        emit ListingSold(tokenId, seller, msg.sender, listing.price);
    }

    /**
     * @notice Mark ticket as redeemed/used. Callable by MINTER_ROLE or ORGANIZER_ROLE.
     */
    function markUsed(uint256 tokenId) external whenNotPaused {
        require(
            hasRole(MINTER_ROLE, msg.sender) || hasRole(ORGANIZER_ROLE, msg.sender),
            "Caller lacks permission to mark ticket used"
        );
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(!isTicketUsed[tokenId], "Ticket already used");

        isTicketUsed[tokenId] = true;

        // Cancel any active listing if ticket is used
        if (resaleListings[tokenId].isActive) {
            resaleListings[tokenId].isActive = false;
        }

        emit TicketUsed(tokenId, ticketEventId[tokenId]);
    }

    /**
     * @notice Emergency Pause functionality
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume contract functionality
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Override supportsInterface for AccessControl and ERC721URIStorage.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
