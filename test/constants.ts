require("dotenv").config();

const {VERSION} = process.env;
console.log("VERSION:", VERSION);

const bondMakerConfigStaging = {
  maturityScale: 1,
};
const bondMakerConfigProduction = {
  maturityScale: 3600,
};
const {maturityScale} =
  VERSION === "staging" ? bondMakerConfigStaging : bondMakerConfigProduction;

export {maturityScale};
