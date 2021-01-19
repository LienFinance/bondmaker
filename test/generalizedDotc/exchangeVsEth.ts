import Web3 from "web3";

import {
  callGetBond,
  callGetBondGroup,
  createBondGroup,
  createSbtAndLbt,
  issueNewBondsCollateralizedEth,
} from "../bondMaker/callFunction";
import {BigNumber} from "bignumber.js";
import {
  getBlockTimestampSec,
  advanceTime,
  beNearlyEqualTo,
  expectRevert,
  applyDecimalGap,
  toE0Amount,
} from "../util";
import {maturityScale} from "../constants";
import {
  BondMakerCollateralizedEthInstance,
  BondPricerInterfaceInstance,
  Erc20MintableContract,
  Erc20MintableInstance,
  GeneralizedDotcInstance,
  LatestPriceOracleInterfaceInstance,
  OnlyBondVsEthExchangeInstance,
  OracleInterfaceInstance,
} from "../../types/truffle-contracts";

type Address = string;

declare const web3: Web3;

export type TestCase = {
  errorMessage?: string;
  initRateETH2USD: number;
  initVolatility: number;
  untilMaturity: number;
  strikePrice?: number;
  fnMaps?: string[];
  targetBondIndex?: number;
  erc20PriceE0?: number;
  decimalsOfErc20: number;
  isPutOption?: boolean;
  feeBaseE0?: number;
  expectedFeeRate?: number;
  expectedCallOptionPrice?: number;
  callOptionAccuracy?: number;
  expectedLeverage?: number;
  leverageAccuracy?: number;
  feeRateAccuracy?: number;
  exchangeTimeUntilMaturity?: number;
};

const GeneralizedDotc = artifacts.require("OnlyBondVsEthExchange");
const LienToken = artifacts.require("TestLienToken");
const PriceInverseOracle = artifacts.require("PriceInverseOracle");
const FixedPriceOracle = artifacts.require("FixedPriceOracle");
const Oracle = artifacts.require("TestOracle");
const BondMaker = artifacts.require("BondMakerCollateralizedEth");
const BondToken = artifacts.require("BondTokenInterface");
const BondTokenName = artifacts.require("BondTokenName");
const BondTokenFactory = artifacts.require("BondTokenFactory");
const DetectBondShape = artifacts.require("TestDetectBondShape");
const HistoricalVolatilityOracle = artifacts.require(
  "HistoricalVolatilityOracle"
);
const GeneralizedPricing = artifacts.require("GeneralizedPricing");
const BondPricer = artifacts.require("BondPricer");

const VS_ERC20 = "vsErc20";
const VS_ETH = "vsEth";
const VS_BOND = "vsBond";

type PoolType = typeof VS_ERC20 | typeof VS_ETH | typeof VS_BOND;

const decimalsOfEth = 18;

const assertUsdVolume = (
  actualUsdVolume: BigNumber,
  expectedUsdVolume: BigNumber
): boolean => {
  const actualUsdVolumeBN = new BigNumber(actualUsdVolume);
  const expectedUsdVolumeBN = new BigNumber(expectedUsdVolume);
  return beNearlyEqualTo(
    actualUsdVolumeBN.toString(),
    expectedUsdVolumeBN.toString(),
    expectedUsdVolumeBN.lt(0.0005)
      ? 0
      : expectedUsdVolumeBN.lt(0.001)
      ? 0.8
      : expectedUsdVolumeBN.lt(0.01)
      ? 0.85
      : expectedUsdVolumeBN.lt(0.1)
      ? 0.9
      : expectedUsdVolumeBN.lt(1)
      ? 0.95
      : expectedUsdVolumeBN.lt(5)
      ? 0.98
      : 0.99
  );
};

const defaultValue = {
  erc20PriceE0: 10,
  decimalsOfErc20: 6,
  decimalsOfBond: 8,
  decimalsOfOraclePrice: 8,
};

