// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Burnable is IERC20 {
    function mint(address _to, uint _amount) external;

    function burnFrom(address _from, uint _amount) external;
}
