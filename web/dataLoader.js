export async function loadLinks() {
  const response = await fetch("data.csv");
  const text = await response.text();
  return text.split("\n").map(line => {
    const [source, type, target] = line.split(",");
    return { source, type, target };
  });
}
