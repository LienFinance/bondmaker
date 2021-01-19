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
  OnlyBondVsErc20ExchangeInstance,
  OracleInterfaceInstance,
  PriceOracleInterfaceInstance,
} from "../../types/truffle-contracts";

type Address = string;

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

const GeneralizedDotc = artifacts.require("OnlyBondVsErc20Exchange");
const LienToken = artifacts.require("TestLienToken");
const PriceInverseOracle = artifacts.require("PriceInverseOracle");
const FixedPriceOracle = artifacts.require("FixedPriceOracle");
const TestErc20 = artifacts.require("ERC20Mintable") as Erc20MintableContract;
const Oracle = artifacts.require("TestOracle");
const PriceOracleInterface = artifacts.require("PriceOracleInterface");
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

export async function testExchangeVsErc20(
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
    erc20PriceE0,
    decimalsOfErc20,
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

  const erc20Instance = await TestErc20.new(decimalsOfErc20);

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

  let erc20OracleInstance: LatestPriceOracleInterfaceInstance = await FixedPriceOracle.new(
    Math.floor(erc20PriceE0 * 10 ** decimalsOfOraclePrice)
  );
  // if (isPutOption) {
  //     erc20OracleInstance = await Oracle.new(
  //         Math.floor(erc20PriceE0 * 10 ** decimalsOfOraclePrice),
  //         Math.floor(initVolatility * 10 ** 8)
  //     );
  // } else {
  //     erc20OracleInstance = await FixedPriceOracle.new(
  //         Math.floor(erc20PriceE0 * 10 ** decimalsOfOraclePrice)
  //     );
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

  const mintingErc20AmountE0 = 100;
  await erc20Instance.mint(mintingErc20AmountE0 * 10 ** decimalsOfErc20, {
    from: seller,
  });
  await erc20Instance.mint(mintingErc20AmountE0 * 10 ** decimalsOfErc20, {
    from: buyer,
  });

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
    erc20Instance,
    erc20OracleInstance,
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
    decimalsOfErc20,
    erc20PriceE0,
    erc20Instance,
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
    erc20Instance: Erc20MintableInstance;
    erc20OracleInstance: LatestPriceOracleInterfaceInstance;
    dotcInstance: OnlyBondVsErc20ExchangeInstance;
    seller: Address;
  }
) {
  const {
    erc20Instance,
    erc20OracleInstance,
    bondPricerInstance,
    dotcInstance,
    seller,
  } = options;
  const feeBaseE4 = feeBaseE0 * 1e4;
  const bondPricerAddress = bondPricerInstance.address;
  const swapPairAddress = erc20Instance.address;
  const swapPairOracleAddress = erc20OracleInstance.address;
  const poolId = await dotcInstance.createVsErc20Pool.call(
    swapPairAddress,
    swapPairOracleAddress,
    bondPricerAddress,
    feeBaseE4,
    isBondSale,
    {
      from: seller,
    }
  );
  await dotcInstance.createVsErc20Pool(
    swapPairAddress,
    swapPairOracleAddress,
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
    dotcInstance: OnlyBondVsErc20ExchangeInstance;
    seller: Address;
  }
) => {
  const {dotcInstance, seller} = options;
  await dotcInstance.deleteVsErc20Pool(poolId, {from: seller});
};

