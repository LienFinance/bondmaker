import {
  callGetBond,
  callGetBondGroup,
  createBondGroup,
  createSbtAndLbt,
  issueNewBonds,
  issueNewBondsCollateralizedErc20,
  issueNewBondsCollateralizedEth,
} from "../bondMaker/callFunction";
import {BigNumber} from "bignumber.js";
import {
  getBlockTimestampSec,
  days,
  advanceTime,
  beNearlyEqualTo,
  expectRevert,
  applyDecimalGap,
  fromE0Amount,
  toE0Amount,
} from "../util";
import {maturityScale} from "../constants";
import {
  BondMakerCollateralizedErc20Instance,
  BondMakerCollateralizedEthInstance,
  BondMakerInstance,
  BondPricerInterfaceInstance,
  Erc20MintableContract,
  GeneralizedDotcInstance,
  LatestPriceOracleInterfaceInstance,
  OnlyBondVsBondExchangeInstance,
  OracleInterfaceInstance,
  TestUsdcContract,
  VolatilityOracleInterfaceInstance,
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

const GeneralizedDotc = artifacts.require("OnlyBondVsBondExchange");
const LienToken = artifacts.require("TestLienToken");
const PriceInverseOracle = artifacts.require("PriceInverseOracle");
const FixedPriceOracle = artifacts.require("FixedPriceOracle");
const Oracle = artifacts.require("TestOracle");
const TestUSDC = artifacts.require("TestUSDC") as TestUsdcContract;
const BondMakerCollateralizedEth = artifacts.require(
  "BondMakerCollateralizedEth"
);
const BondMakerCollateralizedErc20 = artifacts.require(
  "BondMakerCollateralizedErc20"
);
const BondToken = artifacts.require("BondTokenInterface");
const BondTokenName = artifacts.require("BondTokenName");
const BondTokenFactory = artifacts.require("BondTokenFactory");
const DetectBondShape = artifacts.require("TestDetectBondShape");
const HistoricalVolatilityOracle = artifacts.require(
  "HistoricalVolatilityOracle"
);
const GeneralizedPricing = artifacts.require("GeneralizedPricing");
const BondPricer = artifacts.require("BondPricer");
const SbtPricer = artifacts.require("SbtPricerWithStableBorder");

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
  decimalsOfBond: 8,
  decimalsOfOraclePrice: 8,
};

