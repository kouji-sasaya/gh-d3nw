# d3.js Visualization Tool

A d3.js based tool for visualizing organizational networks including projects, domain, user, and services.


## GitHub example web page

https://kouji-sasaya.github.io/gh-d3nw/

## Usage of Services

Services represent external tools or platforms that are linked to projects. To add a service:

1. Add a new node with type "service" to the data.json
2. Include required fields: id, name, type, and links
3. In the links array, specify project IDs that use the service

Example:
```json
[
  {"id": "P0001", "address": "", "name": "Project X","type": "service","links": []},
  {"id": "D0001", "address": "A domain",  "name": "A domain","type": "domain","links": ["P0001"]},
  {"id": "S0001", "address": "https://github.com", "name": "GitHub","type": "service","links": ["P0001", "D0001"]},
  {"id": "U0001", "address": "",  "name": "Cat Rock","type": "user","links": ["P0001", "D0001", "S0001"]},
  {"id": "U0002", "address": "",  "name": "Dog Jazz","type": "user","links": ["P0001", "D0001", "S0001"]}
]
```

## Visualization in Browser

To view the visualization:

1. Host the files using a local web server:
```bash
$ gh extension install kouji-sasaya/gh-d3nw
$ mkdir work
$ gh d3nw install
$ gh d3nw up
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
[
   {
      "id": "unique_identifier",
      "address": "Address(ex: e-mail address)",
      "name": "Display Name(ex: Your Name)",
      "type": "Node Type(ex: project|domain|group|service|team|user)",
      "links": ["Some node ids(ex: U0001)"]
    },
    {--Next Node--},
    {--Next Node--},
    {--Next Node--},
    {}
]
```

Node types:
- project: Major initiatives or projects
- domain: Organizations involved
- service: External tools or platforms
- user: Individual users

Links represent relationships between nodes.

```
{
  "config": {
    "version": "1.0",
    "types": {
      "project": { "size": 100, "color": "#1976D2" },
      "domain": { "size": 70, "color": "#C62828" },
      "group": { "size": 50, "color": "#7E57C2" },
      "service": { "size": 40, "color": "#FFB300" },
      "team": { "size": 60, "color": "#0097A7" },
      "user": { "size": 20, "color": "#388E3C" }
    }
  }
}
```

## License

MIT License

Copyright (c) 2025

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