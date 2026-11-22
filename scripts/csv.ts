export function readCsv(text: string, delimiter = ","): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const pushField = () => {
    row.push(value);
    value = "";
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index++;
    } else if (char === '"' && (quoted || value === "")) {
      quoted = !quoted;
    } else if (quoted) {
      value += char;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      pushRow();
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field");
  pushRow();
  const [header, ...body] = rows;
  if (!header || new Set(header).size !== header.length) throw new Error("Missing or duplicate CSV columns");
  return body.map((cells, index) => {
    if (cells.length !== header.length) throw new Error(`Malformed CSV record ${index + 2}`);
    return Object.fromEntries(header.map((name, column) => [name, cells[column]]));
  });
}
