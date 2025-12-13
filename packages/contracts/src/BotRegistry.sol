// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BotRegistry
 * @notice Registry for bot creation and forking on Polygon
 */
contract BotRegistry {
    // Events
    event BotCreated(
        uint256 indexed botId,
        address indexed creator,
        string metadataURI,
        bytes32 configHash,
        string visibility,
        uint256 feeBps
    );

    event BotForked(
        uint256 indexed newBotId,
        uint256 indexed parentBotId,
        address indexed forker,
        string metadataURI,
        bytes32 configHash
    );

    // State
    uint256 private _nextBotId = 1;
    mapping(uint256 => Bot) public bots;
    mapping(address => uint256[]) public userBots;
    mapping(uint256 => uint256[]) public botForks;

    struct Bot {
        uint256 botId;
        address creator;
        uint256 parentBotId; // 0 if not a fork
        string metadataURI;
        bytes32 configHash;
        string visibility; // "PUBLIC" or "PRIVATE"
        uint256 feeBps; // Fee in basis points (0-10000)
        uint256 createdAt;
    }

    /**
     * @notice Create a new bot
     * @param metadataURI IPFS or API-hosted metadata URI
     * @param configHash Hash of bot configuration
     * @param visibility "PUBLIC" or "PRIVATE"
     * @param feeBps Fee in basis points (0-10000)
     * @return botId The ID of the created bot
     */
    function createBot(
        string memory metadataURI,
        bytes32 configHash,
        string memory visibility,
        uint256 feeBps
    ) public returns (uint256) {
        require(feeBps <= 10000, "BotRegistry: feeBps must be <= 10000");
        require(
            keccak256(bytes(visibility)) == keccak256(bytes("PUBLIC")) ||
                keccak256(bytes(visibility)) == keccak256(bytes("PRIVATE")),
            "BotRegistry: visibility must be PUBLIC or PRIVATE"
        );

        uint256 botId = _nextBotId++;
        bots[botId] = Bot({
            botId: botId,
            creator: msg.sender,
            parentBotId: 0,
            metadataURI: metadataURI,
            configHash: configHash,
            visibility: visibility,
            feeBps: feeBps,
            createdAt: block.timestamp
        });

        userBots[msg.sender].push(botId);

        emit BotCreated(botId, msg.sender, metadataURI, configHash, visibility, feeBps);

        return botId;
    }

    /**
     * @notice Fork an existing bot
     * @param parentBotId The ID of the bot to fork
     * @param metadataURI IPFS or API-hosted metadata URI for the fork
     * @param configHash Hash of forked bot configuration
     * @return newBotId The ID of the forked bot
     */
    function forkBot(
        uint256 parentBotId,
        string memory metadataURI,
        bytes32 configHash
    ) public returns (uint256) {
        Bot memory parentBot = bots[parentBotId];
        require(parentBot.botId != 0, "BotRegistry: parent bot does not exist");
        require(
            keccak256(bytes(parentBot.visibility)) == keccak256(bytes("PUBLIC")),
            "BotRegistry: can only fork public bots"
        );

        uint256 newBotId = _nextBotId++;
        bots[newBotId] = Bot({
            botId: newBotId,
            creator: msg.sender,
            parentBotId: parentBotId,
            metadataURI: metadataURI,
            configHash: configHash,
            visibility: parentBot.visibility, // Inherit visibility
            feeBps: parentBot.feeBps, // Inherit fee
            createdAt: block.timestamp
        });

        userBots[msg.sender].push(newBotId);
        botForks[parentBotId].push(newBotId);

        emit BotForked(newBotId, parentBotId, msg.sender, metadataURI, configHash);

        return newBotId;
    }

    /**
     * @notice Get bot information
     * @param botId The ID of the bot
     * @return Bot struct
     */
    function getBot(uint256 botId) public view returns (Bot memory) {
        return bots[botId];
    }

    /**
     * @notice Get all bot IDs created by a user
     * @param user The address of the user
     * @return Array of bot IDs
     */
    function getUserBots(address user) public view returns (uint256[] memory) {
        return userBots[user];
    }

    /**
     * @notice Get all forks of a bot
     * @param botId The ID of the bot
     * @return Array of fork bot IDs
     */
    function getBotForks(uint256 botId) public view returns (uint256[] memory) {
        return botForks[botId];
    }

    /**
     * @notice Get the next bot ID (for frontend use)
     * @return The next bot ID that will be assigned
     */
    function nextBotId() public view returns (uint256) {
        return _nextBotId;
    }
}

