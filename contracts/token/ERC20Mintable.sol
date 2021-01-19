pragma solidity 0.6.6;

import "../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract ERC20Mintable is ERC20 {
    constructor(uint8 decimal) public ERC20("testLienToken", "testLien") {
        _setupDecimals(decimal);
    }

    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }

    receive() external payable {}

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
