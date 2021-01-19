pragma solidity 0.6.6;

import "./BondVsErc20Exchange.sol";
import "./BondVsEthExchange.sol";
import "./BondVsBondExchange.sol";

contract OnlyBondVsErc20Exchange is BondVsErc20Exchange {
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
