import {omitUndefinedValue} from "../util";
import {testExchangeVsErc20} from "./exchangeVsErc20";
import {testExchangeVsEth} from "./exchangeVsEth";
import {testExchangeVsBond} from "./exchangeVsBond";
import testCases from "./testCases";

contract("OnlyBondVsErc20Exchange", (accounts) => {
  describe("exchangeVsErc20", () => {
    testCases.exchange.forEach(
      (
        {
          errorMessage,
          initRateETH2USD,
          initVolatility,
          periodSecBeforeMaturity: untilMaturity,
          strikePrice,
          erc20PriceE0,
          isPutOption,
          spread: feeBaseE0,
          decimal: decimalsOfErc20,
          exchangeTimeUntilMaturity,
          callOptionApproximation: expectedCallOptionPrice,
          callOptionApproximationAccuracy: callOptionAccuracy,
          ...rest
        },
        caseIndex
      ) => {
        const testTitle = `(case ${caseIndex})`;
        it(testTitle, async () => {
          const caseValue = {
            ...rest,
            errorMessage,
            initRateETH2USD,
            initVolatility,
            untilMaturity,
            strikePrice,
            fnMaps: rest["fnMaps"] as string[],
            targetBondIndex: rest["targetBondIndex"] as number,
            erc20PriceE0: initRateETH2USD,
            decimalsOfErc20,
            isPutOption,
            feeBaseE0,
            callOptionAccuracy,
            expectedCallOptionPrice,
            exchangeTimeUntilMaturity,
          };
          await testExchangeVsErc20(accounts, omitUndefinedValue(caseValue));
        });
      }
    );
  });
});

contract("OnlyBondVsEthExchange", (accounts) => {
  describe("exchangeVsEth", () => {
    testCases.exchange.forEach(
      (
        {
          errorMessage,
          initRateETH2USD,
          initVolatility,
          periodSecBeforeMaturity: untilMaturity,
          strikePrice,
          erc20PriceE0,
          isPutOption,
          spread: feeBaseE0,
          decimal: decimalsOfErc20,
          exchangeTimeUntilMaturity,
          callOptionApproximation: expectedCallOptionPrice,
          callOptionApproximationAccuracy: callOptionAccuracy,
          ...rest
        },
        caseIndex
      ) => {
        const testTitle = `(case ${caseIndex})`;
        it(testTitle, async () => {
          const caseValue = {
            ...rest,
            errorMessage,
            initRateETH2USD,
            initVolatility,
            untilMaturity,
            strikePrice,
            fnMaps: rest["fnMaps"] as string[],
            targetBondIndex: rest["targetBondIndex"] as number,
            erc20PriceE0,
            decimalsOfErc20,
            isPutOption,
            feeBaseE0,
            callOptionAccuracy,
            expectedCallOptionPrice,
            exchangeTimeUntilMaturity,
          };
          await testExchangeVsEth(accounts, omitUndefinedValue(caseValue));
        });
      }
    );
  });
});

contract("OnlyBondVsBondExchange", (accounts) => {
  describe("exchangeVsBond", () => {
    testCases.exchange.forEach(
      (
        {
          errorMessage,
          initRateETH2USD,
          initVolatility,
          periodSecBeforeMaturity: untilMaturity,
          strikePrice,
          erc20PriceE0,
          isPutOption,
          spread: feeBaseE0,
          decimal: decimalsOfErc20,
          exchangeTimeUntilMaturity,
          callOptionApproximation: expectedCallOptionPrice,
          callOptionApproximationAccuracy: callOptionAccuracy,
          ...rest
        },
        caseIndex
      ) => {
        const testTitle = `(case ${caseIndex})`;
        it(testTitle, async () => {
          const caseValue = {
            ...rest,
            errorMessage,
            initRateETH2USD,
            initVolatility,
            untilMaturity,
            strikePrice,
            fnMaps: rest["fnMaps"] as string[],
            targetBondIndex: rest["targetBondIndex"] as number,
            erc20PriceE0,
            decimalsOfErc20,
            isPutOption,
            feeBaseE0,
            callOptionAccuracy,
            expectedCallOptionPrice,
            exchangeTimeUntilMaturity,
          };
          await testExchangeVsBond(accounts, omitUndefinedValue(caseValue));
        });
      }
    );
  });
});
