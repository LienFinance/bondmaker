pragma solidity 0.6.6;

import "../oracle/FixedPriceOracle.sol";


contract USDCOracle is FixedPriceOracle(1 * 10**8) {}