export async function testExchangeVsEth(
  accounts: Address[],
  scenarioCase: TestCase
): Promise<void> {
  const {
    errorMessage,
    initRateETH2USD,
    initVolatility,
    untilMaturity,
    strikePrice,
    fnMaps,
    targetBondIndex,
    decimalsOfBond,
    decimalsOfOraclePrice,
    isPutOption,
    feeBaseE0,
    exchangeTimeUntilMaturity,
  } = {
    ...defaultValue,
    ...scenarioCase,
  };

  const seller = accounts[1];
  const buyer = accounts[2];

  console.log("init oracle: ", initRateETH2USD, initVolatility);
  const oracleInstance = await Oracle.new(
    Math.floor(initRateETH2USD * 10 ** decimalsOfOraclePrice),
    Math.floor(initVolatility * 10 ** 8)
  );
  let bondOracleInstance: OracleInterfaceInstance;
  if (isPutOption) {
    bondOracleInstance = await PriceInverseOracle.new(oracleInstance.address); // ETH/USDC
  } else {
    bondOracleInstance = oracleInstance; // USD/ETH
  }
  const lienTokenInstance = await LienToken.new();
  const bondMakerInstance = await BondMaker.new(
    bondOracleInstance.address,
    lienTokenInstance.address,
    BondTokenName.address,
    BondTokenFactory.address,
    maturityScale
  );

  let ethOracleInstance: LatestPriceOracleInterfaceInstance = oracleInstance;
  // if (isPutOption) {
  //     ethOracleInstance = await FixedPriceOracle.new(10 ** decimalsOfOraclePrice);
  // } else {
  //     ethOracleInstance = oracleInstance;
  // }

  let volumeCalculatorInstance: LatestPriceOracleInterfaceInstance;
  if (isPutOption) {
    volumeCalculatorInstance = oracleInstance; // USD/ETH
  } else {
    volumeCalculatorInstance = await FixedPriceOracle.new(
      10 ** decimalsOfOraclePrice
    ); // USD/USD
  }

  const volatilityOracleInstance = await HistoricalVolatilityOracle.new(
    oracleInstance.address
  );
  const generalizedPricerInstance = await GeneralizedPricing.new();
  const bondPricerInstance = await BondPricer.new(
    generalizedPricerInstance.address
  );

  const bondShapeDetectorInstance = await DetectBondShape.new();

  const dotcInstance = await GeneralizedDotc.new(
    bondMakerInstance.address,
    volatilityOracleInstance.address,
    volumeCalculatorInstance.address,
    bondShapeDetectorInstance.address
  );

  const nowSec = await getBlockTimestampSec();
  const maturity = nowSec + untilMaturity;
  const {bondGroupID, bondID} = await (async () => {
    if (strikePrice !== undefined) {
      const {bondGroupID, lbtID} = await createSbtAndLbt(
        bondMakerInstance,
        maturity,
        strikePrice
      );
      return {bondGroupID, bondID: lbtID};
    } else if (fnMaps !== undefined && targetBondIndex !== undefined) {
      const {bondGroupID, bonds} = await createBondGroup(
        bondMakerInstance,
        fnMaps,
        maturity
      );
      return {bondGroupID, bondID: bonds[targetBondIndex].bondID};
    }

    throw new Error("invalid test case");
  })();

  const mintingBondAmountE0 = 1;
  await issueNewBondsCollateralizedEth(
    bondMakerInstance,
    bondGroupID,
    mintingBondAmountE0,
    {
      from: seller,
    }
  );
  await issueNewBondsCollateralizedEth(
    bondMakerInstance,
    bondGroupID,
    mintingBondAmountE0,
    {
      from: buyer,
    }
  );

  const createPoolOptions = {
    bondPricerInstance,
    ethOracleInstance,
    dotcInstance,
    seller,
  };

  const poolId = await createPool(feeBaseE0 ?? 0, true, createPoolOptions);

  const poolId2 = await createPool(feeBaseE0 ?? 0, false, createPoolOptions);

  if (exchangeTimeUntilMaturity !== undefined) {
    advanceTime(untilMaturity - exchangeTimeUntilMaturity);
  }

  const exchangeOptions = {
    decimalsOfBond,
    ethPriceE0: initRateETH2USD,
    dotcInstance,
    bondMakerInstance,
    seller,
    buyer,
  };

  console.log("\n## sell LBT");
  try {
    await buyBond(poolId, bondID, exchangeOptions);
  } catch (err) {
    if (!errorMessage) {
      expect.fail(`should not fail to buy bond: ${err.message}`);
    }
    assert.ok(
      expectRevert(err.message, errorMessage),
      `fail to buy bond\nactual:   ${err.message}\nexpected: ${errorMessage}`
    );
    console.log("expected error:", err.message);
    return; // success
  }

  console.log("\n## sell ERC20");
  try {
    await sellBond(poolId2, bondID, exchangeOptions);
  } catch (err) {
    if (!errorMessage) {
      expect.fail(`should not fail to sell bond: ${err.message}`);
    }
    assert.ok(
      expectRevert(err.message, errorMessage),
      `fail to sell bond\nactual:   ${err.message}\nexpected: ${errorMessage}`
    );
    console.log("expected error:", err.message);
    return; // success
  }

  await deletePool(poolId, {dotcInstance, seller});
  await deletePool(poolId2, {dotcInstance, seller});

  if (errorMessage !== "") {
    assert.ok(false, "should fail to execute this test");
  }
}

