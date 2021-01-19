import BigNumber from "bignumber.js";
import testCases from "./testCases";
import {
  createBondGroup,
  callGetBond,
  issueNewBondsCollateralizedErc20,
} from "../bondMaker/callFunction";
import {
  advanceTime,
  days,
  getBlockTimestampSec,
  mineOneBlock,
  fromBTAmount,
  nullAddress,
  vmExceptionTemplate,
} from "../util";
import {init} from "../initCollateralizedErc20";
import type {Ierc20Contract} from "../../types/truffle-contracts";

const Oracle = artifacts.require("TestOracle");
const Usdc = artifacts.require("TestUsdc");
const BondMaker = artifacts.require("EthBondMakerCollateralizedUsdc");
const BondToken = artifacts.require("BondTokenCollateralizedErc20");

const getDuplicate = <T>(
  list: T[],
  eq: (a: T, b: T) => boolean = (a, b) => a === b
): T[] => {
  const elements = new Array<T>();
  list.forEach((a, index) => {
    list.slice(index + 1).forEach((b) => {
      if (eq(a, b) && !elements.includes(a)) {
        elements.push(a);
      }
    });
  });

  return elements;
};

const getExceptionBonds = (
  inputBondIDs: string[],
  outputBondIDs: string[]
): string[] => {
  const inputDuplication = getDuplicate(inputBondIDs);
  const outputDuplication = getDuplicate(outputBondIDs);
  return inputBondIDs.filter(
    (bondID) =>
      outputBondIDs.includes(bondID) &&
      !inputDuplication.includes(bondID) &&
      !outputDuplication.includes(bondID)
  );
};

