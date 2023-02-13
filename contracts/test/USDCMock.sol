// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCMock is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) {
        _tokenDecimals = _decimals;
    }

    function mint(address _to, uint _amount) external {
        _mint(_to, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _tokenDecimals;
    }
}