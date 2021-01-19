import {BigNumber} from "bignumber.js";
import BN from "bn.js";

import {calcFnMap, fromE0Amount, nullAddress} from "../util";
import {
  BondMakerInstance,
  BondMakerCollateralizedEthInstance,
  BondMakerCollateralizedErc20Instance,
} from "../../types/truffle-contracts";

const Erc20 = artifacts.require("Erc20");

export const LogNewBond = "LogNewBond";
export const LogNewBondGroup = "LogNewBondGroup";

export interface LogNewBondType extends Truffle.TransactionLog {
  event: typeof LogNewBond;
  args: {
    /* bytes32 indexed */ bondID: string;
    /* address indexed */ bondTokenAddress: string;
    /* uint256 indexed */ maturity: BN;
    /* bytes32 */ fnMapID: string;
  };
}
export interface LogNewBondGroupType extends Truffle.TransactionLog {
  event: typeof LogNewBondGroup;
  args: {
    /* uint256 indexed */ bondGroupID: BN;
    /* uint256 indexed */ maturity: BN;
    /* uint64 indexed */ sbtStrikePrice: BN;
    /* bytes32[] */ bondIDs: string[];
  };
}

function isLogRegisterNewBondType(log: any): log is LogNewBondType {
  return log.event === LogNewBond;
}

function isLogNewBondGroupType(log: any): log is LogNewBondGroupType {
  return log.event === LogNewBondGroup;
}

export async function callGetBondGroup<C extends BondMakerInstance>(
  bondMakerContract: C,
  ...params: Parameters<BondMakerInstance["getBondGroup"]>
) {
  const res = await bondMakerContract.getBondGroup(...params);
  return {
    bondIDs: res[0],
    maturity: Number(res[1].toString()),
  };
}

export async function callGetBond<C extends BondMakerInstance>(
  bondMakerContract: C,
  ...params: Parameters<BondMakerInstance["getBond"]>
) {
  const decimal = 8;
  const res = await bondMakerContract.getBond(...params);
  return {
    bondTokenAddress: res[0],
    maturity: Number(res[1].toString()),
    solidStrikePrice: new BigNumber(res[2].toString()).shiftedBy(-decimal),
    fnMap: res[3],
  };
}

export async function callRegisterNewBondGroup<C extends BondMakerInstance>(
  bondMakerContract: C,
  ...params: Parameters<BondMakerInstance["registerNewBondGroup"]>
) {
  const res = await bondMakerContract.registerNewBondGroup(...params);
  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (isLogNewBondGroupType(log)) {
      const {bondGroupID} = log.args;
      return {bondGroupID};
    }
  }

  throw new Error("event log of registerNewBondGroup was not found");
}

/**
 * register new bond
 * @param bondMakerContract BondMaker contract
 * @param params the parameters of registerNewBond
 */
export async function callRegisterNewBond<C extends BondMakerInstance>(
  bondMakerContract: C,
  ...params: Parameters<BondMakerInstance["registerNewBond"]>
) {
  const bondID = await bondMakerContract.generateBondID(...params);
  const {bondTokenAddress} = await callGetBond(bondMakerContract, bondID);
  if (bondTokenAddress !== nullAddress) {
    return {bondID, bondTokenAddress};
  }

  const res = await bondMakerContract.registerNewBond(...params);

  // console.log(`the used gas of registerNewBond: `, res.receipt.gasUsed);
  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (isLogRegisterNewBondType(log)) {
      const {bondID, bondTokenAddress} = log.args;
      return {bondID, bondTokenAddress};
    }
  }

  throw new Error("event log of registerNewBond was not found");
}

export const createBondGroup = async (
  bondMakerContract: BondMakerInstance,
  fnMaps: string[],
  maturity: number
): Promise<{
  bondGroupID: string;
  bonds: {bondID: string; bondTokenAddress: string}[];
}> => {
  const initialValue = new Array<{bondID: string; bondTokenAddress: string}>();
  const bonds = await fnMaps.reduce(async (acc, fnMap) => {
    const res = await acc;
    const bondID = await bondMakerContract.generateBondID(maturity, fnMap);
    const bondInfo = await bondMakerContract.getBond(bondID);
    const bondTokenAddress = bondInfo[0];

    // Register a bond if necessary.
    if (bondTokenAddress !== nullAddress) {
      return [...res, {bondID, bondTokenAddress}];
    }

    await bondMakerContract.registerNewBond(maturity, fnMap);

    {
      const bondInfo = await bondMakerContract.getBond(bondID);
      const bondTokenAddress = bondInfo[0];
      return [...res, {bondID, bondTokenAddress}];
    }
  }, Promise.resolve(initialValue));

  const {bondGroupID: rawBondGroupID} = await callRegisterNewBondGroup(
    bondMakerContract,
    bonds.map(({bondID}) => bondID),
    maturity
  );
  const bondGroupID = rawBondGroupID.toString();
  return {
    bondGroupID,
    bonds,
  };
};