contract("BondMaker", (accounts) => {
  let contractAddresses: {
    oracle: string;
    bondMaker: string;
  };

  let usdcAddress: string;

  before(async () => {
    const usdcContract = await Usdc.new();
    usdcAddress = usdcContract.address;
    const initBalance = 100000;
    await accounts.reduce(async (acc, account) => {
      await acc;
      await usdcContract.mint(
        new BigNumber(initBalance).shiftedBy(6).dp(0).toString(10),
        {
          from: account,
        }
      );
      return Promise.resolve();
    }, Promise.resolve());

    contractAddresses = await init(
      (usdcContract as unknown) as Ierc20Contract,
      BondMaker,
      null,
      null,
      null
    );
  });

  describe("exchangeEquivalentBonds", () => {
    const cases = testCases.exchangeEquivalentBonds;

    cases.forEach(
      (
        {
          errorMessage,
          periodSecBeforeMaturity,
          inputBondGroup,
          outputBondGroup,
          mintingAmount,
        },
        caseIndex
      ) => {
        it(`case ${caseIndex}`, async () => {
          const oracleContract = await Oracle.at(contractAddresses.oracle);
          const usdcContract = await Usdc.at(usdcAddress);
          const bondMakerContract = await BondMaker.at(
            contractAddresses.bondMaker
          );

          const now = await getBlockTimestampSec();
          const maturity = now + periodSecBeforeMaturity;

          for (const fnMap of [
            ...inputBondGroup.fnMaps.filter(
              (fnMap) => !outputBondGroup.fnMaps.includes(fnMap)
            ),
            ...outputBondGroup.fnMaps,
          ]) {
            const bondID = await bondMakerContract.generateBondID(
              maturity,
              fnMap
            );
            const {bondTokenAddress} = await callGetBond(
              bondMakerContract,
              bondID
            );

            // Register a bond if necessary.
            if (bondTokenAddress === nullAddress) {
              await bondMakerContract.registerNewBond(maturity, fnMap);
            }
          }

          const inputBondGroupInfo = await createBondGroup(
            bondMakerContract,
            inputBondGroup.fnMaps,
            maturity
          );
          const inputBondIDs = inputBondGroupInfo.bonds.map(
            ({bondID}) => bondID
          );
          const newBondGroupID = inputBondGroupInfo.bondGroupID;
          console.log("inputBondIDs", inputBondIDs);

          const outputBondGroupInfo = await createBondGroup(
            bondMakerContract,
            outputBondGroup.fnMaps,
            maturity
          );
          const outputBondIDs = outputBondGroupInfo.bonds.map(
            ({bondID}) => bondID
          );
          const outputBondGroupID = outputBondGroupInfo.bondGroupID;
          console.log("outputBondIDs", outputBondIDs);

          const exceptionBonds = getExceptionBonds(inputBondIDs, outputBondIDs);

          console.log("exceptionBonds", exceptionBonds);

          await issueNewBondsCollateralizedErc20(
            bondMakerContract,
            newBondGroupID,
            mintingAmount,
            {from: accounts[0]}
          );

          try {
            await bondMakerContract.exchangeEquivalentBonds(
              newBondGroupID,
              outputBondGroupID,
              fromBTAmount(mintingAmount),
              exceptionBonds
            );
          } catch (err) {
            assert.equal(
              err.message,
              vmExceptionTemplate(errorMessage),
              "fail to execute registerNewBondGroup"
            );
            console.log("expected error:", err.message);
            return;
          }

          await advanceTime(periodSecBeforeMaturity);
          await mineOneBlock();

          await oracleContract.testSetOracleData(
            new BigNumber(200).shiftedBy(8).toString(10),
            new BigNumber(0).shiftedBy(8).toString(10)
          );

          await bondMakerContract.liquidateBond(newBondGroupID, 0);
          await bondMakerContract.liquidateBond(outputBondGroupID, 0);

          let totalObtainedCollateral = new BigNumber(0);
          for (const bondID of [
            ...inputBondIDs.filter((bondID) => !outputBondIDs.includes(bondID)),
            ...outputBondIDs,
          ]) {
            const bondInfo = await bondMakerContract.getBond(bondID);
            const bondAddress = bondInfo[0];
            const bondInstance = await BondToken.at(bondAddress);
            const res = await bondInstance.burnAll();
            const logs = res.logs.filter((log) => log.event === "Transfer");
            console.log("the number of logs", logs.length);
            const decimalsOfCollateral = Number(await usdcContract.decimals());
            const obtainedCollateral = logs.reduce(
              (acc, log) =>
                acc.plus(
                  new BigNumber(log.args.value.toString()).shiftedBy(
                    decimalsOfCollateral
                  )
                ),
              new BigNumber(0)
            );
            console.log(
              "obtained collateral:",
              obtainedCollateral.toFixed(decimalsOfCollateral)
            );
            totalObtainedCollateral = totalObtainedCollateral.plus(
              obtainedCollateral
            );
          }

          const epsilon = 1e-7;
          assert.ok(
            new BigNumber(mintingAmount)
              .minus(totalObtainedCollateral)
              .isLessThanOrEqualTo(epsilon),
            "totalObtainedCollateral must be nearly equal to paidCollateral"
          );

          if (errorMessage !== "") {
            assert.fail("should be fail to execute");
          }
        });
      }
    );
  });
});

contract("BondMaker", (accounts) => {
  let newBondGroupID: string;

  const periodSecBeforeMaturity = 3 * days;
  const bondAmount = 0.01;
  const fnMaps = testCases.exchangeEquivalentBonds[0].inputBondGroup.fnMaps;

  let contractAddresses: {
    oracle: string;
    bondMaker: string;
  };

  let usdcAddress: string;

  before(async () => {
    const usdcContract = await Usdc.new();
    usdcAddress = usdcContract.address;
    const initBalance = 100000;
    await accounts.reduce(async (acc, account) => {
      await acc;
      await usdcContract.mint(
        new BigNumber(initBalance).shiftedBy(6).dp(0).toString(10),
        {
          from: account,
        }
      );
      return Promise.resolve();
    }, Promise.resolve());

    contractAddresses = await init(
      (usdcContract as unknown) as Ierc20Contract,
      BondMaker,
      null,
      null,
      null
    );
  });

  beforeEach(async () => {
    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
    await advanceTime(1 * days);
    await mineOneBlock();
    const now = await getBlockTimestampSec();
    const res = await createBondGroup(
      bondMakerContract,
      fnMaps,
      now + periodSecBeforeMaturity
    );
    newBondGroupID = res.bondGroupID;
  });

  it("cannot issue bond token after liquidateBond", async () => {
    const oracleContract = await Oracle.at(contractAddresses.oracle);
    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);

    await issueNewBondsCollateralizedErc20(
      bondMakerContract,
      newBondGroupID,
      bondAmount,
      {
        from: accounts[0],
      }
    );

    await advanceTime(periodSecBeforeMaturity);
    await mineOneBlock();

    await oracleContract.testSetOracleData(
      new BigNumber(100).shiftedBy(8).toString(10),
      new BigNumber(0).shiftedBy(8).toString(10)
    );

    try {
      await bondMakerContract.liquidateBond(newBondGroupID, 0);
      await issueNewBondsCollateralizedErc20(
        bondMakerContract,
        newBondGroupID,
        bondAmount,
        {
          from: accounts[0],
        }
      );
    } catch (err) {
      return;
    }

    assert.fail(
      "did not fail `cannot issue bond token after liquidateBond` test"
    );
  });
});

