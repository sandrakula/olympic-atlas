import { countryIso } from "./country-iso";

// IOC codes that differ from ISO 3166-1. AIN, EOR and TPE have their own
// Olympic identities. The country flag of Taiwan is not the delegation flag.
const olympicCountryCodes: Readonly<Record<string, string>> = {
  ALG: "DZA", ANG: "AGO", ANT: "ATG", ARU: "ABW", ASA: "ASM", BAH: "BHS",
  BAN: "BGD", BAR: "BRB", BER: "BMU", BHU: "BTN", BIZ: "BLZ", BOT: "BWA",
  BRU: "BRN", BUL: "BGR", BUR: "BFA", CAM: "KHM", CAY: "CYM", CGO: "COG",
  CHA: "TCD", CHI: "CHL", CRC: "CRI", CRO: "HRV", DEN: "DNK", ESA: "SLV",
  FIJ: "FJI", GAM: "GMB", GBS: "GNB", GEQ: "GNQ", GER: "DEU", GRE: "GRC",
  GRN: "GRD", GUA: "GTM", GUI: "GIN", HAI: "HTI", HON: "HND", INA: "IDN",
  IRI: "IRN", ISV: "VIR", IVB: "VGB", KOS: "XKS", KSA: "SAU", KUW: "KWT",
  LAT: "LVA", LBA: "LBY", LES: "LSO", MAD: "MDG", MAS: "MYS", MAW: "MWI",
  MGL: "MNG", MON: "MCO", MRI: "MUS", MTN: "MRT", MYA: "MMR", NCA: "NIC",
  NED: "NLD", NEP: "NPL", NGR: "NGA", NIG: "NER", OMA: "OMN", PAR: "PRY",
  PHI: "PHL", PLE: "PSE", POR: "PRT", PUR: "PRI", RSA: "ZAF", SAM: "WSM",
  SEY: "SYC", SKN: "KNA", SLO: "SVN", SOL: "SLB", SRI: "LKA", SUD: "SDN",
  SUI: "CHE", TAN: "TZA", TGA: "TON", TOG: "TGO", TPE: "TWN", UAE: "ARE",
  URU: "URY", VAN: "VUT", VIE: "VNM", VIN: "VCT", ZAM: "ZMB", ZIM: "ZWE",
};

export function parisCountryCode(noc: string) {
  // BRN is Bahrain in the IOC roster and Brunei in ISO 3166-1.
  const code = noc === "BRN" ? "BHR" : olympicCountryCodes[noc] ?? noc;
  return Object.hasOwn(countryIso, code) ? code : null;
}
