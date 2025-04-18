class GraphStore {
  constructor() {
    this.nodes = [];
    this.links = [];
    this.filters = new Set(['project', 'domain', 'service', 'employee']);
  }

  setData(nodes, links) {
    this.nodes = nodes;
    this.links = links;
  }

  getVisibleNodes() {
    return this.nodes.filter(node => this.filters.has(node.type));
  }

  getVisibleLinks() {
    return this.links.filter(link => {
      const sourceNode = this.nodes.find(n => n.id === link.source);
      const targetNode = this.nodes.find(n => n.id === link.target);
      return sourceNode && targetNode && 
             this.filters.has(sourceNode.type) && 
             this.filters.has(targetNode.type);
    });
  }

  toggleFilter(type) {
    if (this.filters.has(type)) {
      this.filters.delete(type);
    } else {
      this.filters.add(type);
    }
  }
}

export const graphStore = new GraphStore();
