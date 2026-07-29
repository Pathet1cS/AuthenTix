import { expect } from "chai";
import { ethers } from "hardhat";
import { EventTicketNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EventTicketNFT Smart Contract", function () {
  let ticketContract: EventTicketNFT;
  let admin: HardhatEthersSigner;
  let minterRelayer: HardhatEthersSigner;
  let organizer: HardhatEthersSigner;
  let buyer1: HardhatEthersSigner;
  let buyer2: HardhatEthersSigner;

  const eventId = 1;
  const maxResalePrice = ethers.parseEther("0.05");
  const totalSupply = 10;
  const metadataURI = "ipfs://QmTestMetadataCID123";

  let saleDeadline: number;

  beforeEach(async function () {
    [admin, minterRelayer, organizer, buyer1, buyer2] = await ethers.getSigners();

    const block = await ethers.provider.getBlock("latest");
    saleDeadline = (block?.timestamp || Math.floor(Date.now() / 1000)) + 3600; // 1 hour from now

    const EventTicketNFTFactory = await ethers.getContractFactory("EventTicketNFT");
    ticketContract = await EventTicketNFTFactory.deploy(admin.address, minterRelayer.address);
    await ticketContract.waitForDeployment();

    // Grant ORGANIZER_ROLE to organizer
    const ORGANIZER_ROLE = await ticketContract.ORGANIZER_ROLE();
    await ticketContract.connect(admin).grantRole(ORGANIZER_ROLE, organizer.address);
  });

  describe("Deployment & Access Control", function () {
    it("should assign correct initial roles", async function () {
      const DEFAULT_ADMIN_ROLE = await ticketContract.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await ticketContract.MINTER_ROLE();
      const ORGANIZER_ROLE = await ticketContract.ORGANIZER_ROLE();

      expect(await ticketContract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await ticketContract.hasRole(MINTER_ROLE, minterRelayer.address)).to.be.true;
      expect(await ticketContract.hasRole(ORGANIZER_ROLE, organizer.address)).to.be.true;
    });

    it("should revert if initialized with zero address", async function () {
      const Factory = await ethers.getContractFactory("EventTicketNFT");
      await expect(Factory.deploy(ethers.ZeroAddress, minterRelayer.address)).to.be.revertedWith("Invalid admin address");
      await expect(Factory.deploy(admin.address, ethers.ZeroAddress)).to.be.revertedWith("Invalid minter address");
    });
  });

  describe("Event Creation", function () {
    it("should allow organizer to create an event", async function () {
      await expect(ticketContract.connect(organizer).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply))
        .to.emit(ticketContract, "EventCreated")
        .withArgs(eventId, maxResalePrice, saleDeadline, totalSupply);

      const eventConfig = await ticketContract.events(eventId);
      expect(eventConfig.exists).to.be.true;
      expect(eventConfig.totalSupply).to.equal(totalSupply);
      expect(eventConfig.maxResalePrice).to.equal(maxResalePrice);
    });

    it("should reject non-organizer event creation", async function () {
      await expect(
        ticketContract.connect(buyer1).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply)
      ).to.be.revertedWithCustomError(ticketContract, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Ticket Minting", function () {
    beforeEach(async function () {
      await ticketContract.connect(organizer).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply);
    });

    it("should allow minter relayer to mint ticket to buyer", async function () {
      await expect(ticketContract.connect(minterRelayer).mintTicket(buyer1.address, eventId, metadataURI))
        .to.emit(ticketContract, "TicketMinted")
        .withArgs(1, eventId, buyer1.address, metadataURI);

      expect(await ticketContract.ownerOf(1)).to.equal(buyer1.address);
      expect(await ticketContract.tokenURI(1)).to.equal(metadataURI);
    });

    it("should reject non-minter ticket minting", async function () {
      await expect(
        ticketContract.connect(buyer1).mintTicket(buyer1.address, eventId, metadataURI)
      ).to.be.revertedWithCustomError(ticketContract, "AccessControlUnauthorizedAccount");
    });

    it("should enforce total supply limit", async function () {
      // Create small event with capacity 1
      const smallEventId = 2;
      await ticketContract.connect(organizer).createEvent(smallEventId, maxResalePrice, saleDeadline, 1);

      // First mint succeeds
      await ticketContract.connect(minterRelayer).mintTicket(buyer1.address, smallEventId, metadataURI);

      // Second mint fails
      await expect(
        ticketContract.connect(minterRelayer).mintTicket(buyer2.address, smallEventId, metadataURI)
      ).to.be.revertedWith("Event sold out");
    });
  });

  describe("Resale Marketplace & Restrictions", function () {
    beforeEach(async function () {
      await ticketContract.connect(organizer).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply);
      await ticketContract.connect(minterRelayer).mintTicket(buyer1.address, eventId, metadataURI);
    });

    it("should allow owner to list ticket for resale within price cap", async function () {
      const listingPrice = ethers.parseEther("0.04"); // <= 0.05 maxResalePrice
      await expect(ticketContract.connect(buyer1).createListing(1, listingPrice))
        .to.emit(ticketContract, "ListingCreated")
        .withArgs(1, buyer1.address, listingPrice);

      const listing = await ticketContract.resaleListings(1);
      expect(listing.isActive).to.be.true;
      expect(listing.price).to.equal(listingPrice);
    });

    it("should reject listing price exceeding maxResalePrice cap", async function () {
      const excessivePrice = ethers.parseEther("0.1"); // > 0.05 maxResalePrice
      await expect(ticketContract.connect(buyer1).createListing(1, excessivePrice)).to.be.revertedWith(
        "Price exceeds max resale cap"
      );
    });

    it("should process resold ticket purchase and transfer funds", async function () {
      const listingPrice = ethers.parseEther("0.04");
      await ticketContract.connect(buyer1).createListing(1, listingPrice);

      const initialSellerBalance = await ethers.provider.getBalance(buyer1.address);

      await expect(ticketContract.connect(buyer2).buyResoldTicket(1, { value: listingPrice }))
        .to.emit(ticketContract, "ListingSold")
        .withArgs(1, buyer1.address, buyer2.address, listingPrice);

      // Buyer2 now owns token 1
      expect(await ticketContract.ownerOf(1)).to.equal(buyer2.address);

      // Seller received ETH
      const finalSellerBalance = await ethers.provider.getBalance(buyer1.address);
      expect(finalSellerBalance - initialSellerBalance).to.equal(listingPrice);
    });
  });

  describe("Ticket Usage & Verification", function () {
    beforeEach(async function () {
      await ticketContract.connect(organizer).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply);
      await ticketContract.connect(minterRelayer).mintTicket(buyer1.address, eventId, metadataURI);
    });

    it("should allow minter/organizer to mark ticket as used", async function () {
      await expect(ticketContract.connect(minterRelayer).markUsed(1))
        .to.emit(ticketContract, "TicketUsed")
        .withArgs(1, eventId);

      expect(await ticketContract.isTicketUsed(1)).to.be.true;
    });

    it("should prevent double redemption of ticket", async function () {
      await ticketContract.connect(minterRelayer).markUsed(1);
      await expect(ticketContract.connect(minterRelayer).markUsed(1)).to.be.revertedWith("Ticket already used");
    });
  });

  describe("Emergency Pause", function () {
    it("should pause and unpause contract functions", async function () {
      await ticketContract.connect(admin).pause();
      expect(await ticketContract.paused()).to.be.true;

      await expect(
        ticketContract.connect(organizer).createEvent(eventId, maxResalePrice, saleDeadline, totalSupply)
      ).to.be.revertedWithCustomError(ticketContract, "EnforcedPause");

      await ticketContract.connect(admin).unpause();
      expect(await ticketContract.paused()).to.be.false;
    });
  });
});
