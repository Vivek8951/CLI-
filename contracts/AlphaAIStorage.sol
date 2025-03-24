// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AlphaAIStorage is Ownable, ReentrancyGuard {
    IERC20 public aaiToken;

    struct StorageAllocation {
        uint256 amount;
        uint256 expiresAt;
        bool active;
    }

    // Mapping from user => provider => allocation
    mapping(address => mapping(address => StorageAllocation)) public allocations;
    
    // Events
    event StoragePurchased(address indexed user, address indexed provider, uint256 amount);
    event StorageReleased(address indexed user, address indexed provider, uint256 amount);
    event StorageExtended(address indexed user, address indexed provider, uint256 newExpiry);

    constructor(address _aaiToken) Ownable(msg.sender) {
        aaiToken = IERC20(_aaiToken);
    }

    function purchaseStorage(
        address provider,
        uint256 storageAmount,
        uint256 tokenAmount,
        uint256 duration
    ) external nonReentrant {
        require(provider != address(0), "Invalid provider address");
        require(storageAmount > 0, "Storage amount must be greater than 0");
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(duration >= 30 days, "Minimum duration is 30 days");

        // Transfer AAI tokens from user to provider
        require(
            aaiToken.transferFrom(msg.sender, provider, tokenAmount),
            "Token transfer failed"
        );

        // Update storage allocation
        StorageAllocation storage allocation = allocations[msg.sender][provider];
        
        if (allocation.active) {
            // Extend existing allocation
            allocation.amount += storageAmount;
            allocation.expiresAt = block.timestamp + duration;
        } else {
            // Create new allocation
            allocations[msg.sender][provider] = StorageAllocation({
                amount: storageAmount,
                expiresAt: block.timestamp + duration,
                active: true
            });
        }

        emit StoragePurchased(msg.sender, provider, storageAmount);
    }

    function releaseStorage(address provider) external nonReentrant {
        StorageAllocation storage allocation = allocations[msg.sender][provider];
        require(allocation.active, "No active storage allocation");
        require(
            block.timestamp >= allocation.expiresAt,
            "Storage allocation hasn't expired"
        );

        uint256 amount = allocation.amount;
        delete allocations[msg.sender][provider];

        emit StorageReleased(msg.sender, provider, amount);
    }

    function getStorageAllocation(address user, address provider)
        external
        view
        returns (uint256 amount, uint256 expiresAt, bool active)
    {
        StorageAllocation memory allocation = allocations[user][provider];
        return (allocation.amount, allocation.expiresAt, allocation.active);
    }

    function isStorageValid(address user, address provider)
        external
        view
        returns (bool)
    {
        StorageAllocation memory allocation = allocations[user][provider];
        return allocation.active && block.timestamp < allocation.expiresAt;
    }
}