import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
export const getTrends = () => api.get('/analytics/trends').then(res => res.data)
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

export default api
