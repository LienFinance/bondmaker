pragma solidity 0.6.6;

import "./BondVsErc20Exchange.sol";
import "./BondVsEthExchange.sol";
import "./BondVsBondExchange.sol";

contract OnlyBondVsBondExchange is BondVsBondExchange {
    constructor(
        BondMakerInterface bondMakerAddress,
        VolatilityOracleInterface volatilityOracleAddress,
        LatestPriceOracleInterface volumeCalculatorAddress,
        DetectBondShape bondShapeDetector
    )
        public
        BondExchange(
            bondMakerAddress,
            volatilityOracleAddress,
            volumeCalculatorAddress,
            bondShapeDetector
        )
    {}
}
