export function loadLinks() {
  return d3.text("data.csv").then(raw => {
    const rows = d3.csvParseRows(raw); // each row: [source, target]
    return rows.map(([source, target]) => ({ source, target }));
  });
}