async function createPool(
  feeBaseE0: number,
  isBondSale: boolean,
  options: {
    bondPricerInstance: BondPricerInterfaceInstance;
    ethOracleInstance: LatestPriceOracleInterfaceInstance;
    dotcInstance: OnlyBondVsEthExchangeInstance;
    seller: Address;
  }
) {
  const {ethOracleInstance, bondPricerInstance, dotcInstance, seller} = options;
  const feeBaseE4 = feeBaseE0 * 1e4;
  const bondPricerAddress = bondPricerInstance.address;
  const ethOracleAddress = ethOracleInstance.address;
  const poolId = await dotcInstance.createVsEthPool.call(
    ethOracleAddress,
    bondPricerAddress,
    feeBaseE4,
    isBondSale,
    {
      from: seller,
    }
  );
  await dotcInstance.createVsEthPool(
    ethOracleAddress,
    bondPricerAddress,
    feeBaseE4,
    isBondSale,
    {
      from: seller,
    }
  );

  return poolId;
}

const deletePool = async (
  poolId: string,
  options: {
    dotcInstance: OnlyBondVsEthExchangeInstance;
    seller: Address;
  }
) => {
  const {dotcInstance, seller} = options;
  await dotcInstance.deleteVsEthPool(poolId, {from: seller});
};

const buyBond = async (
  poolId: string,
  bondId: string,
  options: {
    decimalsOfBond: number;
    ethPriceE0: BigNumber.Value;
    dotcInstance: OnlyBondVsEthExchangeInstance;
    bondMakerInstance: BondMakerCollateralizedEthInstance;
    seller: Address;
    buyer: Address;
  }
) => {
  const {
    decimalsOfBond,
    ethPriceE0,
    dotcInstance,
    bondMakerInstance,
    seller,
    buyer,
  } = options;

  const {bondTokenAddress: lbtAddress} = await callGetBond(
    bondMakerInstance,
    bondId
  );
  const lbtInstance = await BondToken.at(lbtAddress);

  console.log("execute calcRateBondToErc20");
  const rawRate = await dotcInstance.calcRateBondToEth.call(bondId, poolId);
  const rateE0 = Number(rawRate.toString()) / 1e8;

  console.log("ethPriceE0:             ", ethPriceE0);
  console.log("calcRateE0:             ", rateE0);

  // buyer takes LBT and seller takes ERC20
  const requiredLBTAmountE8 = new BigNumber(0.01).shiftedBy(decimalsOfBond);
  const slippage = 0.05;
  const paidEthAmount = applyDecimalGap(
    requiredLBTAmountE8.times(rateE0),
    decimalsOfBond,
    decimalsOfEth
  );
  const receivingLBTAmountE8 =
    rateE0 === 0
      ? new BigNumber(0)
      : applyDecimalGap(
          paidEthAmount.div(rateE0),
          decimalsOfEth,
          decimalsOfBond
        );
  console.log(
    "paidEthAmountE0:     ",
    paidEthAmount.shiftedBy(-18).toString(10)
  );
  await dotcInstance.depositEth({
    from: buyer,
    value: paidEthAmount.toString(10),
  });

  console.log(
    "receivingLbtAmountE0:",
    receivingLBTAmountE8.shiftedBy(-8).toString(10)
  );
  await lbtInstance.approve(
    dotcInstance.address,
    requiredLBTAmountE8.times(10).toString(10),
    {
      from: seller,
    }
  );

  const beforeLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  const beforeDepositedEthAmount = await dotcInstance.ethAllowance(buyer);
  const beforeEthAmount = await web3.eth.getBalance(seller);

  console.log("execute exchangeEthToBond");
  const res = await dotcInstance.exchangeEthToBond(
    bondId,
    poolId,
    paidEthAmount.toString(),
    receivingLBTAmountE8.toString(),
    slippage * 1000, // allow 5% slippage from requiredLBTAmountE8
    {from: buyer, gasPrice: 0}
  );

  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (log.event === "LogExchangeEthToBond") {
      const {volume, swapPairAmount: ethAmount} = log.args as {
        volume: BN;
        bondAmount: BN;
        swapPairAmount: BN;
      };
      const usdVolume = new BigNumber(volume.toString()).shiftedBy(-8);
      console.log("exchange volume (USD)         ", usdVolume.toString(10));
      const expectedUsdVolume = new BigNumber(ethAmount.toString())
        .shiftedBy(-decimalsOfEth)
        .times(ethPriceE0);
      console.log(
        "expected exchange volume (USD)",
        expectedUsdVolume.toString(10)
      );
      assert.ok(
        assertUsdVolume(usdVolume, expectedUsdVolume),
        "unexpected volume"
      );
    }
  }

  const afterLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  const lbtBalanceDiff = new BigNumber(afterLBTAmountE8.toString()).minus(
    beforeLBTAmountE8.toString()
  );
  assert.ok(
    lbtBalanceDiff.minus(receivingLBTAmountE8.toString()).abs().lt(10),
    `unexpected LBT amount\nactual:   ${lbtBalanceDiff.toString()}\nexpected: ${receivingLBTAmountE8.toString()}`
  );

  const afterDepositedEthAmount = await dotcInstance.ethAllowance(buyer);
  assert.equal(
    beforeDepositedEthAmount.sub(afterDepositedEthAmount).toString(),
    paidEthAmount.toString(),
    "unexpected ERC20 allowance"
  );

  const afterEthAmount = await web3.eth.getBalance(seller);
  assert.equal(
    new BigNumber(afterEthAmount).minus(beforeEthAmount).toString(),
    paidEthAmount.toString(),
    "unexpected ERC20 amount"
  );
};

