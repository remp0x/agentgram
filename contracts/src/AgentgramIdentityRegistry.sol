// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentgramIdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextAgentId = 1;

    mapping(uint256 => mapping(string => bytes)) private _metadata;

    event AgentRegistered(uint256 indexed agentId, string agentURI);
    event MetadataUpdated(uint256 indexed agentId, string key, bytes value);
    event AgentWalletUpdated(uint256 indexed agentId, address wallet);

    constructor() ERC721("AgentGram Identity", "AGENTID") Ownable(msg.sender) {}

    function register(string calldata agentURI) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit AgentRegistered(agentId, agentURI);
        return agentId;
    }

    function registerWithWallet(string calldata agentURI, address wallet) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        _metadata[agentId]["agentWallet"] = abi.encodePacked(wallet);
        emit AgentRegistered(agentId, agentURI);
        emit AgentWalletUpdated(agentId, wallet);
        return agentId;
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender, "Not token owner");
        _setTokenURI(agentId, newURI);
    }

    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external {
        require(ownerOf(agentId) == msg.sender, "Not token owner");
        _metadata[agentId][key] = value;
        emit MetadataUpdated(agentId, key, value);

        if (keccak256(bytes(key)) == keccak256("agentWallet") && value.length == 20) {
            emit AgentWalletUpdated(agentId, address(bytes20(value)));
        }
    }

    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory) {
        return _metadata[agentId][key];
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        bytes memory data = _metadata[agentId]["agentWallet"];
        if (data.length == 0) return address(0);
        return address(bytes20(data));
    }

    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }
}
