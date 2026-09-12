// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DepthOracle} from "../src/DepthOracle.sol";
import {CapSteward, IDepthOracle} from "../src/CapSteward.sol";

contract DepthOracleTest is Test {
    DepthOracle internal oracle;

    address internal keeper = makeAddr("keeper");
    address internal stranger = makeAddr("stranger");
    address internal WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address internal WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    function setUp() public {
        oracle = new DepthOracle(keeper);
    }

    function test_ConstructorSetsKeeper() public view {
        assertEq(oracle.keeper(), keeper);
    }

    function test_RevertsOnZeroKeeper() public {
        vm.expectRevert(DepthOracle.ZeroKeeper.selector);
        new DepthOracle(address(0));
    }

    function test_UnpublishedTokenIsZeroAndNeverUpdated() public view {
        assertEq(oracle.sellableDepthUsd(WBTC), 0);
        assertEq(oracle.updatedAt(WBTC), 0);
    }

    function test_PublishStoresValueAndTimestamp() public {
        vm.warp(1_757_700_000);
        vm.prank(keeper);
        oracle.publish(WBTC, 28_836_418e18);
        assertEq(oracle.sellableDepthUsd(WBTC), 28_836_418e18);
        assertEq(oracle.updatedAt(WBTC), 1_757_700_000);
    }

    function test_OnlyKeeperCanPublish() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DepthOracle.NotKeeper.selector, stranger));
        oracle.publish(WBTC, 1e18);
    }

    function test_PublishBatchWritesEveryToken() public {
        address[] memory tokens = new address[](2);
        uint256[] memory values = new uint256[](2);
        tokens[0] = WBTC;
        tokens[1] = WETH;
        values[0] = 28_836_418e18;
        values[1] = 67_389_019e18;

        vm.prank(keeper);
        oracle.publishBatch(tokens, values);

        assertEq(oracle.sellableDepthUsd(WBTC), 28_836_418e18);
        assertEq(oracle.sellableDepthUsd(WETH), 67_389_019e18);
    }

    function test_PublishBatchRevertsOnLengthMismatch() public {
        address[] memory tokens = new address[](2);
        uint256[] memory values = new uint256[](1);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(DepthOracle.LengthMismatch.selector, 2, 1));
        oracle.publishBatch(tokens, values);
    }

    function test_SetKeeperTransfersRole() public {
        vm.prank(keeper);
        oracle.setKeeper(stranger);
        assertEq(oracle.keeper(), stranger);

        vm.prank(stranger);
        oracle.publish(WBTC, 1e18);
        assertEq(oracle.sellableDepthUsd(WBTC), 1e18);
    }

    /// The whole point of the pair: a real scanner number becomes an on-chain cap.
    function test_EndToEndCapIsThirtyPercentOfPublishedDepth() public {
        CapSteward steward = new CapSteward(IDepthOracle(address(oracle)), 3000, 15 minutes);

        vm.warp(1_757_700_000);
        vm.prank(keeper);
        oracle.publish(WBTC, 28_836_418e18); // live scanner value at block 25963583

        assertEq(steward.maxBorrowableUsd(WBTC), 8_650_925.4e18);
        assertTrue(steward.isFresh(WBTC));
    }

    function test_EndToEndFailsClosedOnceStale() public {
        CapSteward steward = new CapSteward(IDepthOracle(address(oracle)), 3000, 15 minutes);

        vm.warp(1_757_700_000);
        vm.prank(keeper);
        oracle.publish(WBTC, 28_836_418e18);

        vm.warp(1_757_700_000 + 15 minutes + 1);
        assertEq(steward.maxBorrowableUsd(WBTC), 0);
        assertFalse(steward.isFresh(WBTC));
    }

    function testFuzz_CapNeverExceedsPublishedDepth(uint128 depth) public {
        CapSteward steward = new CapSteward(IDepthOracle(address(oracle)), 3000, 15 minutes);
        vm.prank(keeper);
        oracle.publish(WBTC, depth);
        assertLe(steward.maxBorrowableUsd(WBTC), depth);
    }
}
