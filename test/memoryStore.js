function createMemoryStore() {
  const plots = new Map();
  const trees = new Map();
  const users = new Map();

  return {
    async initSchema() {},
    async listPlots() {
      return [...plots.values()];
    },
    async upsertPlot(plot) {
      const saved = { ...plot, boundary: plot.boundary || [] };
      plots.set(plot.id, saved);
      return saved;
    },
    async deletePlot(id) {
      plots.delete(id);
      for (const [treeId, tree] of trees) {
        if (tree.plotId === id) trees.delete(treeId);
      }
    },
    async listTrees() {
      return [...trees.values()];
    },
    async upsertTree(tree) {
      trees.set(tree.id, { ...tree });
      return { ...tree };
    },
    async deleteTree(id) {
      trees.delete(id);
    },
    async createUser(id, email, passwordHash) {
      const user = { id, email, passwordHash };
      users.set(id, user);
      return user;
    },
    async findUserByEmail(email) {
      return [...users.values()].find(u => u.email === email) || null;
    },
    async findUserById(id) {
      return users.get(id) || null;
    }
  };
}

module.exports = { createMemoryStore };
