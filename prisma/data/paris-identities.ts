// Reviewed crosswalk from the original Wikidata profiles to Paris roster IDs.
// Matches use P5815 and/or a name plus full date of birth. The homonym Calvin
// Davis is deliberately absent. The date conflict for Gestin was checked at FFCK.
export const parisWikidataIds: Readonly<Record<string, string>> = {
  "1878375": "Q100138179",
  "1892111": "Q100708264",
  "1904377": "Q100775088",
  "1543029": "Q101076669",
  "1911067": "Q101096559",
  "1901335": "Q102228055",
  "1544220": "Q102347211",
  "1892794": "Q102351723",
  "1959294": "Q102419847",
  "1958377": "Q10298743",
  "1972358": "Q103292885",
  "1953634": "Q10357885",
  "1972360": "Q104025822",
  "1972356": "Q104029060",
  "1568169": "Q104172788",
  "1900855": "Q104413873",
  "1880479": "Q104470593",
  "1948084": "Q104589978",
  "1903299": "Q104717460",
  "1895237": "Q104840470",
  "1562390": "Q105106861",
  "1965087": "Q105201345",
  "1965086": "Q105201948",
  "1571562": "Q105457219",
  "1571577": "Q10566641",
  "1925351": "Q105780700",
  "1920246": "Q105810327",
  "1977672": "Q105852598",
  "1960977": "Q105940475",
  "1538294": "Q105988689",
};

export const gestinBirthDate = {
  olympicsId: "1880479",
  source: "https://www.ffck.org/wp-content/uploads/2024/09/GESTIN-NICOLAS.pdf",
  date: "2000-03-14",
  prior: "2000-03-30",
};
