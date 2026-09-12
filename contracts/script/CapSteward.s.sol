// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CapSteward, IDepthOracle} from "../src/CapSteward.sol";
import {DepthOracle} from "../src/DepthOracle.sol";

/// @notice Deploys a {DepthOracle} and a {CapSteward} wired to it, then
///         optionally seeds one snapshot so the pair can be called immediately.
///
/// Env:
///   KEEPER        address allowed to publish snapshots (default: broadcaster)
///   CAP_BPS       share of depth that may be lent against  (default: 3000 = 30%)
///   MAX_STALENESS seconds before a snapshot fails closed   (default: 900)
///   SEED_TOKEN    optional token to publish on deploy
///   SEED_DEPTH_USD optional depth for SEED_TOKEN, 18 decimals
///
///   forge script script/CapSteward.s.sol:DeployCapSteward \
///     --rpc-url $RPC --broadcast --private-key $PRIVATE_KEY
contract DeployCapSteward is Script {
    function run() external returns (DepthOracle oracle, CapSteward steward) {
        uint256 capBps = vm.envOr("CAP_BPS", uint256(3000));
        uint256 maxStaleness = vm.envOr("MAX_STALENESS", uint256(15 minutes));
        address seedToken = vm.envOr("SEED_TOKEN", address(0));
        uint256 seedDepth = vm.envOr("SEED_DEPTH_USD", uint256(0));

        vm.startBroadcast();
        address keeper = vm.envOr("KEEPER", msg.sender);

        oracle = new DepthOracle(keeper);
        steward = new CapSteward(IDepthOracle(address(oracle)), capBps, maxStaleness);

        if (seedToken != address(0) && keeper == msg.sender) {
            oracle.publish(seedToken, seedDepth);
        }
        vm.stopBroadcast();

        console.log("DepthOracle:", address(oracle));
        console.log("CapSteward: ", address(steward));
        console.log("keeper:     ", keeper);
        console.log("capBps:     ", capBps);
        if (seedToken != address(0)) {
            console.log("seeded:     ", seedToken);
            console.log("maxBorrowableUsd:", steward.maxBorrowableUsd(seedToken));
        }
    }
}

/// @notice Publishes one depth snapshot to an existing {DepthOracle}.
///
///   ORACLE=0x... TOKEN=0x... DEPTH_USD=... forge script \
///     script/CapSteward.s.sol:PublishDepth --rpc-url $RPC --broadcast --private-key $PRIVATE_KEY
contract PublishDepth is Script {
    function run() external {
        DepthOracle oracle = DepthOracle(vm.envAddress("ORACLE"));
        address token = vm.envAddress("TOKEN");
        uint256 depth = vm.envUint("DEPTH_USD");

        vm.startBroadcast();
        oracle.publish(token, depth);
        vm.stopBroadcast();

        console.log("published:", token, depth);
    }
}
