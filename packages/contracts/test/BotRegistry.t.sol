// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BotRegistry} from "../src/BotRegistry.sol";

contract BotRegistryTest is Test {
    BotRegistry public registry;

    function setUp() public {
        registry = new BotRegistry();
    }

    function testCreateBot() public {
        string memory metadataURI = "ipfs://QmTest";
        bytes32 configHash = keccak256("test config");
        string memory visibility = "PUBLIC";
        uint256 feeBps = 100; // 1%

        uint256 botId = registry.createBot(metadataURI, configHash, visibility, feeBps);

        assertEq(botId, 1);
        assertEq(registry.nextBotId(), 2);

        BotRegistry.Bot memory bot = registry.getBot(botId);
        assertEq(bot.botId, 1);
        assertEq(bot.creator, address(this));
        assertEq(bot.parentBotId, 0);
        assertEq(bot.metadataURI, metadataURI);
        assertEq(bot.configHash, configHash);
        assertEq(keccak256(bytes(bot.visibility)), keccak256(bytes(visibility)));
        assertEq(bot.feeBps, feeBps);
    }

    function testForkBot() public {
        // Create parent bot
        uint256 parentBotId = registry.createBot(
            "ipfs://QmParent",
            keccak256("parent config"),
            "PUBLIC",
            100
        );

        // Fork bot
        uint256 forkBotId = registry.forkBot(
            parentBotId,
            "ipfs://QmFork",
            keccak256("fork config")
        );

        assertEq(forkBotId, 2);
        assertEq(registry.nextBotId(), 3);

        BotRegistry.Bot memory forkBot = registry.getBot(forkBotId);
        assertEq(forkBot.parentBotId, parentBotId);
        assertEq(forkBot.creator, address(this));

        // Check forks array
        uint256[] memory forks = registry.getBotForks(parentBotId);
        assertEq(forks.length, 1);
        assertEq(forks[0], forkBotId);
    }

    function testCannotForkPrivateBot() public {
        // Create private bot
        uint256 privateBotId = registry.createBot(
            "ipfs://QmPrivate",
            keccak256("private config"),
            "PRIVATE",
            0
        );

        // Try to fork - should fail
        vm.expectRevert("BotRegistry: can only fork public bots");
        registry.forkBot(privateBotId, "ipfs://QmFork", keccak256("fork config"));
    }

    function testGetUserBots() public {
        registry.createBot("ipfs://Qm1", keccak256("config1"), "PUBLIC", 0);
        registry.createBot("ipfs://Qm2", keccak256("config2"), "PUBLIC", 0);

        uint256[] memory userBots = registry.getUserBots(address(this));
        assertEq(userBots.length, 2);
        assertEq(userBots[0], 1);
        assertEq(userBots[1], 2);
    }
}

