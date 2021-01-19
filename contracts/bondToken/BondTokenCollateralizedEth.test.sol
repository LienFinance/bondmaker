pragma solidity 0.6.6;

import "./BondTokenCollateralizedEth.sol";


contract TestBondTokenCollateralizedEth is BondTokenCollateralizedEth {
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public BondTokenCollateralizedEth(name, symbol, decimals) {}

    function getDeployer() external view returns (address) {
        return owner();
    }
}
