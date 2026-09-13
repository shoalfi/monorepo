// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDepthOracle} from "./CapSteward.sol";

/// @title DepthOracle
/// @notice Minimal keeper-written implementation of {IDepthOracle}: the on-chain
///         landing place for the `sellable_depth_usd` field the shoalfi refresh
///         job already computes off-chain.
/// @dev ROADMAP, not audited. Trust model is deliberately the simplest thing that
///      is honest about itself: a single keeper address posts snapshots and the
///      consumer decides how stale is too stale. There is no signature scheme,
///      no multi-reporter median and no dispute window; a production feed needs
///      all three. It is here so {CapSteward} can be deployed and exercised
///      end to end against real numbers rather than described in a README.
contract DepthOracle is IDepthOracle {
    /// @notice Address allowed to post snapshots.
    address public keeper;

    /// @dev token => USD (18 decimals) sellable before the configured slippage.
    mapping(address => uint256) private _sellableDepthUsd;
    /// @dev token => unix timestamp of the snapshot, 0 if never posted.
    mapping(address => uint256) private _updatedAt;

    event Published(address indexed token, uint256 sellableDepthUsd, uint256 updatedAt);
    event KeeperChanged(address indexed previous, address indexed next);

    error NotKeeper(address caller);
    error ZeroKeeper();
    error LengthMismatch(uint256 tokens, uint256 values);

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper(msg.sender);
        _;
    }

    constructor(address keeper_) {
        if (keeper_ == address(0)) revert ZeroKeeper();
        keeper = keeper_;
        emit KeeperChanged(address(0), keeper_);
    }

    /// @notice Post one token's depth. Stamps `block.timestamp` as the snapshot time.
    function publish(address token, uint256 sellableDepthUsd_) external onlyKeeper {
        _publish(token, sellableDepthUsd_);
    }

    /// @notice Post a whole refresh in one transaction.
    function publishBatch(address[] calldata tokens, uint256[] calldata values) external onlyKeeper {
        if (tokens.length != values.length) revert LengthMismatch(tokens.length, values.length);
        for (uint256 i = 0; i < tokens.length; ++i) {
            _publish(tokens[i], values[i]);
        }
    }

    /// @notice Hand the keeper role to a new address.
    function setKeeper(address next) external onlyKeeper {
        if (next == address(0)) revert ZeroKeeper();
        emit KeeperChanged(keeper, next);
        keeper = next;
    }

    /// @inheritdoc IDepthOracle
    function sellableDepthUsd(address token) external view returns (uint256) {
        return _sellableDepthUsd[token];
    }

    /// @inheritdoc IDepthOracle
    function updatedAt(address token) external view returns (uint256) {
        return _updatedAt[token];
    }

    function _publish(address token, uint256 value) private {
        _sellableDepthUsd[token] = value;
        _updatedAt[token] = block.timestamp;
        emit Published(token, value, block.timestamp);
    }
}
