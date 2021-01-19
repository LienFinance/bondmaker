import BigNumber from "bignumber.js";

import {getBlockTimestampSec, days, expectRevert} from "../util";
import {init} from "../init";

const Oracle = artifacts.require("TestOracle");
const BondMaker = artifacts.require("BondMakerCollateralizedEth");
const BondMakerHelper = artifacts.require("BondMakerHelper");
const BondShapeDetector = artifacts.require("DetectBondShape");

function getBondTypeName(bondType: number) {
  return bondType === 1
    ? "pure-SBT"
    : bondType === 2
    ? "semi-SBT"
    : bondType === 3
    ? "LBT"
    : bondType === 4
    ? "triangle BT"
    : "none";
}

contract("BondMakerHelper", () => {
  let contractAddresses: {
    oracle: string;
    bondMaker: string;
  };

  let bondMakerHelperAddress: string;
  let bondShapeDetectorAddress: string;

  before(async () => {
    contractAddresses = await init(BondMaker, null, null, null);
    const bondMakerHelperContract = await BondMakerHelper.new();
    bondMakerHelperAddress = bondMakerHelperContract.address;
    const bondShapeDetectorContract = await BondShapeDetector.new();
    bondShapeDetectorAddress = bondShapeDetectorContract.address;
  });

  describe("registerNewBondGroup", () => {
    [
      {
        errorMessage: "",
        spotPrice: 60000000000,
        sbtStrikePrice: 60000000000,
      },
      {
        errorMessage: "",
        spotPrice: 60000000000,
        lbtStrikePrice: 60000000000,
      },
      {
        errorMessage: "",
        spotPrice: 60000000000,
        sbtStrikePrice: 60000000000,
        lbtStrikePrice: 60000000000,
      },
      {
        errorMessage: "",
        spotPrice: 60000000000,
        sbtStrikePrice: 30000000000,
        lbtStrikePrice: 60000000000,
      },
      {
        errorMessage: "",
        spotPrice: 166666,
        sbtStrikePrice: 166666,
      },
      {
        errorMessage: "",
        spotPrice: 166666,
        lbtStrikePrice: 166666,
      },
      {
        errorMessage: "",
        spotPrice: 166666,
        sbtStrikePrice: 166666,
        lbtStrikePrice: 166666,
      },
      {
        errorMessage: "",
        spotPrice: 166666,
        sbtStrikePrice: 111110,
        lbtStrikePrice: 166666,
      },
      {
        errorMessage: "must be 0.1 <= S/K <= 10",
        spotPrice: 166666,
        sbtStrikePrice: 60000000000,
      },
    ].map(
      (
        {errorMessage, spotPrice, sbtStrikePrice, lbtStrikePrice},
        caseIndex
      ) => {
        it(`case ${caseIndex}`, async () => {
          const bondMakerHelperContract = await BondMakerHelper.at(
            bondMakerHelperAddress
          );
          const bondMakerContract = await BondMaker.at(
            contractAddresses.bondMaker
          );
          const bondShapeDetectorContract = await BondShapeDetector.at(
            bondShapeDetectorAddress
          );

          const volatility = 0.4;
          const oracleContract = await Oracle.at(contractAddresses.oracle);
          await oracleContract.testSetOracleData(
            spotPrice.toString(10),
            new BigNumber(volatility).shiftedBy(8).toString(10)
          );
          const maturity = (await getBlockTimestampSec()) + 4 * days;

          try {
            if (sbtStrikePrice !== undefined && lbtStrikePrice === undefined) {
              const res = await bondMakerHelperContract.registerSbt(
                contractAddresses.bondMaker,
                sbtStrikePrice,
                maturity
              );
              const {bondID} = res.logs[res.logs.length - 1].args;
              const {
                "0": ok,
                "1": bondType,
                "2": points,
              } = await bondShapeDetectorContract.getBondTypeByID(
                contractAddresses.bondMaker,
                bondID,
                0
              );
              console.log(
                ok,
                getBondTypeName(bondType.toNumber()),
                points.map((v) => v.toNumber())
              );
            } else if (
              sbtStrikePrice === undefined &&
              lbtStrikePrice !== undefined
            ) {
              const res = await bondMakerHelperContract.registerLbt(
                contractAddresses.bondMaker,
                lbtStrikePrice,
                maturity
              );
              const {bondID} = res.logs[res.logs.length - 1].args;
              const {
                "0": ok,
                "1": bondType,
                "2": points,
              } = await bondShapeDetectorContract.getBondTypeByID(
                contractAddresses.bondMaker,
                bondID,
                0
              );
              console.log(
                ok,
                getBondTypeName(bondType.toNumber()),
                points.map((v) => v.toNumber())
              );
            } else if (
              sbtStrikePrice !== undefined &&
              lbtStrikePrice !== undefined
            ) {
              if (sbtStrikePrice === lbtStrikePrice) {
                const res = await bondMakerHelperContract.registerSbtAndLbtAndBondGroup(
                  contractAddresses.bondMaker,
                  sbtStrikePrice,
                  maturity
                );
                const {bondGroupID: rawBondGroupID, bondIDs} = res.logs[
                  res.logs.length - 1
                ].args as {bondGroupID: BN; bondIDs: string[]};
                const bondGroupID = rawBondGroupID.toString();
                for (const bondID of bondIDs) {
                  const {
                    "0": ok,
                    "1": bondType,
                    "2": points,
                  } = await bondShapeDetectorContract.getBondTypeByID(
                    contractAddresses.bondMaker,
                    bondID,
                    0
                  );
                  console.log(
                    ok,
                    getBondTypeName(bondType.toNumber()),
                    points.map((v) => v.toNumber())
                  );
                }
              } else {
                await bondMakerHelperContract.registerLbt(
                  contractAddresses.bondMaker,
                  lbtStrikePrice,
                  maturity
                );
                const res = await bondMakerHelperContract.registerExoticBondAndBondGroup(
                  contractAddresses.bondMaker,
                  sbtStrikePrice,
                  lbtStrikePrice,
                  maturity
                );
                const {bondGroupID: rawBondGroupID, bondIDs} = res.logs[
                  res.logs.length - 1
                ].args as {bondGroupID: BN; bondIDs: string[]};
                const bondGroupID = rawBondGroupID.toString();
                for (const bondID of bondIDs) {
                  const {
                    "0": ok,
                    "1": bondType,
                    "2": points,
                  } = await bondShapeDetectorContract.getBondTypeByID(
                    contractAddresses.bondMaker,
                    bondID,
                    0
                  );
                  console.log(
                    ok,
                    getBondTypeName(bondType.toNumber()),
                    points.map((v) => v.toNumber())
                  );
                }
              }
            } else {
              throw new Error("invalid test case");
            }
          } catch (err) {
            if (!errorMessage) {
              assert.fail(
                `should not fail to register bond group: ${err.message}`
              );
            }
            assert.ok(
              expectRevert(err.message, errorMessage),
              `fail to register bond group\nactual:   ${err.message}\nexpected: ${errorMessage}`
            );
            console.log("expected error:", err.message);
            return; // success
          }

          assert.ok(!errorMessage, `should fail to register bond group`);
        });
      }
    );
  });
});
