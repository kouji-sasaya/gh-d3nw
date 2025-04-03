export async function loadLinks() {
  const response = await fetch("data.json");
  const json = await response.json();
  return json.links; // Assume the JSON structure contains a "links" array
}
