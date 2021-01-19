pragma solidity 0.6.6;

import "./PriceOracleInterface.sol";
import "../util/Time.sol";


contract FixedPriceOracle is PriceOracleInterface, Time {
    uint256 private immutable _price;

    constructor(uint256 fixedPrice) public {
        _price = fixedPrice;
    }

    function isWorking() external override returns (bool) {
        return true;
    }

    function latestId() public override returns (uint256) {
        return _getBlockTimestampSec();
    }

    /**
     * @notice Returns timestamp of latest price.
     */
    function latestTimestamp() public override returns (uint256) {
        return getTimestamp(latestId());
    }

    /**
     * @notice This function returns current USD/USDC rate.
     */
    function latestPrice() public override returns (uint256) {
        return getPrice(latestId());
    }

    function getTimestamp(uint256 id) public override returns (uint256) {
        return id;
    }

    function getPrice(uint256) public override returns (uint256) {
        return _price;
    }
}
