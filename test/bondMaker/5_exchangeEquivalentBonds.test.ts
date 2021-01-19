import BigNumber from "bignumber.js";
import testCases from "./testCases";
import {createBondGroup, issueNewBondsCollateralizedEth} from "./callFunction";
import {
  advanceTime,
  days,
  getBlockTimestampSec,
  mineOneBlock,
  fromBTAmount,
  toEtherAmount,
  nullAddress,
  vmExceptionTemplate,
} from "../util";
import {callGetBond} from "./callFunction";

const Oracle = artifacts.require("TestOracle");
const BondMaker = artifacts.require("BondMakerCollateralizedEth");
const BondToken = artifacts.require("BondTokenCollateralizedEth");

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

contract("BondMaker", () => {
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
          const oracleContract = await Oracle.deployed();
          const bondMakerContract = await BondMaker.deployed();

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

          await issueNewBondsCollateralizedEth(
            bondMakerContract,
            newBondGroupID,
            mintingAmount
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

          let totalObtainedEth = new BigNumber(0);
          for (const bondID of [
            ...inputBondIDs.filter((bondID) => !outputBondIDs.includes(bondID)),
            ...outputBondIDs,
          ]) {
            const bondInfo = await bondMakerContract.getBond(bondID);
            const bondAddress = bondInfo[0];
            const bondInstance = await BondToken.at(bondAddress);
            const res = await bondInstance.burnAll();
            const logs = res.logs.filter(
              (log) => log.event === "LogTransferETH"
            );
            console.log("the number of logs", logs.length);
            const obtainedEth = logs.reduce(
              (acc, log) => acc.plus(toEtherAmount(log.args.value.toString())),
              new BigNumber(0)
            );
            console.log("obtained ETH:", obtainedEth.toFixed(18));
            totalObtainedEth = totalObtainedEth.plus(obtainedEth);
          }

          const epsilon = 1e-7;
          assert.ok(
            new BigNumber(mintingAmount)
              .minus(totalObtainedEth)
              .isLessThanOrEqualTo(epsilon),
            "totalObtainedEth must be equal to paidEth"
          );

          if (errorMessage !== "") {
            assert.fail("should be fail to execute");
          }
        });
      }
    );
  });
});

contract("BondMaker", () => {
  let newBondGroupID: string;

  const periodSecBeforeMaturity = 3 * days;
  const bondAmount = 0.01;
  const fnMaps = testCases.exchangeEquivalentBonds[0].inputBondGroup.fnMaps;

  beforeEach(async () => {
    const bondMakerContract = await BondMaker.deployed();
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
    const oracleContract = await Oracle.deployed();
    const bondMakerContract = await BondMaker.deployed();

    await issueNewBondsCollateralizedEth(
      bondMakerContract,
      newBondGroupID,
      bondAmount
    );

    await advanceTime(periodSecBeforeMaturity);
    await mineOneBlock();

    await oracleContract.testSetOracleData(
      new BigNumber(100).shiftedBy(8).toString(10),
      new BigNumber(0).shiftedBy(8).toString(10)
    );

    try {
      await bondMakerContract.liquidateBond(newBondGroupID, 0);
      await issueNewBondsCollateralizedEth(
        bondMakerContract,
        newBondGroupID,
        bondAmount
      );
    } catch (err) {
      return;
    }

    assert.fail(
      "did not fail `cannot issue bond token after liquidateBond` test"
    );
  });
});

contract("BondMaker", () => {
  let newBondGroupID: string;
  let outputBondGroupID: string;
  let anotherBondGroupID: string;

  const periodSecBeforeMaturity = 3 * days;
  const bondAmount = 0.01;
  const fnMaps = testCases.exchangeEquivalentBonds[0].inputBondGroup.fnMaps;
  const fnMaps2 = testCases.exchangeEquivalentBonds[0].outputBondGroup.fnMaps;

  beforeEach(async () => {
    const bondMakerContract = await BondMaker.deployed();
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
    const oracleContract = await Oracle.deployed();
    const bondMakerContract = await BondMaker.deployed();
    await issueNewBondsCollateralizedEth(
      bondMakerContract,
      newBondGroupID,
      bondAmount
    );
    await issueNewBondsCollateralizedEth(
      bondMakerContract,
      anotherBondGroupID,
      bondAmount
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
