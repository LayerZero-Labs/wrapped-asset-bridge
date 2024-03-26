// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
  * @title Interface for burnable and mintable ERC20 complying
  with the interface of the classic native-to-erc20 bridge
  link to the implementation:   
  https://github.com/fuseio/fuse-bridge/blob/master/native-to-erc20/contracts/contracts/interfaces/IBurnableMintableERC677Token.sol
 */
interface IERC20Burnable is IERC20 {
    function mint(address _to, uint _amount) external;

    function burnFrom(address _from, uint _amount) external;
}
