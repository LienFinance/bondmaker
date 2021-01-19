import {BondMakerCollateralizedEthContract} from "../types/truffle-contracts";
import {maturityScale} from "./constants";
import BigNumber from "bignumber.js";

const defaultInitRateETH2USD = 200;
const defaultInitVolatility = 0;

const Oracle = artifacts.require("TestOracle");
const LienToken = artifacts.require("TestLienToken");
const BondTokenName = artifacts.require("BondTokenName");
const BondTokenFactory = artifacts.require("BondTokenFactory");

async function init<T extends BondMakerCollateralizedEthContract>(
  BondMaker: null,
  _StableCoin: null,
  _Auction: null,
  _AuctionBoard: null,
  options?: {
    initRateETH2USD?: number;
    initVolatility?: number;
  }
): Promise<{
  oracle: string;
  lienToken: string;
  bondTokenName: string;
  bondTokenFactory: string;
}>;
async function init<T extends BondMakerCollateralizedEthContract>(
  BondMaker: T,
  _StableCoin: null,
  _Auction: null,
  _AuctionBoard: null,
  options?: {
    initRateETH2USD?: number;
    initVolatility?: number;
  }
): Promise<{
  oracle: string;
  lienToken: string;
  bondMaker: string;
}>;
async function init<T extends BondMakerCollateralizedEthContract>(
  BondMaker: T | null,
  _StableCoin: null,
  _Auction: null,
  _AuctionBoard: null,
  options?: {
    initRateETH2USD?: number;
    initVolatility?: number;
  }
) {
  const initRateETH2USD = new BigNumber(
    options?.initRateETH2USD ?? defaultInitRateETH2USD
  );
  const initVolatility = new BigNumber(
    options?.initVolatility ?? defaultInitVolatility
  );
  const oracleContract = await Oracle.new(
    initRateETH2USD.shiftedBy(8).toString(10),
    initVolatility.shiftedBy(8).toString(10)
  );
  const lienTokenContract = await LienToken.new();
  const bondTokenNameContract = await BondTokenName.deployed();
  const bondTokenFactoryContract = await BondTokenFactory.deployed();

  if (BondMaker === null) {
    return {
      oracle: oracleContract.address,
      lienToken: lienTokenContract.address,
      bondTokenName: bondTokenNameContract.address,
      bondTokenFactory: bondTokenFactoryContract.address,
    };
  }

  const bondMakerContract = await BondMaker.new(
    oracleContract.address,
    lienTokenContract.address,
    bondTokenNameContract.address,
    bondTokenFactoryContract.address,
    maturityScale
  );

  return {
    oracle: oracleContract.address,
    bondMaker: bondMakerContract.address,
    lienToken: lienTokenContract.address,
  };
}

// How to use
//
// const OracleContract = await Oracle.deployed();
// const BondMakerContract = await BondMaker.at(contractAddresses.bondMaker);
// const IDOLContract = await StableCoin.at(contractAddresses.idol);
// const auctionContract = await Auction.at(contractAddresses.auction);

export {init};
