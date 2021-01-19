import BigNumber from "bignumber.js";

import testCases, {fnMapSolid1, fnMapLiquid1} from "./testCases";
import {
  callGetBond,
  callGetBondGroup,
  createBondGroup,
  issueNewBondsCollateralizedErc20,
} from "../bondMaker/callFunction";
import {
  lineSegmentToFnMap,
  advanceTime,
  days,
  getBlockTimestampSec,
  mineOneBlock,
  fromBTAmount,
  fromE0Amount,
} from "../util";
import {init} from "../initCollateralizedErc20";
import type {Ierc20Contract} from "../../types/truffle-contracts";

const BondMaker = artifacts.require("EthBondMakerCollateralizedUsdc");
const BondToken = artifacts.require("BondTokenCollateralizedErc20");
const Usdc = artifacts.require("TestUsdc");

const feeRateE3 = 2; // 0.2%

const fnMaps = [
  lineSegmentToFnMap(fnMapSolid1),
  lineSegmentToFnMap(fnMapLiquid1),
];

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

  describe("reverseBondGroupToCollateral", () => {
    const cases = testCases.reverseBondGroupToCollateral;
    const periodSecBeforeMaturity = 3 * days;
    let newBondGroupID: string;

    beforeEach(async () => {
      const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
      await advanceTime(1 * days);
      await mineOneBlock();
      const now = await getBlockTimestampSec();
      const {bondGroupID} = await createBondGroup(
        bondMakerContract,
        fnMaps,
        now + periodSecBeforeMaturity
      );
      newBondGroupID = bondGroupID;
    });

    it("should remain no collateral token in the case that the total supply of bonds is zero", async () => {
      const SBTAmount = 0.1;
      const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);

      await issueNewBondsCollateralizedErc20(
        bondMakerContract,
        newBondGroupID,
        SBTAmount,
        {
          from: accounts[0],
        }
      );

      await bondMakerContract.reverseBondGroupToCollateral(
        newBondGroupID,
        fromBTAmount(SBTAmount)
      );

      const {bondIDs} = await callGetBondGroup(
        bondMakerContract,
        newBondGroupID
      );
      for (const bondID of bondIDs) {
        const {bondTokenAddress} = await callGetBond(bondMakerContract, bondID);
        const bondTokenContract = await BondToken.at(bondTokenAddress);
        const totalSupply = await bondTokenContract.totalSupply();
        assert.ok(
          totalSupply.toString() === "0",
          "the total supply of bonds is not zero"
        );
      }

      const usdcContract = await Usdc.at(usdcAddress);
      const collateralBalanceOfBondMaker = await usdcContract.balanceOf(
        bondMakerContract.address
      );

      assert.ok(
        new BigNumber(collateralBalanceOfBondMaker.toString()).lt(feeRateE3),
        "should remain no collateral token in the BondMaker contract"
      );
    });

    cases.forEach(
      ({errorMessage, mintSBTAmount, burnSBTAmount, expired}, caseIndex) => {
        it(`case ${caseIndex}`, async () => {
          const bondMakerContract = await BondMaker.at(
            contractAddresses.bondMaker
          );

          await issueNewBondsCollateralizedErc20(
            bondMakerContract,
            newBondGroupID,
            mintSBTAmount,
            {from: accounts[0]}
          );

          if (expired) {
            await advanceTime(periodSecBeforeMaturity);
            await mineOneBlock();
          }

          try {
            await bondMakerContract.reverseBondGroupToCollateral(
              newBondGroupID,
              fromBTAmount(burnSBTAmount)
            );
          } catch (err) {
            assert.equal(
              err.message,
              errorMessage,
              "fail to execute reverseBondGroupToCollateral"
            );
            return;
          }

          if (errorMessage !== "") {
            assert.fail(
              "did not fail `BondMaker.reverseBondGroupToCollateral` test"
            );
          }
        });
      }
    );
  });
});
