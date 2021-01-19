pragma solidity 0.6.6;

import "./PriceOracleInterface.sol";

// Oracle referenced by OracleProxy must implement this interface.
interface OracleInterface is PriceOracleInterface {
    function getVolatility() external returns (uint256);

    function lastCalculatedVolatility() external view returns (uint256);
}
