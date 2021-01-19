pragma solidity 0.6.6;

import "./BondMakerInterface.sol";


interface BondMakerCollateralizedEthInterface is BondMakerInterface {
    function issueNewBonds(uint256 bondGroupID) external payable returns (uint256 amount);
}
