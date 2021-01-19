pragma solidity 0.6.6;

interface VolatilityOracleInterface {
    function getVolatility(uint64 untilMaturity)
        external
        view
        returns (uint64 volatilityE8);
}
