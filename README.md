# Network Visualization Tool

A D3.js-based tool for visualizing organizational networks including projects, companies, employees, and services.

## Usage of Services

Services represent external tools or platforms that are linked to projects. To add a service:

1. Add a new node with type "service" to the data.json
2. Include required fields: id, name, type, and links
3. In the links array, specify project IDs that use the service

Example:
```json
{
  "id": "s1",
  "name": "Google Cloud",
  "type": "service",
  "links": ["p1"]
}
```

## Visualization in Browser

To view the visualization:

1. Host the files using a local web server:
```bash
./service up
```

2. Open in browser:
- Navigate to `http://localhost`
- The graph will automatically render
- Drag nodes to reposition
- Hover over nodes to see details
- Zoom and pan to explore

## Data Structure

The data.json file contains the following structure:

```json
{
  "nodes": [
    {
      "id": "unique_identifier",
      "name": "display_name",
      "type": "node_type",
      "links": ["connected_node_ids"]
    }
  ],
  "config": {
    "version": "1.0",
    "types": {
      "project": {"size": 100, "color": "#4285F4"},
      "company": {"size": 70, "color": "#DB4437"},
      "service": {"size": 40, "color": "#F4B400"},
      "employee": {"size": 20, "color": "#0F9D58"}
    }
  }
}
```

Node types:
- project: Major initiatives or projects
- company: Organizations involved
- service: External tools or platforms
- employee: Individual team members

Links represent relationships between nodes.

## License

MIT License

Copyright (c) 2023

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.