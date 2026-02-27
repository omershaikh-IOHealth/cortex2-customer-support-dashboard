import axios from 'axios'

const api = axios.create({
  baseURL: `/api`,
  timeout: 10000,
})

// Metrics
export const getOverviewMetrics = () => api.get('/metrics/overview').then(res => res.data)

// Tickets
export const getTickets = (params = {}) => api.get('/tickets', { params }).then(res => res.data)
export const getTicket = (id) => api.get(`/tickets/${id}`).then(res => res.data)

// SLA
export const getCriticalSLA = () => api.get('/sla/critical').then(res => res.data)

// Escalations
export const getEscalations = () => api.get('/escalations').then(res => res.data)

// Logs
export const getLogs = (limit = 100) => api.get('/logs', { params: { limit } }).then(res => res.data)

// Analytics
export const getTrends = (params = {}) => api.get('/analytics/trends', { params }).then(res => res.data)
export const getAllSolutions = () => api.get('/admin/solutions').then(res => res.data)
export const getPriorityDistribution = () => api.get('/analytics/priority-distribution').then(res => res.data)

// Config
export const getSLAConfig = () => api.get('/config/sla').then(res => res.data)
export const getEscalationConfig = () => api.get('/config/escalation').then(res => res.data)

// Health
export const getHealth = () => api.get('/health').then(res => res.data)

// ============= ADMIN APIs =============

// Companies
export const getAdminCompanies = () => api.get('/admin/companies').then(res => res.data)
export const getAdminCompany = (id) => api.get(`/admin/companies/${id}`).then(res => res.data)
export const createCompany = (data) => api.post('/admin/companies', data).then(res => res.data)
export const updateCompany = (id, data) => api.put(`/admin/companies/${id}`, data).then(res => res.data)
export const deleteCompany = (id) => api.delete(`/admin/companies/${id}`).then(res => res.data)

// POCs
export const getPOCs = (company_id) => api.get('/admin/pocs', { params: { company_id } }).then(res => res.data)
export const createPOC = (data) => api.post('/admin/pocs', data).then(res => res.data)
export const updatePOC = (id, data) => api.put(`/admin/pocs/${id}`, data).then(res => res.data)
export const deletePOC = (id) => api.delete(`/admin/pocs/${id}`).then(res => res.data)

// Solutions
export const getSolutions = (company_id) => api.get('/admin/solutions', { params: { company_id } }).then(res => res.data)
export const createSolution = (data) => api.post('/admin/solutions', data).then(res => res.data)
export const updateSolution = (id, data) => api.put(`/admin/solutions/${id}`, data).then(res => res.data)
export const deleteSolution = (id) => api.delete(`/admin/solutions/${id}`).then(res => res.data)

// SLA Configs
export const getSLAConfigs = (solution_id) => api.get('/admin/sla-configs', { params: { solution_id } }).then(res => res.data)
export const createSLAConfig = (data) => api.post('/admin/sla-configs', data).then(res => res.data)
export const updateSLAConfig = (id, data) => api.put(`/admin/sla-configs/${id}`, data).then(res => res.data)
export const deleteSLAConfig = (id) => api.delete(`/admin/sla-configs/${id}`).then(res => res.data)

// Escalation Configs
export const getEscalationConfigs = (solution_id) => api.get('/admin/escalation-configs', { params: { solution_id } }).then(res => res.data)
export const createEscalationConfig = (data) => api.post('/admin/escalation-configs', data).then(res => res.data)
export const updateEscalationConfig = (id, data) => api.put(`/admin/escalation-configs/${id}`, data).then(res => res.data)
export const deleteEscalationConfig = (id) => api.delete(`/admin/escalation-configs/${id}`).then(res => res.data)

// Assignees
export const getAssignees = (solution_id) => api.get('/admin/assignees', { params: { solution_id } }).then(res => res.data)
export const createAssignee = (data) => api.post('/admin/assignees', data).then(res => res.data)
export const updateAssignee = (id, data) => api.put(`/admin/assignees/${id}`, data).then(res => res.data)
export const deleteAssignee = (id) => api.delete(`/admin/assignees/${id}`).then(res => res.data)

