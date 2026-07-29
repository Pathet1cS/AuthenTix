import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log(`Starting deployment to network: ${network.name}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Deployment configuration
  const adminAddress = process.env.ADMIN_ADDRESS || deployer.address;
  const minterRelayerAddress = process.env.MINTER_RELAYER_ADDRESS || deployer.address;

  console.log(`Configured Admin: ${adminAddress}`);
  console.log(`Configured Minter Relayer: ${minterRelayerAddress}`);

  const EventTicketNFTFactory = await ethers.getContractFactory("EventTicketNFT");
  const ticketContract = await EventTicketNFTFactory.deploy(adminAddress, minterRelayerAddress);

  await ticketContract.waitForDeployment();
  const contractAddress = await ticketContract.getAddress();

  console.log(`✅ EventTicketNFT deployed successfully to: ${contractAddress}`);

  // Export contract deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    contractAddress: contractAddress,
    adminAddress: adminAddress,
    minterRelayerAddress: minterRelayerAddress,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${network.name}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Exported deployment details to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