contract("BondMaker", (accounts) => {
  let newBondGroupID: string;
  let outputBondGroupID: string;
  let anotherBondGroupID: string;

  const periodSecBeforeMaturity = 3 * days;
  const bondAmount = 0.01;
  const fnMaps = testCases.exchangeEquivalentBonds[0].inputBondGroup.fnMaps;
  const fnMaps2 = testCases.exchangeEquivalentBonds[0].outputBondGroup.fnMaps;

  let contractAddresses: {
    oracle: string;
    bondMaker: string;
  };

  let usdcAddress: string;

  before(async () => {
    const usdcContract = await Usdc.new();
    usdcAddress = usdcContract.address;
    const initBalance = 100000;
    await accounts.reduce(async (acc, account) => {
      await acc;
      await usdcContract.mint(
        new BigNumber(initBalance).shiftedBy(6).dp(0).toString(10),
        {
          from: account,
        }
      );
      return Promise.resolve();
    }, Promise.resolve());

    contractAddresses = await init(
      (usdcContract as unknown) as Ierc20Contract,
      BondMaker,
      null,
      null,
      null
    );
  });

  beforeEach(async () => {
    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
    await advanceTime(1 * days);
    await mineOneBlock();
    const now = await getBlockTimestampSec();
    const res = await createBondGroup(
      bondMakerContract,
      fnMaps,
      now + periodSecBeforeMaturity
    );
    newBondGroupID = res.bondGroupID;
    const res2 = await createBondGroup(
      bondMakerContract,
      fnMaps2,
      now + periodSecBeforeMaturity
    );
    outputBondGroupID = res2.bondGroupID;
    const res3 = await createBondGroup(
      bondMakerContract,
      fnMaps,
      now + periodSecBeforeMaturity + 86400
    );
    anotherBondGroupID = res3.bondGroupID;
  });

  it(`cannot exchangeEquivalentBonds bond token after liquidateBond`, async () => {
    const oracleContract = await Oracle.at(contractAddresses.oracle);
    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);

    await issueNewBondsCollateralizedErc20(
      bondMakerContract,
      newBondGroupID,
      bondAmount,
      {
        from: accounts[0],
      }
    );

    await issueNewBondsCollateralizedErc20(
      bondMakerContract,
      anotherBondGroupID,
      bondAmount,
      {
        from: accounts[0],
      }
    );

    await advanceTime(periodSecBeforeMaturity);
    await mineOneBlock();

    await oracleContract.testSetOracleData(
      new BigNumber(100).shiftedBy(8).toString(10),
      new BigNumber(0).shiftedBy(8).toString(10)
    );

    await bondMakerContract.liquidateBond(newBondGroupID, 0);

    try {
      await bondMakerContract.exchangeEquivalentBonds(
        newBondGroupID,
        outputBondGroupID,
        fromBTAmount(bondAmount),
        []
      );
    } catch (err) {
      return;
    }

    assert.fail(
      "did not fail `cannot exchangeEquivalentBonds bond token after liquidateBond` test"
    );
  });
});
