function createMemoryStore() {
  const plots = new Map();
  const trees = new Map();
  const users = new Map();
  const communityEnterprises = new Map();
  const communityEnterpriseMembers = new Map(); // key: `${entityId}:${userId}`
  const purposes = new Map();

  return {
    async initSchema() {},
    async listPlots() {
      return [...plots.values()];
    },
    async upsertPlot(plot) {
      const existing = plots.get(plot.id);
      const createdBy = existing ? existing.createdBy : (plot.createdBy || null);
      const status = existing ? existing.status : (plot.status || 'data_entry');
      const reviewNote = existing ? existing.reviewNote : (plot.reviewNote || null);
      const reviewPhotos = existing ? existing.reviewPhotos : (plot.reviewPhotos || []);
      const saved = { ...plot, boundary: plot.boundary || [], refPoint: plot.refPoint || null, createdBy, status, reviewNote, reviewPhotos };
      plots.set(plot.id, saved);
      return saved;
    },
    async deletePlot(id) {
      plots.delete(id);
      for (const [treeId, tree] of trees) {
        if (tree.plotId === id) trees.delete(treeId);
      }
    },
    async findPlotById(id) {
      return plots.get(id) || null;
    },
    async updatePlotStatus(id, status, note, photos) {
      const plot = plots.get(id);
      if (!plot) return null;
      plot.status = status;
      plot.reviewNote = note || null;
      plot.reviewPhotos = photos || [];
      return plot;
    },
    async bumpPlotToTreeSurvey(id) {
      const plot = plots.get(id);
      if (plot && plot.status === 'data_entry') plot.status = 'tree_survey';
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
    async findTreeById(id) {
      return trees.get(id) || null;
    },
    async createUser(id, email, phone, passwordHash, extra) {
      extra = extra || {};
      const user = {
        id, email: email || null, phone: phone || null, passwordHash,
        name: extra.name || null, nationalId: extra.nationalId || null, dob: extra.dob || null,
        role: extra.role || 'admin', managedCommunityEnterpriseId: extra.managedCommunityEnterpriseId || null,
        createdAt: new Date().toISOString()
      };
      users.set(id, user);
      return user;
    },
    async updateUserRole(id, role, managedCommunityEnterpriseId) {
      const user = users.get(id);
      if(!user) return null;
      user.role = role;
      user.managedCommunityEnterpriseId = managedCommunityEnterpriseId || null;
      return user;
    },
    async updateUserProfile(id, { name, email, phone }) {
      const user = users.get(id);
      if (!user) return null;
      user.name = name || null;
      user.email = email || null;
      user.phone = phone || null;
      return user;
    },
    async updateUserPassword(id, passwordHash) {
      const user = users.get(id);
      if (!user) return null;
      user.passwordHash = passwordHash;
      return user;
    },
    async findUserByEmail(email) {
      return [...users.values()].find(u => u.email === email) || null;
    },
    async findUserByPhone(phone) {
      return [...users.values()].find(u => u.phone === phone) || null;
    },
    async findUserByNationalId(nationalId) {
      return [...users.values()].find(u => u.nationalId === nationalId) || null;
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
    },
    async listPurposes() {
      return [...purposes.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async upsertPurpose(purpose) {
      const saved = { id: purpose.id, name: purpose.name, createdAt: purposes.get(purpose.id)?.createdAt || new Date().toISOString() };
      purposes.set(purpose.id, saved);
      return saved;
    },
    async deletePurpose(id) {
      purposes.delete(id);
      for (const plot of plots.values()) {
        if (plot.purposeId === id) plot.purposeId = null;
      }
      for (const entity of communityEnterprises.values()) {
        if (entity.purposeId === id) entity.purposeId = null;
      }
    }
  };
}

module.exports = { createMemoryStore };