const sellBond = async (
  poolId: string,
  bondId: string,
  options: {
    decimalsOfBond: number;
    ethPriceE0: BigNumber.Value;
    dotcInstance: OnlyBondVsEthExchangeInstance;
    bondMakerInstance: BondMakerCollateralizedEthInstance;
    seller: Address;
    buyer: Address;
  }
) => {
  const {
    decimalsOfBond,
    ethPriceE0,
    dotcInstance,
    bondMakerInstance,
    seller,
    buyer,
  } = options;

  const {bondTokenAddress: lbtAddress} = await callGetBond(
    bondMakerInstance,
    bondId
  );
  const lbtInstance = await BondToken.at(lbtAddress);

  console.log("execute calcRateBondToErc20");
  const rawRate = await dotcInstance.calcRateBondToEth.call(bondId, poolId);
  const rateE0 = Number(rawRate.toString()) / 1e8;

  console.log("erc20PriceE0:        ", ethPriceE0);
  console.log("calcRateE0:          ", rateE0);

  const paidLBTAmountE8 = 0.01 * 10 ** decimalsOfBond;
  const slippage = 0.05;
  const receivingEthAmount = applyDecimalGap(
    paidLBTAmountE8 * rateE0,
    decimalsOfBond,
    decimalsOfEth
  );
  console.log("paidLBTAmount:       ", paidLBTAmountE8);
  console.log("receivingEthAmount:  ", receivingEthAmount);

  await lbtInstance.approve(dotcInstance.address, paidLBTAmountE8, {
    from: buyer,
  });
  await dotcInstance.depositEth({
    from: seller,
    value: new BigNumber(10000).shiftedBy(decimalsOfEth).toString(10),
  });

  const beforeLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  const beforeEthAmount = await web3.eth.getBalance(buyer);

  const res = await dotcInstance.exchangeBondToEth(
    bondId,
    poolId,
    paidLBTAmountE8.toString(),
    receivingEthAmount.toString(),
    slippage * 1000, // allow 5% slippage from receivingLienAmount
    {from: buyer, gasPrice: 0}
  );

  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (log.event === "LogExchangeBondToEth") {
      const {volume, swapPairAmount: ethAmount} = log.args as {
        volume: BN;
        bondAmount: BN;
        swapPairAmount: BN;
      };
      const usdVolume = new BigNumber(volume.toString()).shiftedBy(-8);
      console.log("exchange volume (USD)         ", usdVolume.toString(10));
      const expectedUsdVolume = new BigNumber(ethAmount.toString())
        .shiftedBy(-decimalsOfEth)
        .times(ethPriceE0);
      console.log(
        "expected exchange volume (USD)",
        expectedUsdVolume.toString(10)
      );
      assert.ok(
        assertUsdVolume(usdVolume, expectedUsdVolume),
        "unexpected volume"
      );
    }
  }

  const afterLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  assert.equal(
    beforeLBTAmountE8.sub(afterLBTAmountE8).toString(),
    paidLBTAmountE8.toString(),
    "unexpected LBT amount"
  );
  const afterEthAmount = await web3.eth.getBalance(buyer);
  const ethBalanceDiff = new BigNumber(afterEthAmount.toString()).minus(
    beforeEthAmount.toString()
  );
  assert.ok(
    ethBalanceDiff.minus(receivingEthAmount.toString()).abs().lt(1000),
    `unexpected ETH amount\nactual:   ${toE0Amount(
      ethBalanceDiff,
      18
    ).toString()}\nexpected: ${toE0Amount(receivingEthAmount, 18).toString()}`
  );
};

export default {
  createPool,
  deletePool,
  buyBond,
  sellBond,
};
