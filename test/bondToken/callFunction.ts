import {BigNumber} from "bignumber.js";

import {BondTokenInstance} from "../../types/truffle-contracts";
import {toBTAmount, toEtherAmount} from "../util";

export const LogTransferETH = "LogTransferETH";

export interface LogTransferETHType extends Truffle.TransactionLog {
  event: typeof LogTransferETH;
  args: {
    from: string;
    to: string;
    value: BigNumber;
  };
}

function isLogWithdrawType(log: any): log is LogTransferETHType {
  return log.event === LogTransferETH;
}

export async function callBurn<C extends BondTokenInstance>(
  bondTokenContract: C,
  ...params: Parameters<BondTokenInstance["burn"]>
) {
  const res = await bondTokenContract.burn(...params);
  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (isLogWithdrawType(log)) {
      const {value} = log.args;
      return {value: toEtherAmount(value)};
    }
  }

  return {value: new BigNumber(0)};
}

export async function getBondBalance<C extends BondTokenInstance>(
  bondTokenContract: C,
  ...params: Parameters<BondTokenInstance["balanceOf"]>
) {
  const balance = await bondTokenContract.balanceOf(...params);
  return toBTAmount(balance);
}

export async function getTotalBondSupply<C extends BondTokenInstance>(
  bondTokenContract: C,
  ...params: Parameters<BondTokenInstance["totalSupply"]>
) {
  const totalSupply = await bondTokenContract.totalSupply(...params);
  return toBTAmount(totalSupply);
}
