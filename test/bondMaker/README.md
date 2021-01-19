# BondMaker

## Test

```sh
pwd # /path/to/this-repository
yarn # if necessary
yarn start-ganache # if necessary
yarn test ./test/bondmaker/**/*.test.ts
```

## Specifications

### generateBondID

-   [x] Test to generate a bond ID.

-   [x] Ensure generated bond ID is the same with expected.

### registerBond

-   [x] Test to create a bond contract.

-   [x] Ensure the symbol of generated bond contract is the same with expected.

-   [x] Ensure the name of generated bond contract is the same with expected.

-   [x] Ensure the error message is the same with expected if fail to register bond group.

    -   polyline must not be empty array

    -   the maturity is too far

    -   the maturity has already expired

    -   the bond is 0-value at any ETH rate

### registerBondGroup

-   [x] Test to register a bond group.

-   [x] Ensure the error message is the same with expected if fail to register bond group.

    -   the maturity of the bonds must be same

    -   the bond group should consist of 2 or more bonds

    -   except the first bond must not be pure SBT

    -   the total price at any rateBreakPoints should be the same value as the rate

    -   the maturity has already expired

-   [x] Ensure SBT ID is NOT the zero address.

-   [x] Ensure LBT ID is NOT the zero address.

### issueBonds

-   [x] Test to exchange ETH to a pair of bonds before maturity.

-   [x] Ensure the issuer paid the valid ether amount to issue bonds.

-   [x] Ensure the bond token balance of issuer is valid.

-   [x] Ensure the dividend ether amount is valid.

-   [x] Ensure the error message is the same with expected if fail to exchange.

    -   the maturity has already expired

### exchangeEquivalentBonds

-   [ ] Test to exchange bonds to another bonds.

-   [ ] Ensure the error message is the same with expected if fail to exchange.

    -   the maturity has already expired

### reverseBondToETH

-   [ ] Test to exchange a pair of bonds to ETH before maturity.

-   [ ] Ensure the error message is the same with expected if fail to exchange.

    -   the maturity has already expired

### liquidateBondGroup

-   [x] Test to issue bonds, lock SBT, unlock SBT, liquidate a bond group.

-   [x] Ensure liquidateBond() works well when the hint round ID is zero.

-   [x] Ensure liquidateBond() also works well when the hint round ID is more than the latest round ID.

-   [x] Ensure the error message is the same with expected if fail to liquidate a bond.

    -   the bond has not expired yet