// Modules
export const getModules = (solution_id) => api.get('/admin/modules', { params: { solution_id } }).then(res => res.data)
export const createModule = (data) => api.post('/admin/modules', data).then(res => res.data)
export const updateModule = (id, data) => api.put(`/admin/modules/${id}`, data).then(res => res.data)
export const deleteModule = (id) => api.delete(`/admin/modules/${id}`).then(res => res.data)

// Request Types
export const getRequestTypes = (solution_id) => api.get('/admin/request-types', { params: { solution_id } }).then(res => res.data)
export const createRequestType = (data) => api.post('/admin/request-types', data).then(res => res.data)
export const updateRequestType = (id, data) => api.put(`/admin/request-types/${id}`, data).then(res => res.data)
export const deleteRequestType = (id) => api.delete(`/admin/request-types/${id}`).then(res => res.data)

// Case Types
export const getCaseTypes = (solution_id, request_type_id) => api.get('/admin/case-types', { params: { solution_id, request_type_id } }).then(res => res.data)
export const createCaseType = (data) => api.post('/admin/case-types', data).then(res => res.data)
export const updateCaseType = (id, data) => api.put(`/admin/case-types/${id}`, data).then(res => res.data)
export const deleteCaseType = (id) => api.delete(`/admin/case-types/${id}`).then(res => res.data)

// KPIs
export const getKPIs = (solution_id) => api.get('/admin/kpis', { params: { solution_id } }).then(res => res.data)
export const createKPI = (data) => api.post('/admin/kpis', data).then(res => res.data)
export const updateKPI = (id, data) => api.put(`/admin/kpis/${id}`, data).then(res => res.data)
export const deleteKPI = (id) => api.delete(`/admin/kpis/${id}`).then(res => res.data)

// ============= NEW FEATURE APIs =============

// Similar resolved tickets
export const getSimilarTickets = (id) => api.get(`/tickets/${id}/similar`).then(res => res.data)

// Internal notes
export const addTicketNote = (id, data) => api.post(`/tickets/${id}/notes`, data).then(res => res.data)

// Soft hold (SLA pause/resume)
export const holdTicket = (id, action = 'pause') => api.post(`/tickets/${id}/hold`, { action }).then(res => res.data)

// QA sampling
export const getQASample = (params) => api.get('/qa/sample', { params }).then(res => res.data)

// Force Sync
export const triggerSync = () => api.post('/admin/sync').then(res => res.data)

// ============= NEW: Auth & Users =============
export const getMe = () => api.get('/users/me').then(res => res.data)
export const getUsers = () => api.get('/users').then(res => res.data)
export const createUser = (data) => api.post('/users', data).then(res => res.data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data).then(res => res.data)
export const deactivateUser = (id) => api.delete(`/users/${id}`).then(res => res.data)

// ============= NEW: Calls =============
export const getCalls = (params = {}) => api.get('/calls', { params }).then(res => res.data)
export const logCall = (data) => api.post('/calls', data).then(res => res.data)

// ============= NEW: Circulars =============
export const getCirculars = (params = {}) => api.get('/circulars', { params }).then(res => res.data)
export const createCircular = (data) => api.post('/circulars', data).then(res => res.data)

// ============= NEW: Rota =============
export const getMyShift = () => api.get('/rota/me').then(res => res.data)
export const getRotas = (params = {}) => api.get('/rota', { params }).then(res => res.data)
export const createRota = (data) => api.post('/rota', data).then(res => res.data)
export const updateRota = (id, data) => api.put(`/rota/${id}`, data).then(res => res.data)
export const deleteRota = (id) => api.delete(`/rota/${id}`).then(res => res.data)

// ============= NEW: Notifications =============
export const getNotifications = () => api.get('/notifications').then(res => res.data)
export const markNotificationRead = (id) => api.put(`/notifications/${id}`, { is_read: true }).then(res => res.data)
export const markAllNotificationsRead = () => api.post('/notifications/mark-all-read').then(res => res.data)

// ============= NEW: AI Companion =============
export const sendCompanionMessage = (message) => api.post('/companion/chat', { message }).then(res => res.data)
export const getCompanionHistory = () => api.get('/companion/history').then(res => res.data)
export const clearCompanionHistory = () => api.post('/companion/clear').then(res => res.data)

// ============= NEW: Tickets (create + update) =============
export const createTicket = (data) => api.post('/tickets', data).then(res => res.data)
export const updateTicket = (id, data) => api.put(`/tickets/${id}`, data).then(res => res.data)

export default api
