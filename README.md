
# Overview
This repository has 3 components.
1) [BondToken](#BondToken)
2) [Generalized Decentralized OTC](#GDOTC)
3) [Bondshape detection and Pricing function](#Pricer)

<a id="BondToken"></a>

# 1. Bond Token

## What is Bond Token?

-   ETH/ERC20-backed structured bond, which returns ETH/ERC20 on the pre-specified maturity based on the price from the oracle and the strike price determined in the contract.
-   The cashflow of the structured bond is represented by the piecewise linear function, which is a generalized definition of the strike price.
ex)
<dl>
<dt>SBT, Strike Price: 100USD</dt>
<dd>(x,y)= (0,0) (100,100) (200,100)</dd>
<dt>Normal LBT, Strike price: 100USD</dt>
<dd>(x,y)= (0,0) (100,0) (200,100)</dd>
</dl>

-   For the right outside the definition area, the rightmost line is extended to infinity.
    (To be precise, in order to reduce gas cost, the data is held as the value of slope in each domain on the piecewise linear function.)

<dl>
<dt>bondID</dt>
<dd>It will be determined by the maturity and the piecewise linear function. If both of them are the same, ID is the same.</dd>
<dt>bondGroup</dt>
<dd>BondGroup is a group of bondIDs that can reproduce original ETH/ERC20 cashflow. Technically, it is verified by checking the sum of y axis values at each x axis point on the piecewise linear function equals to x axis value at each point.</dd>
</dl>

### BondToken implementation

![Explanation_bm_bt](https://user-images.githubusercontent.com/64392013/82320286-fbebac00-9a0d-11ea-8a69-3fc748a319bc.png)
![Explanation_bm_bt (1)](https://user-images.githubusercontent.com/64392013/82320296-fee69c80-9a0d-11ea-817a-a373b723fb8e.png)
![Explanation_bm_bt (2)](https://user-images.githubusercontent.com/64392013/82320302-00b06000-9a0e-11ea-9890-ba73f889bfb6.png)

#### life-cycle of LBT

![lienarch (1)](https://user-images.githubusercontent.com/59379661/86872461-5dc7b880-c117-11ea-857f-cc767533e2d0.png)

## Changes from last audit
1) Fix bugs which occurred when a malicious user creates empty an bondgroup and runs ```reverseBondToETH()```, they can withdraw all ETH deposited to bondMaker. [More info]()
2) Add ERC20 BondMaker that enables tranching ERC20-token cashflow. User can create put options by tranching stablecoins like USDC.

## Contracts related to BondToken

-   contracts/BondMaker.sol => This contract issues bond tokens from deposited ETH/ERC20.
-   contracts/bondTokenName/BondTokenName.sol => This contract generate a bond token name from the bond properties.

<a id="GDOTC"></a>

# 2. Generalized Decentralized OTC(GDOTC)

## What is Generalized Decentralized OTC?
- Exchange for buy/sell BondTokens. The price is determined by ```(BondToken Theoretical price) * (1 + spread rate)``` (Liquidity Provider can customize own spread rate)
- Previous Decentralized OTC can deal with only Pure ETH call Option, but GDOTC can handle many shapes of Bonds collateralized by ETH or ERC20 token.
- Previous Decentralized OTC can exchange BondToken with only ERC20 like USDC, but we added BondToken vs BondToken pool and BondToken vs ETH pool.

### Advantages of Generalized Decentralized OTC
1. Low gas cost
    When exchange tokens, tokens are transferred from LP to user directly and there is no state writing. This contract processes only price calculation and token transfer.
2. No slippage depends on the depth of the liquidity
    User can exchange BondToken at theoretical price (+ spread) calculated by Pricing contract.
3. Fund efficiency
    In AMM, most of token depositted by LP are not used for exchange, but GDOTC can use liquidity more efficiently.

## Workflow of Generalized Decentralized OTC
![GDOTC](https://user-images.githubusercontent.com/64392013/99189508-68dfc480-2759-11eb-9707-f9137062714f.png)

### requirement (important)
ERC20 which will be exchanged to LBT needs to be built with openzeppelin ERC20 code.
https://docs.openzeppelin.com/contracts/3.x/api/token/erc20

<a id="Pricer"></a>

# 3. Bondshape detection and Pricing function

## How they work?
- Bondshape Detection Contract classifies bonds in 5 types of bond, Pure SBT, SBT Shape, LBT Shape, Triangle and None. If None, Pricing contract gives up pricing and reverts transaction.
- Pricing contract calculates bonds price by combination of pure call option.

## 4 types of bond shape
![Shape1](https://user-images.githubusercontent.com/64392013/99189515-6ed5a580-2759-11eb-85c8-f500016da5b9.png)
![Shape2](https://user-images.githubusercontent.com/64392013/99189520-7137ff80-2759-11eb-8465-6922a18cf764.png)

## Pricing bonds
![Pricing1](https://user-images.githubusercontent.com/64392013/99189510-6b421e80-2759-11eb-91b8-5e0d6d38767f.png)
![Pricing2](https://user-images.githubusercontent.com/64392013/99189513-6d0be200-2759-11eb-93ce-e779501d8d0c.png)

## Test

```sh
yarn
yarn start-ganache
yarn test
```
