// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BotRegistry} from "../src/BotRegistry.sol";

/**
 * @title DeployBotRegistry
 * @notice Deployment script for BotRegistry contract on Polygon
 * 
 * Usage:
 *   1. Set your deployer private key:
 *      export PRIVATE_KEY=0x...
 * 
 *   2. Run the deployment (Polygon Mainnet):
 *      forge script script/DeployBotRegistry.s.sol \
 *        --rpc-url https://polygon-rpc.com \
 *        --broadcast \
 *        --verify
 * 
 *   3. After deployment, copy the contract address to:
 *      - packages/contracts/deployments/polygonMainnet.json
 *      - apps/web/.env.local (NEXT_PUBLIC_BOT_REGISTRY_ADDRESS)
 */
contract DeployBotRegistry is Script {
    function run() external {
        // Load private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("");
        console2.log("========================================");
        console2.log("  BotMarket - BotRegistry Deployment");
        console2.log("========================================");
        console2.log("");
        console2.log("Network: Polygon Mainnet (Chain ID: 137)");
        console2.log("Deployer:", deployer);
        console2.log("");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy BotRegistry
        BotRegistry registry = new BotRegistry();

        vm.stopBroadcast();

        // Log deployment info
        console2.log("========================================");
        console2.log("  DEPLOYMENT SUCCESSFUL!");
        console2.log("========================================");
        console2.log("");
        console2.log("BotRegistry deployed at:");
        console2.log(address(registry));
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Update packages/contracts/deployments/polygonMainnet.json");
        console2.log("2. Set NEXT_PUBLIC_BOT_REGISTRY_ADDRESS in apps/web/.env.local");
        console2.log("");
        console2.log("View on PolygonScan:");
        console2.log(string.concat(
            "https://polygonscan.com/address/",
            vm.toString(address(registry))
        ));
        console2.log("");
    }
}