export const createSbtAndLbt = async (
  bondMakerContract: BondMakerInstance,
  maturity: number,
  solidStrikePriceE0: BigNumber.Value,
  decimal: number = 8
): Promise<{
  bondGroupID: string;
  sbtID: string;
  sbtAddress: string;
  lbtID: string;
  lbtAddress: string;
}> => {
  const {bondGroupID, bonds} = await createBondGroup(
    bondMakerContract,
    calcFnMap(solidStrikePriceE0, decimal).map(({fnMap}) => fnMap),
    maturity
  );

  const [
    {bondID: sbtID, bondTokenAddress: sbtAddress},
    {bondID: lbtID, bondTokenAddress: lbtAddress},
  ] = bonds;

  return {
    bondGroupID,
    sbtID,
    sbtAddress,
    lbtID,
    lbtAddress,
  };
};

export const issueNewBonds = async <
  T extends
    | BondMakerCollateralizedEthInstance
    | BondMakerCollateralizedErc20Instance
>(
  bondMakerContract: T,
  bondGroupID: string,
  bondAmountE0: BigNumber.Value,
  txDetails?: Omit<Truffle.TransactionDetails, "value"> | undefined
) => {
  const feeRate = 2 / 1000; // 0.2%
  const dividendAmountE0 = new BigNumber(bondAmountE0).times(feeRate);
  const collateralAmountE0 = new BigNumber(bondAmountE0).plus(dividendAmountE0);
  const collateralAddress = await bondMakerContract.collateralAddress();
  if (collateralAddress === nullAddress) {
    const decimals = 18;
    await (bondMakerContract as BondMakerCollateralizedEthInstance).issueNewBonds(
      bondGroupID,
      {
        ...txDetails,
        value: fromE0Amount(collateralAmountE0, decimals),
      }
    );
  } else {
    const collateralContract = await Erc20.at(collateralAddress);
    const decimals = (await collateralContract.decimals()).toNumber();
    if (txDetails === undefined) {
      await collateralContract.approve(
        bondMakerContract.address,
        fromE0Amount(collateralAmountE0, decimals)
      );
      await (bondMakerContract as BondMakerCollateralizedErc20Instance).issueNewBonds(
        bondGroupID,
        fromE0Amount(collateralAmountE0, decimals)
      );
    } else {
      await collateralContract.approve(
        bondMakerContract.address,
        fromE0Amount(collateralAmountE0, decimals),
        txDetails
      );
      await (bondMakerContract as BondMakerCollateralizedErc20Instance).issueNewBonds(
        bondGroupID,
        fromE0Amount(collateralAmountE0, decimals),
        txDetails
      );
    }
  }
};

export const issueNewBondsCollateralizedEth = async <
  T extends BondMakerCollateralizedEthInstance
>(
  bondMakerContract: T,
  bondGroupID: string,
  bondAmountE0: BigNumber.Value,
  txDetails?: Omit<Truffle.TransactionDetails, "value"> | undefined
) => {
  const collateralAddress = await bondMakerContract.collateralAddress();
  assert(collateralAddress === nullAddress, "collateral must be ETH");
  const decimals = 18;
  const feeRate = 2 / 1000; // 0.2%
  const dividendAmountE0 = new BigNumber(bondAmountE0).times(feeRate);
  const collateralAmountE0 = new BigNumber(bondAmountE0).plus(dividendAmountE0);
  await bondMakerContract.issueNewBonds(bondGroupID, {
    ...txDetails,
    value: new BigNumber(collateralAmountE0)
      .shiftedBy(decimals)
      .dp(0)
      .toString(10),
  });
};

export const issueNewBondsCollateralizedErc20 = async <
  T extends BondMakerCollateralizedErc20Instance
>(
  bondMakerContract: T,
  bondGroupID: string,
  bondAmountE0: BigNumber.Value,
  txDetails?: Omit<Truffle.TransactionDetails, "value"> | undefined
) => {
  const collateralAddress = await bondMakerContract.collateralAddress();
  const collateralContract = await Erc20.at(collateralAddress);
  const decimals = (await collateralContract.decimals()).toNumber();
  const feeRate = 2 / 1000; // 0.2%
  const dividendAmountE0 = new BigNumber(bondAmountE0).times(feeRate);
  const collateralAmountE0 = new BigNumber(bondAmountE0).plus(dividendAmountE0);
  if (txDetails === undefined) {
    await collateralContract.approve(
      bondMakerContract.address,
      fromE0Amount(collateralAmountE0, decimals)
    );
    await bondMakerContract.issueNewBonds(
      bondGroupID,
      fromE0Amount(collateralAmountE0, decimals)
    );
  } else {
    await collateralContract.approve(
      bondMakerContract.address,
      fromE0Amount(collateralAmountE0, decimals),
      txDetails
    );
    await bondMakerContract.issueNewBonds(
      bondGroupID,
      fromE0Amount(collateralAmountE0, decimals),
      txDetails
    );
  }
};