export async function testExchangeVsBond(
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

  const seller = accounts[0];
  const buyer = accounts[2];

  console.log("init oracle: ", initRateETH2USD, initVolatility);
  const oracleInstance = await Oracle.new(
    fromE0Amount(initRateETH2USD, decimalsOfOraclePrice),
    fromE0Amount(initVolatility, 8)
  );
  const lienTokenInstance = await LienToken.new();
  let bondMakerInstance:
    | BondMakerCollateralizedEthInstance
    | BondMakerCollateralizedErc20Instance;
  if (isPutOption) {
    const usdc = await TestUSDC.new();
    await usdc.mint(fromE0Amount(100000, 6), {from: seller});
    await usdc.mint(fromE0Amount(100000, 6), {from: buyer});

    const bondOracleInstance = await PriceInverseOracle.new(
      oracleInstance.address
    ); // ETH/USDC
    bondMakerInstance = await BondMakerCollateralizedErc20.new(
      usdc.address,
      bondOracleInstance.address,
      lienTokenInstance.address,
      BondTokenName.address,
      BondTokenFactory.address,
      maturityScale,
      8,
      8
    );
  } else {
    const bondOracleInstance = oracleInstance; // USD/ETH
    bondMakerInstance = await BondMakerCollateralizedEth.new(
      bondOracleInstance.address,
      lienTokenInstance.address,
      BondTokenName.address,
      BondTokenFactory.address,
      maturityScale
    );
  }
  const bondMakerForUserInstance = await BondMakerCollateralizedEth.new(
    oracleInstance.address,
    lienTokenInstance.address,
    BondTokenName.address,
    BondTokenFactory.address,
    maturityScale
  );

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
  const sbtPricerInstance = await SbtPricer.new(
    generalizedPricerInstance.address,
    9000
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
      return {
        bondGroupID,
        bondID: bonds[targetBondIndex].bondID,
      };
    }

    throw new Error("invalid test case");
  })();

  const mintingBondAmountE0 = 1;
  await issueNewBonds(bondMakerInstance, bondGroupID, mintingBondAmountE0, {
    from: seller,
  });

  let maxSbtStrikePriceE0: BigNumber;
  const sbtIDs = new Array<string>();
  {
    const oracleAddress = await bondMakerForUserInstance.oracleAddress();
    const decimalsOfOraclePrice = (
      await bondMakerForUserInstance.decimalsOfOraclePrice()
    ).toNumber();
    const oracleInstance = await Oracle.at(oracleAddress);
    const oraclePrice = await oracleInstance.latestPrice.call();
    const oracleVolatility = await oracleInstance.getVolatility.call();
    maxSbtStrikePriceE0 = toE0Amount(oraclePrice, decimalsOfOraclePrice).div(2);

    const mintingBondAmountE0 = 5;
    const sbtUntilMaturity = Math.min(untilMaturity, 4 * days);
    const {bondGroupID, sbtID: sbtID, sbtAddress} = await createSbtAndLbt(
      bondMakerForUserInstance,
      nowSec + sbtUntilMaturity,
      maxSbtStrikePriceE0
    );
    sbtIDs.push(sbtID);
    await issueNewBonds(
      bondMakerForUserInstance,
      bondGroupID,
      mintingBondAmountE0,
      {
        from: buyer,
      }
    );
    const sbtInstance = await BondToken.at(sbtAddress);
    await sbtInstance.approve(
      dotcInstance.address,
      fromE0Amount(mintingBondAmountE0, decimalsOfBond),
      {from: buyer}
    );
    const {
      "1": bondType,
      "2": points,
    } = await bondShapeDetectorInstance.getBondTypeByID(
      bondMakerForUserInstance.address,
      sbtID,
      0
    );
    console.log("bondType", bondType.toString());
    try {
      const {
        "0": price,
        "1": leverage,
      } = await sbtPricerInstance.calcPriceAndLeverage(
        bondType,
        points,
        oraclePrice,
        oracleVolatility,
        sbtUntilMaturity
      );
      console.log(
        toE0Amount(price, 8).toString(10),
        toE0Amount(leverage, 8).toString(10)
      );
    } catch (err) {
      if (!errorMessage) {
        expect.fail(
          `should not fail to calculate SBT price and leverage: ${err.message}`
        );
      }
      if (
        errorMessage === "exchange rate is too small" &&
        expectRevert(err.message, "input is too large")
      ) {
        console.log("expected error:", err.message);
        return; //success
      }
      assert.ok(
        expectRevert(err.message, errorMessage),
        `fail to calculate SBT price and leverage\nactual:   ${err.message}\nexpected: ${errorMessage}`
      );
      console.log("expected error:", err.message);
      return; // success
    }
  }

  const createPoolOptions = {
    volatilityOracleInstance,
    bondPricerInstance,
    bondMakerForUserInstance: bondMakerForUserInstance,
    bondPricerForUserInstance: sbtPricerInstance,
    dotcInstance,
    seller,
  };

  const poolId = await createPool(feeBaseE0 ?? 0, createPoolOptions);

  if (exchangeTimeUntilMaturity !== undefined) {
    advanceTime(untilMaturity - exchangeTimeUntilMaturity);
  }

  const exchangeOptions = {
    decimalsOfBond,
    decimalsOfSbt: decimalsOfBond,
    dotcInstance,
    bondMakerInstance,
    seller,
    buyer,
    maxSbtStrikePriceE0,
  };

  console.log("\n## sell LBT");
  try {
    await buyBond(poolId, bondID, sbtIDs, exchangeOptions);
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

  await deletePool(poolId, {dotcInstance, seller});

  if (errorMessage !== "") {
    assert.ok(false, "should fail to execute this test");
  }
}

async function createPool(
  feeBaseE0: number,
  options: {
    bondPricerInstance: BondPricerInterfaceInstance;
    volatilityOracleInstance: VolatilityOracleInterfaceInstance;
    bondMakerForUserInstance: BondMakerInstance;
    bondPricerForUserInstance: BondPricerInterfaceInstance;
    dotcInstance: OnlyBondVsBondExchangeInstance;
    seller: Address;
  }
) {
  const {
    bondMakerForUserInstance,
    volatilityOracleInstance,
    bondPricerForUserInstance,
    bondPricerInstance,
    dotcInstance,
    seller,
  } = options;
  const feeBaseE4 = feeBaseE0 * 1e4;
  const volatilityOracleAddress = volatilityOracleInstance.address;
  const bondPricerAddress = bondPricerInstance.address;
  const bondMakerForUserAddress = bondMakerForUserInstance.address;
  const bondPricerForUserAddress = bondPricerForUserInstance.address;
  const poolId = await dotcInstance.createVsBondPool.call(
    bondMakerForUserAddress,
    volatilityOracleAddress,
    bondPricerForUserAddress,
    bondPricerAddress,
    feeBaseE4,
    {
      from: seller,
    }
  );
  await dotcInstance.createVsBondPool(
    bondMakerForUserAddress,
    volatilityOracleAddress,
    bondPricerForUserAddress,
    bondPricerAddress,
    feeBaseE4,
    {
      from: seller,
    }
  );

  return poolId;
}