const buyBond = async (
  poolId: string,
  bondId: string,
  options: {
    decimalsOfBond: number;
    decimalsOfErc20: number;
    erc20PriceE0: BigNumber.Value;
    erc20Instance: Erc20MintableInstance;
    dotcInstance: OnlyBondVsErc20ExchangeInstance;
    bondMakerInstance: BondMakerCollateralizedEthInstance;
    seller: Address;
    buyer: Address;
  }
) => {
  const {
    decimalsOfBond,
    decimalsOfErc20,
    erc20PriceE0,
    erc20Instance,
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
  const rawRate = await dotcInstance.calcRateBondToErc20.call(bondId, poolId);
  const rateE0 = Number(rawRate.toString()) / 1e8;

  console.log("erc20PriceE0:           ", erc20PriceE0);
  console.log("calcRateE0:             ", rateE0);

  // buyer takes LBT and seller takes ERC20
  const requiredLBTAmountE8 = 0.01 * 10 ** decimalsOfBond;
  const slippage = 0.05;
  const paidErc20Amount = applyDecimalGap(
    requiredLBTAmountE8 * rateE0,
    decimalsOfBond,
    decimalsOfErc20
  );
  const receivingLBTAmountE8 =
    rateE0 === 0
      ? 0
      : applyDecimalGap(
          paidErc20Amount / rateE0,
          decimalsOfErc20,
          decimalsOfBond
        );
  console.log("paidErc20Amount:     ", paidErc20Amount);
  console.log("receivingLbtAmountE8:", receivingLBTAmountE8);

  await erc20Instance.approve(dotcInstance.address, paidErc20Amount, {
    from: buyer,
  });
  await lbtInstance.approve(dotcInstance.address, requiredLBTAmountE8 * 10, {
    from: seller,
  });

  const beforeLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  const beforeERC20Amount = await erc20Instance.balanceOf(buyer);

  const res = await dotcInstance.exchangeErc20ToBond(
    bondId,
    poolId,
    paidErc20Amount,
    receivingLBTAmountE8,
    slippage * 1000, // allow 5% slippage from requiredLBTAmountE8
    {
      from: buyer,
    }
  );

  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (log.event === "LogExchangeErc20ToBond") {
      const {volume, swapPairAmount: erc20Amount} = log.args as {
        volume: BN;
        bondAmount: BN;
        swapPairAmount: BN;
      };
      const usdVolume = new BigNumber(volume.toString()).shiftedBy(-8);
      console.log("exchange volume (USD)         ", usdVolume.toString(10));
      const expectedUsdVolume = new BigNumber(erc20Amount.toString())
        .shiftedBy(-decimalsOfErc20)
        .times(erc20PriceE0);
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
  const afterERC20Amount = await erc20Instance.balanceOf(buyer);
  assert.equal(
    beforeERC20Amount.sub(afterERC20Amount).toString(),
    paidErc20Amount.toString(),
    "unexpected ERC20 amount"
  );
};

const sellBond = async (
  poolId: string,
  bondId: string,
  options: {
    decimalsOfBond: number;
    decimalsOfErc20: number;
    erc20PriceE0: BigNumber.Value;
    erc20Instance: Erc20MintableInstance;
    dotcInstance: OnlyBondVsErc20ExchangeInstance;
    bondMakerInstance: BondMakerCollateralizedEthInstance;
    seller: Address;
    buyer: Address;
  }
) => {
  const {
    decimalsOfBond,
    decimalsOfErc20,
    erc20PriceE0,
    erc20Instance,
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
  const rawRate = await dotcInstance.calcRateBondToErc20.call(bondId, poolId);
  const rateE0 = Number(rawRate.toString()) / 1e8;

  console.log("erc20PriceE0:        ", erc20PriceE0);
  console.log("calcRateE0:          ", rateE0);

  const paidLBTAmountE8 = 0.01 * 10 ** decimalsOfBond;
  const slippage = 0.05;
  const receivingErc20Amount = applyDecimalGap(
    paidLBTAmountE8 * rateE0,
    decimalsOfBond,
    decimalsOfErc20
  );
  console.log("paidLBTAmount:       ", paidLBTAmountE8);
  console.log("receivingERC20Amount:", receivingErc20Amount);

  await lbtInstance.approve(dotcInstance.address, paidLBTAmountE8, {
    from: buyer,
  });
  await erc20Instance.approve(dotcInstance.address, 10000000000, {
    from: seller,
  });

  const beforeLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  const beforeERC20Amount = await erc20Instance.balanceOf(buyer);

  const res = await dotcInstance.exchangeBondToErc20(
    bondId,
    poolId,
    paidLBTAmountE8,
    receivingErc20Amount,
    slippage * 1000, // allow 5% slippage from receivingLienAmount
    {from: buyer}
  );

  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (log.event === "LogExchangeBondToErc20") {
      const {volume, swapPairAmount: erc20Amount} = log.args as {
        volume: BN;
        bondAmount: BN;
        swapPairAmount: BN;
      };
      const usdVolume = new BigNumber(volume.toString()).shiftedBy(-8);
      console.log("exchange volume (USD)         ", usdVolume.toString(10));
      const expectedUsdVolume = new BigNumber(erc20Amount.toString())
        .shiftedBy(-decimalsOfErc20)
        .times(erc20PriceE0);
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
  const afterERC20Amount = await erc20Instance.balanceOf(buyer);
  const erc20BalanceDiff = new BigNumber(afterERC20Amount.toString()).minus(
    beforeERC20Amount.toString()
  );
  assert.ok(
    erc20BalanceDiff.minus(receivingErc20Amount.toString()).abs().lt(10),
    `unexpected ERC20 amount\nactual:   ${erc20BalanceDiff.toString()}\nexpected: ${receivingErc20Amount.toString()}`
  );
};

export default {
  createPool,
  deletePool,
  buyBond,
  sellBond,
};
