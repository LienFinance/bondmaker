pragma solidity 0.6.6;

import "./PriceInverseOracle.sol";
import "./Oracle.test.sol";
import "../math/UseSafeMath.sol";


contract TestPriceInverseOracle is PriceInverseOracle {
    using SafeMath for uint256;

    constructor(address baseOracleAddress) public PriceInverseOracle(baseOracleAddress) {
        // Ensure baseOracleAddress has testSetOracleData method.
        TestOracle(baseOracleAddress);
    }

    function testSetOracleData(uint256 price, uint256 volatility) public {
        TestOracle(address(BASE_ORACLE)).testSetOracleData(_calcInverse(price), volatility);
    }

    function testSetBaseOracleData(uint256 price, uint256 volatility) public {
        TestOracle(address(BASE_ORACLE)).testSetOracleData(price, volatility);
    }
}
