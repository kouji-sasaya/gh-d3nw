class DataService {
  constructor() {
    this.data = null;
  }

  async init() {
    const response = await fetch("data.json");
    this.data = await response.json();
  }

  getNodes() {
    return this.data.data.map(d => ({
      id: d.id,
      name: d.nickname,
      type: d.type,
      groupId: this._getGroupId(d)
    }));
  }

  getLinks() {
    const links = [];
    this.data.data.forEach(d => {
      if (d.projects) {
        d.projects.forEach(projectId => {
          links.push({
            source: d.id,
            target: projectId,
            type: 'project'
          });
        });
      }
      if (d.company) {
        links.push({
          source: d.id,
          target: d.company,
          type: 'company'
        });
      }
      if (d.services) {
        d.services.forEach(serviceId => {
          links.push({
            source: d.id,
            target: serviceId,
            type: 'service'
          });
        });
      }
    });
    return links;
  }

  getNodesByType(type) {
    return this.data.data.filter(d => d.type === type);
  }

  _getGroupId(node) {
    const groupMap = {
      'project': 1,
      'company': 2,
      'service': 3,
      'employee': 4
    };
    return groupMap[node.type] || 0;
  }
}

export const dataService = new DataService();