const deletePool = async (
  poolId: string,
  options: {
    dotcInstance: OnlyBondVsBondExchangeInstance;
    seller: Address;
  }
) => {
  const {dotcInstance, seller} = options;
  await dotcInstance.deleteVsBondPool(poolId, {from: seller});
};

const buyBond = async (
  poolId: string,
  bondId: string,
  sbtIds: string[],
  options: {
    decimalsOfBond: number;
    decimalsOfSbt: number;
    dotcInstance: OnlyBondVsBondExchangeInstance;
    bondMakerInstance: BondMakerInstance;
    seller: Address;
    buyer: Address;
    maxSbtStrikePriceE0?: BigNumber.Value;
  }
) => {
  const {
    decimalsOfBond,
    decimalsOfSbt,
    dotcInstance,
    bondMakerInstance,
    seller,
    buyer,
    maxSbtStrikePriceE0,
  } = options;

  const {
    bondTokenAddress: lbtAddress,
    maturity: lbtMaturity,
  } = await callGetBond(bondMakerInstance, bondId);
  const lbtInstance = await BondToken.at(lbtAddress);

  console.log("execute calcRateBondToErc20");
  const rawRate = await dotcInstance.calcRateBondToUsd.call(bondId, poolId);
  const rateE0 = Number(rawRate.toString()) / 1e8;

  console.log("calcRateE0:             ", rateE0);

  // buyer takes LBT and seller takes ERC20
  const requiredLBTAmountE8 = 0.01 * 10 ** decimalsOfBond;
  const slippage = 0.05;
  const paidSbtAmountInDollars = applyDecimalGap(
    requiredLBTAmountE8 * rateE0,
    decimalsOfBond,
    8
  );
  const receivingLBTAmountE8 =
    rateE0 === 0
      ? 0
      : applyDecimalGap(
          paidSbtAmountInDollars / rateE0,
          decimalsOfSbt,
          decimalsOfBond
        );
  console.log("paidSbtAmountInDollars:", paidSbtAmountInDollars);
  console.log("receivingLbtAmountE8:  ", receivingLBTAmountE8);

  const beforeBondAllowanceInDollars = await dotcInstance.totalBondAllowance.call(
    poolId,
    sbtIds,
    lbtMaturity,
    buyer
  );
  console.log("before bond allowance", beforeBondAllowanceInDollars.toString());

  await lbtInstance.approve(dotcInstance.address, requiredLBTAmountE8 * 10, {
    from: seller,
  });

  const beforeLBTAmountE8 = await lbtInstance.balanceOf(buyer);
  console.log("before LBT amount", beforeLBTAmountE8.toString());

  const res = await dotcInstance.exchangeBondToBond(
    bondId,
    poolId,
    sbtIds,
    paidSbtAmountInDollars,
    receivingLBTAmountE8,
    slippage * 1000, // allow 5% slippage from requiredLBTAmountE8
    {
      from: buyer,
    }
  );

  for (let i = 0; i < res.logs.length; i++) {
    const log = res.logs[i];
    if (log.event === "LogExchangeBondToBond") {
      const {volume} = log.args as {
        volume: BN;
        bondAmount: BN;
        swapPairAmount: BN;
      };
      const usdVolume = new BigNumber(volume.toString()).shiftedBy(-8);
      console.log("exchange volume (USD)         ", usdVolume.toString(10));
      const expectedUsdVolume = new BigNumber(paidSbtAmountInDollars).shiftedBy(
        -8
      );
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

  const lbtBalanceDiff = afterLBTAmountE8.sub(beforeLBTAmountE8);
  assert.ok(
    new BigNumber(lbtBalanceDiff.toString())
      .minus(receivingLBTAmountE8.toString())
      .abs()
      .lt(10),
    `unexpected LBT amount\nactual:   ${lbtBalanceDiff.toString()}\nexpected: ${receivingLBTAmountE8.toString()}`
  );
  const afterBondAllowanceInDollars = await dotcInstance.totalBondAllowance.call(
    poolId,
    sbtIds,
    lbtMaturity,
    buyer
  );
  console.log("after bond allowance", afterBondAllowanceInDollars.toString());

  const BondAllowanceDiff = beforeBondAllowanceInDollars.sub(
    afterBondAllowanceInDollars
  );
  assert.ok(
    new BigNumber(BondAllowanceDiff.toString())
      .minus(paidSbtAmountInDollars.toString())
      .abs()
      .lt(maxSbtStrikePriceE0 ?? 0),
    `unexpected SBT balance\nactual:   ${BondAllowanceDiff.toString()}\nexpected: ${paidSbtAmountInDollars.toString()}`
  );
};

export default {
  createPool,
  deletePool,
  buyBond,
};
