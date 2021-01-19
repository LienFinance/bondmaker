import {BigNumber} from "bignumber.js";
import testCases from "./testCases";
import {
  getBlockTimestampSec,
  vmExceptionTemplate,
  days,
  getEthBalance,
  nullAddress,
} from "../util";
import {
  createSbtAndLbt,
  issueNewBondsCollateralizedErc20,
} from "../bondMaker/callFunction";
import {getBondBalance} from "../bondToken/callFunction";
import {init} from "../initCollateralizedErc20";
import {Ierc20Contract} from "../../types/truffle-contracts";

const Usdc = artifacts.require("TestUsdc");
const BondMaker = artifacts.require("EthBondMakerCollateralizedUsdc");
const BondToken = artifacts.require("BondTokenCollateralizedErc20");

contract("BondMaker", (accounts) => {
  let contractAddresses: {
    bondMaker: string;
    lienToken: string;
  };

  let usdcAddress: string;

  let testBondGroup: {
    bondGroupID: string;
    sbtAddress: string;
    lbtAddress: string;
  };

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

    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
    const now = await getBlockTimestampSec();
    const maturity = now + 4 * days;
    const solidStrikePrice = 100;
    const {bondGroupID, sbtAddress, lbtAddress} = await createSbtAndLbt(
      bondMakerContract,
      maturity,
      solidStrikePrice
    );
    testBondGroup = {bondGroupID, sbtAddress, lbtAddress};
  });

  describe("issueNewBonds", () => {
    const cases = testCases.issueNewBonds;

    cases.forEach(({success, underlyingAmount}, caseIndex) => {
      it(`case ${caseIndex}`, async () => {
        const {
          bondMaker: bondMakerAddress,
          lienToken: lienTokenAddress,
        } = contractAddresses;
        const bondMakerContract = await BondMaker.at(bondMakerAddress);
        const bondGroupID = testBondGroup.bondGroupID;
        const issuer = accounts[1];
        const sbtInstance = await BondToken.at(testBondGroup.sbtAddress);
        const lbtInstance = await BondToken.at(testBondGroup.lbtAddress);

        const beforeIssuerBalance = await getEthBalance(issuer);
        const beforeTotalDepositedEthAmount = await getEthBalance(
          bondMakerAddress
        );
        const beforeDividendEthAmount = await getEthBalance(lienTokenAddress);
        const beforeSbtBalance = await getBondBalance(sbtInstance, issuer);
        const beforeLbtBalance = await getBondBalance(lbtInstance, issuer);

        try {
          await issueNewBondsCollateralizedErc20(
            bondMakerContract,
            bondGroupID,
            underlyingAmount,
            {
              from: issuer,
              gasPrice: 0,
            }
          );
        } catch (err) {
          if (!success) {
            console.log("expected error:", err.message);
            return;
          }
          throw err;
        }

        if (!success) {
          assert.fail(`should fail to call issueNewBonds`);
        }

        const mintingBondAmount = new BigNumber(underlyingAmount);
        const dividendEthAmount = mintingBondAmount
          .times(2)
          .shiftedBy(-3)
          .dp(18); // 0.2%
        const paidEtherAmount = mintingBondAmount.plus(dividendEthAmount);

        const afterIssuerBalance = await getEthBalance(issuer);
        const issuerBalanceDiff = afterIssuerBalance.minus(beforeIssuerBalance);
        // assert.ok(
        //     issuerBalanceDiff.negated().eq(paidEtherAmount),
        //     'the issuer ether balance is invalid'
        // );

        const afterTotalDepositedEthAmount = await getEthBalance(
          bondMakerAddress
        );
        const totalDepositedEthAmountDiff = afterTotalDepositedEthAmount.minus(
          beforeTotalDepositedEthAmount
        );
        // assert.ok(
        //     totalDepositedEthAmountDiff.eq(mintingBondAmount),
        //     'the deposited ether amount is invalid'
        // );

        const afterDividendEthAmount = await getEthBalance(lienTokenAddress);
        const dividendEthAmountDiff = afterDividendEthAmount.minus(
          beforeDividendEthAmount
        );
        // assert.ok(
        //     dividendEthAmountDiff.eq(dividendEthAmount),
        //     'the dividend amount is invalid'
        // );

        const afterSbtBalance = await getBondBalance(sbtInstance, issuer);
        const sbtBalanceDiff = afterSbtBalance.minus(beforeSbtBalance);
        assert.ok(
          sbtBalanceDiff.eq(mintingBondAmount),
          "the SBT balance of issuer is invalid"
        );

        const afterLbtBalance = await getBondBalance(lbtInstance, issuer);
        const lbtBalanceDiff = afterLbtBalance.minus(beforeLbtBalance);
        assert.ok(
          lbtBalanceDiff.eq(mintingBondAmount),
          "the LBT balance of issuer is invalid"
        );
      });
    });
  });
});

contract("BondMaker", (accounts) => {
  let contractAddresses: {
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

    const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
    const now = await getBlockTimestampSec();
    const maturity = now + 4 * days;
    const solidStrikePrice = 100;
    await createSbtAndLbt(bondMakerContract, maturity, solidStrikePrice);
  });

  describe("issueNewBonds", () => {
    it("try to issue non-existent bonds", async () => {
      const bondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
      const rawBondGroupID = await bondMakerContract.nextBondGroupID();
      const bondGroupID = rawBondGroupID.toString(); // not registered
      const issuer = accounts[1];

      const mintingBondAmount = 1;
      try {
        await issueNewBondsCollateralizedErc20(
          bondMakerContract,
          bondGroupID,
          mintingBondAmount,
          {from: issuer}
        );
      } catch (err) {
        const expectedErrorMessages = [
          vmExceptionTemplate("the bond group does not exist"),
        ];
        assert.ok(
          expectedErrorMessages.includes(err.message),
          "fail to issueNewBonds"
        );
        console.log("expected error:", err.message);
        return;
      }

      assert.fail(`should fail to call issueNewBonds`);
    });
  });
});
