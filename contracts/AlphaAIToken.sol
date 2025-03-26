// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AlphaAIToken is ERC20, ERC20Burnable, Pausable, Ownable {
    // Events for better tracking
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);

    constructor() ERC20("Alpha AI", "AAI") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000_000 * 10**decimals());
    }

    // Pause token transfers in case of emergency
    function pause() public onlyOwner {
        _pause();
    }

    // Unpause token transfers
    function unpause() public onlyOwner {
        _unpause();
    }

    // Override transfer function to include pausable functionality
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }

    // Enhanced mint function with validation and events
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    // Enhanced burn function with validation and events
    function burnTokens(uint256 amount) public {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    // View function to verify token balance
    function verifyBalance(address account) public view returns (bool, uint256) {
        uint256 balance = balanceOf(account);
        return (balance > 0, balance);
    }
}