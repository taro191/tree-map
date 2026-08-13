async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch (e) { /* ignore non-JSON error bodies */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => request('/api/auth/me'),
  register: (email, phone, password) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, phone, password }) }),
  login: (identifier, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  listPlots: () => request('/api/plots'),
  savePlot: (plot) => request(`/api/plots/${encodeURIComponent(plot.id)}`, { method: 'PUT', body: JSON.stringify(plot) }),
  deletePlot: (id) => request(`/api/plots/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updatePlotStatus: (id, status, note, photos) => request(`/api/admin/plots/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status, note, photos }) }),

  listTrees: () => request('/api/trees'),
  saveTree: (tree) => request(`/api/trees/${encodeURIComponent(tree.id)}`, { method: 'PUT', body: JSON.stringify(tree) }),
  deleteTree: (id) => request(`/api/trees/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listUsers: () => request('/api/admin/users'),
  addUser: (email, phone, password, role, managedCommunityEnterpriseId) => request('/api/admin/users', { method: 'POST', body: JSON.stringify({ email, phone, password, role, managedCommunityEnterpriseId }) }),
  updateUserRole: (id, role, managedCommunityEnterpriseId) => request(`/api/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: JSON.stringify({ role, managedCommunityEnterpriseId }) }),
  updateUserProfile: (id, { name, email, phone }) => request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name, email, phone }) }),
  updateUserPassword: (id, password) => request(`/api/admin/users/${encodeURIComponent(id)}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),

  listCommunityEnterprises: () => request('/api/admin/community-enterprises'),
  saveCommunityEnterprise: (entity) => request(`/api/admin/community-enterprises/${encodeURIComponent(entity.id)}`, { method: 'PUT', body: JSON.stringify(entity) }),
  deleteCommunityEnterprise: (id) => request(`/api/admin/community-enterprises/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addCommunityEnterpriseMember: (entityId, userId) => request(`/api/admin/community-enterprises/${encodeURIComponent(entityId)}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
  removeCommunityEnterpriseMember: (entityId, userId) => request(`/api/admin/community-enterprises/${encodeURIComponent(entityId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })
};
