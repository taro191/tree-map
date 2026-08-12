function createMemoryStore() {
  const plots = new Map();
  const trees = new Map();
  const users = new Map();
  const communityEnterprises = new Map();
  const communityEnterpriseMembers = new Map(); // key: `${entityId}:${userId}`

  return {
    async initSchema() {},
    async listPlots() {
      return [...plots.values()];
    },
    async upsertPlot(plot) {
      const saved = { ...plot, boundary: plot.boundary || [], refPoint: plot.refPoint || null };
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
    async createUser(id, email, phone, passwordHash) {
      const user = { id, email: email || null, phone: phone || null, passwordHash, createdAt: new Date().toISOString() };
      users.set(id, user);
      return user;
    },
    async findUserByEmail(email) {
      return [...users.values()].find(u => u.email === email) || null;
    },
    async findUserByPhone(phone) {
      return [...users.values()].find(u => u.phone === phone) || null;
    },
    async findUserById(id) {
      return users.get(id) || null;
    },
    async listUsers() {
      return [...users.values()];
    },
    async listCommunityEnterprises() {
      return [...communityEnterprises.values()];
    },
    async upsertCommunityEnterprise(entity) {
      const saved = { ...entity };
      communityEnterprises.set(entity.id, saved);
      return saved;
    },
    async deleteCommunityEnterprise(id) {
      communityEnterprises.delete(id);
      for (const key of communityEnterpriseMembers.keys()) {
        if (key.startsWith(`${id}:`)) communityEnterpriseMembers.delete(key);
      }
      for (const plot of plots.values()) {
        if (plot.communityEnterpriseId === id) plot.communityEnterpriseId = null;
      }
    },
    async countCommunityEnterpriseMembers(id) {
      let count = 0;
      for (const key of communityEnterpriseMembers.keys()) {
        if (key.startsWith(`${id}:`)) count++;
      }
      return count;
    },
    async listCommunityEnterpriseMembers(id) {
      const memberUserIds = [...communityEnterpriseMembers.values()]
        .filter(m => m.communityEnterpriseId === id)
        .map(m => m.userId);
      return memberUserIds.map(userId => users.get(userId)).filter(Boolean);
    },
    async addCommunityEnterpriseMember(entityId, userId) {
      communityEnterpriseMembers.set(`${entityId}:${userId}`, { communityEnterpriseId: entityId, userId });
    },
    async removeCommunityEnterpriseMember(entityId, userId) {
      communityEnterpriseMembers.delete(`${entityId}:${userId}`);
    }
  };
}

module.exports = { createMemoryStore };
