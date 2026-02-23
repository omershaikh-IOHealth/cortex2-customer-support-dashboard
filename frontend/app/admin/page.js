'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAdminCompanies,
  getPOCs,
  getSolutions,
  getSLAConfigs,
  getEscalationConfigs,
  getAssignees,
  getModules,
  getRequestTypes,
  getCaseTypes,
  getKPIs,
  createCompany,
  updateCompany,
  deleteCompany,
  createPOC,
  updatePOC,
  deletePOC,
  createSolution,
  updateSolution,
  deleteSolution,
  createSLAConfig,
  updateSLAConfig,
  deleteSLAConfig,
  createEscalationConfig,
  updateEscalationConfig,
  deleteEscalationConfig,
  createAssignee,
  updateAssignee,
  deleteAssignee,
  createModule,
  updateModule,
  deleteModule,
  createRequestType,
  updateRequestType,
  deleteRequestType,
  createCaseType,
  updateCaseType,
  deleteCaseType,
  createKPI,
  updateKPI,
  deleteKPI
} from '@/lib/api'
import Modal from '@/components/ui/Modal'
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Building2,
  Users,
  Package,
  Clock,
  AlertTriangle,
  UserCircle,
  Grid3x3,
  FileText,
  BarChart3
} from 'lucide-react'

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [expandedCompanies, setExpandedCompanies] = useState({})
  const [expandedSolutions, setExpandedSolutions] = useState({})
  const [expandedRequestTypes, setExpandedRequestTypes] = useState({})
  const [modals, setModals] = useState({
    company: { isOpen: false, data: null },
    poc: { isOpen: false, data: null, company_id: null },
    solution: { isOpen: false, data: null, company_id: null },
    sla: { isOpen: false, data: null, solution_id: null },
    escalation: { isOpen: false, data: null, solution_id: null },
    assignee: { isOpen: false, data: null, solution_id: null },
    module: { isOpen: false, data: null, solution_id: null },
    requestType: { isOpen: false, data: null, solution_id: null },
    caseType: { isOpen: false, data: null, solution_id: null, request_type_id: null },
    kpi: { isOpen: false, data: null, solution_id: null }
  })

  // Toast notification
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch companies
  const { data: companies, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: getAdminCompanies
  })

  const openModal = (type, data = null, extraParams = {}) => {
    setModals(prev => ({
      ...prev,
      [type]: { isOpen: true, data, ...extraParams }
    }))
  }

  const closeModal = (type) => {
    setModals(prev => ({
      ...prev,
      [type]: { ...prev[type], isOpen: false, data: null }
    }))
  }

  const toggleCompany = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }))
  }

  const toggleSolution = (solutionId) => {
    setExpandedSolutions(prev => ({
      ...prev,
      [solutionId]: !prev[solutionId]
    }))
  }

  const toggleRequestType = (requestTypeId) => {
    setExpandedRequestTypes(prev => ({
      ...prev,
      [requestTypeId]: !prev[requestTypeId]
    }))
  }

  const handleSave = async (type, data, mutation) => {
    try {
      await mutation(data)
      queryClient.invalidateQueries()
      closeModal(type)
      const label = type.replace(/([A-Z])/g, ' $1').trim()
      showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} saved successfully`)
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-bold mb-2">Admin Configuration</h1>
          <p className="text-cortex-muted">Manage companies, solutions, and system configurations</p>
        </div>
        <button
          onClick={() => openModal('company')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      {/* Companies List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-cortex-surface animate-pulse rounded-lg"></div>
          ))}
        </div>
      ) : companies && companies.length > 0 ? (
        <div className="space-y-4">
          {companies.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              isExpanded={expandedCompanies[company.id]}
              onToggle={() => toggleCompany(company.id)}
              onEdit={() => openModal('company', company)}
              onDelete={() => {
                if (confirm(`Delete company "${company.company_name}"?`)) {
                  deleteCompany(company.id).then(() => {
                    queryClient.invalidateQueries(['admin-companies'])
                  })
                }
              }}
              onAddPOC={() => openModal('poc', null, { company_id: company.id })}
              onAddSolution={() => openModal('solution', null, { company_id: company.id })}
              expandedSolutions={expandedSolutions}
              expandedRequestTypes={expandedRequestTypes}
              toggleSolution={toggleSolution}
              toggleRequestType={toggleRequestType}
              openModal={openModal}
              queryClient={queryClient}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-cortex-muted opacity-50" />
          <p className="text-cortex-muted">No companies found. Add your first company to get started.</p>
        </div>
      )}

      {/* Modals */}
      <CompanyModal
        isOpen={modals.company.isOpen}
        onClose={() => closeModal('company')}
        data={modals.company.data}
        onSave={(data) => handleSave('company', data, data.id ? (d) => updateCompany(d.id, d) : createCompany)}
      />

      <POCModal
        isOpen={modals.poc.isOpen}
        onClose={() => closeModal('poc')}
        data={modals.poc.data}
        company_id={modals.poc.company_id}
        onSave={(data) => handleSave('poc', data, data.id ? (d) => updatePOC(d.id, d) : createPOC)}
      />

      <SolutionModal
        isOpen={modals.solution.isOpen}
        onClose={() => closeModal('solution')}
        data={modals.solution.data}
        company_id={modals.solution.company_id}
        onSave={(data) => handleSave('solution', data, data.id ? (d) => updateSolution(d.id, d) : createSolution)}
      />

      <SLAConfigModal
        isOpen={modals.sla.isOpen}
        onClose={() => closeModal('sla')}
        data={modals.sla.data}
        solution_id={modals.sla.solution_id}
        onSave={(data) => handleSave('sla', data, data.id ? (d) => updateSLAConfig(d.id, d) : createSLAConfig)}
      />

      <EscalationConfigModal
        isOpen={modals.escalation.isOpen}
        onClose={() => closeModal('escalation')}
        data={modals.escalation.data}
        solution_id={modals.escalation.solution_id}
        onSave={(data) => handleSave('escalation', data, data.id ? (d) => updateEscalationConfig(d.id, d) : createEscalationConfig)}
      />

      <AssigneeModal
        isOpen={modals.assignee.isOpen}
        onClose={() => closeModal('assignee')}
        data={modals.assignee.data}
        solution_id={modals.assignee.solution_id}
        onSave={(data) => handleSave('assignee', data, data.id ? (d) => updateAssignee(d.id, d) : createAssignee)}
      />

      <ModuleModal
        isOpen={modals.module.isOpen}
        onClose={() => closeModal('module')}
        data={modals.module.data}
        solution_id={modals.module.solution_id}
        onSave={(data) => handleSave('module', data, data.id ? (d) => updateModule(d.id, d) : createModule)}
      />

      <RequestTypeModal
        isOpen={modals.requestType.isOpen}
        onClose={() => closeModal('requestType')}
        data={modals.requestType.data}
        solution_id={modals.requestType.solution_id}
        onSave={(data) => handleSave('requestType', data, data.id ? (d) => updateRequestType(d.id, d) : createRequestType)}
      />

      <CaseTypeModal
        isOpen={modals.caseType.isOpen}
        onClose={() => closeModal('caseType')}
        data={modals.caseType.data}
        solution_id={modals.caseType.solution_id}
        request_type_id={modals.caseType.request_type_id}
        onSave={(data) => handleSave('caseType', data, data.id ? (d) => updateCaseType(d.id, d) : createCaseType)}
      />

<KPIModal
        isOpen={modals.kpi.isOpen}
        onClose={() => closeModal('kpi')}
        data={modals.kpi.data}
        solution_id={modals.kpi.solution_id}
        onSave={(data) => handleSave('kpi', data, data.id ? (d) => updateKPI(d.id, d) : createKPI)}
      />

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 ${
          toast.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-green-500/90 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

// Company Card Component
function CompanyCard({ company, isExpanded, onToggle, onEdit, onDelete, onAddPOC, onAddSolution, 
                      expandedSolutions, expandedRequestTypes, toggleSolution, toggleRequestType, openModal, queryClient }) {
  const { data: pocs } = useQuery({
    queryKey: ['pocs', company.id],
    queryFn: () => getPOCs(company.id),
    enabled: isExpanded
  })

  const { data: solutions } = useQuery({
    queryKey: ['solutions', company.id],
    queryFn: () => getSolutions(company.id),
    enabled: isExpanded
  })

  return (
    <div className="card">
      {/* Company Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4 flex-1">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-cortex-border rounded transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-6 h-6 text-cortex-accent" />
              <h2 className="text-2xl font-display font-bold">{company.company_name}</h2>
              <span className="badge bg-cortex-accent/10 text-cortex-accent font-mono text-sm">
                {company.company_code}
              </span>
              {company.is_active ? (
                <span className="badge bg-cortex-success/10 text-cortex-success text-sm">Active</span>
              ) : (
                <span className="badge bg-cortex-muted/10 text-cortex-muted text-sm">Inactive</span>
              )}
              {company.domain && (
                <span className="text-sm text-cortex-muted font-mono bg-cortex-bg px-2 py-0.5 rounded">
                  @{company.domain}
                </span>
              )}
            </div>
            
            {company.description && (
              <p className="text-cortex-muted mb-2">{company.description}</p>
            )}
            
            <div className="flex items-center gap-4 text-sm text-cortex-muted">
              <span>Domain: {company.domain || 'N/A'}</span>
              <span>• {company.poc_count} POCs</span>
              <span>• {company.solution_count} Solutions</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-2 hover:bg-cortex-border rounded transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 hover:bg-cortex-border rounded transition-colors text-cortex-danger">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="ml-11 space-y-6 border-l-2 border-cortex-border pl-6">
          {/* POCs Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-cortex-accent" />
                Points of Contact
              </h3>
              <button onClick={onAddPOC} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add POC
              </button>
            </div>
            
            {pocs && pocs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pocs.map(poc => (
                  <div key={poc.id} className="p-3 bg-cortex-bg rounded-lg border border-cortex-border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{poc.name}</p>
                        <p className="text-sm text-cortex-muted">{poc.email}</p>
                        {poc.phone && <p className="text-xs text-cortex-muted font-mono">{poc.phone}</p>}
                        {poc.role && <p className="text-xs text-cortex-accent mt-1">{poc.role}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => openModal('poc', poc, { company_id: company.id })}
                          className="p-1 hover:bg-cortex-border rounded"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Delete POC "${poc.name}"?`)) {
                              deletePOC(poc.id).then(() => queryClient.invalidateQueries())
                            }
                          }}
                          className="p-1 hover:bg-cortex-border rounded text-cortex-danger"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-cortex-muted">No POCs added yet</p>
            )}
          </div>

          {/* Solutions Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-cortex-accent" />
                Solutions
              </h3>
              <button onClick={onAddSolution} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Solution
              </button>
            </div>
            
            {solutions && solutions.length > 0 ? (
              <div className="space-y-3">
                {solutions.map(solution => (
                  <SolutionCard
                    key={solution.id}
                    solution={solution}
                    companyId={company.id}
                    isExpanded={expandedSolutions[solution.id]}
                    onToggle={() => toggleSolution(solution.id)}
                    expandedRequestTypes={expandedRequestTypes}
                    toggleRequestType={toggleRequestType}
                    openModal={openModal}
                    queryClient={queryClient}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-cortex-muted">No solutions added yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Solution Card Component (COMPLETE VERSION)
function SolutionCard({ solution, companyId, isExpanded, onToggle, expandedRequestTypes, toggleRequestType, openModal, queryClient }) {
  // Fetch all solution-related data
  const { data: slaConfigs } = useQuery({
    queryKey: ['sla-configs', solution.id],
    queryFn: () => getSLAConfigs(solution.id),
    enabled: true
  })

  const { data: escalationConfigs } = useQuery({
    queryKey: ['escalation-configs', solution.id],
    queryFn: () => getEscalationConfigs(solution.id),
    enabled: true
  })

  const { data: assignees } = useQuery({
    queryKey: ['assignees', solution.id],
    queryFn: () => getAssignees(solution.id),
    enabled: true
  })

  const { data: modules } = useQuery({
    queryKey: ['modules', solution.id],
    queryFn: () => getModules(solution.id),
    enabled: true
  })

  const { data: requestTypes } = useQuery({
    queryKey: ['request-types', solution.id],
    queryFn: () => getRequestTypes(solution.id),
    enabled: true
  })

  const { data: kpis } = useQuery({
    queryKey: ['kpis', solution.id],
    queryFn: () => getKPIs(solution.id),
    enabled: true
  })

  return (
    <div className="border border-cortex-border rounded-lg p-4 bg-cortex-surface/50">
      {/* Solution Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <button
            onClick={onToggle}
            className="p-1 hover:bg-cortex-border rounded"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-lg">{solution.solution_name}</h4>
              <span className="badge bg-cortex-surface text-xs font-mono">{solution.solution_code}</span>
            </div>
            <p className="text-xs text-cortex-muted mb-1">{solution.description || 'No description'}</p>
            <div className="flex gap-3 text-xs text-cortex-muted">
              <span>Hours: {solution.business_hours_start} - {solution.business_hours_end}</span>
              <span>• {solution.timezone}</span>
            </div>
            {!isExpanded && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {slaConfigs?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{slaConfigs.length} SLA</span>
                )}
                {escalationConfigs?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">{escalationConfigs.length} Escalation</span>
                )}
                {assignees?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400">{assignees.length} Assignees</span>
                )}
                {modules?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">{modules.length} Modules</span>
                )}
                {requestTypes?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">{requestTypes.length} Req Types</span>
                )}
                {kpis?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-pink-500/10 text-pink-400">{kpis.length} KPIs</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1">
          <button 
            onClick={() => openModal('solution', solution, { company_id: companyId })}
            className="p-1 hover:bg-cortex-border rounded"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button 
            onClick={() => {
              if (confirm(`Delete solution "${solution.solution_name}"?`)) {
                deleteSolution(solution.id).then(() => queryClient.invalidateQueries())
              }
            }}
            className="p-1 hover:bg-cortex-border rounded text-cortex-danger"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Solution Content */}
      {isExpanded && (
        <div className="ml-7 space-y-4 mt-4 border-t border-cortex-border pt-4">
          
          {/* SLA Configurations */}
          <ConfigSection
            title="SLA Configurations"
            icon={Clock}
            items={slaConfigs}
            onAdd={() => openModal('sla', null, { solution_id: solution.id })}
            onEdit={(item) => openModal('sla', item, { solution_id: solution.id })}
            onDelete={(item) => {
              if (confirm(`Delete SLA config for ${item.priority}?`)) {
                deleteSLAConfig(item.id).then(() => queryClient.invalidateQueries())
              }
            }}
            renderItem={(sla) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{sla.priority}</span>
                  <span className="text-xs text-cortex-muted">{sla.priority_name}</span>
                </div>
                <div className="text-xs text-cortex-muted">
                  Response: {sla.response_hours}h • Resolution: {sla.resolution_hours}h
                </div>
              </div>
            )}
          />

          {/* Escalation Rules */}
          <ConfigSection
            title="Escalation Rules"
            icon={AlertTriangle}
            items={escalationConfigs}
            onAdd={() => openModal('escalation', null, { solution_id: solution.id })}
            onEdit={(item) => openModal('escalation', item, { solution_id: solution.id })}
            onDelete={(item) => {
              if (confirm(`Delete escalation level ${item.level}?`)) {
                deleteEscalationConfig(item.id).then(() => queryClient.invalidateQueries())
              }
            }}
            renderItem={(esc) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">Level {esc.level}</span>
                  <span className="badge bg-cortex-warning/10 text-cortex-warning text-xs">
                    {esc.threshold_percent}%
                  </span>
                </div>
                <div className="text-xs text-cortex-muted">{esc.level_name}</div>
              </div>
            )}
          />

          {/* Assignees */}
          <ConfigSection
            title="Assignees"
            icon={UserCircle}
            items={assignees}
            onAdd={() => openModal('assignee', null, { solution_id: solution.id })}
            onEdit={(item) => openModal('assignee', item, { solution_id: solution.id })}
            onDelete={(item) => {
              if (confirm(`Delete assignee "${item.person_name}"?`)) {
                deleteAssignee(item.id).then(() => queryClient.invalidateQueries())
              }
            }}
            renderItem={(assignee) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{assignee.person_name}</span>
                  <span className="badge bg-cortex-accent/10 text-cortex-accent text-xs">
                    {assignee.role_code}
                  </span>
                </div>
                <div className="text-xs text-cortex-muted">{assignee.email}</div>
              </div>
            )}
          />

          {/* Modules */}
          <ConfigSection
            title="Modules"
            icon={Grid3x3}
            items={modules}
            onAdd={() => openModal('module', null, { solution_id: solution.id })}
            onEdit={(item) => openModal('module', item, { solution_id: solution.id })}
            onDelete={(item) => {
              if (confirm(`Delete module "${item.module_name}"?`)) {
                deleteModule(item.id).then(() => queryClient.invalidateQueries())
              }
            }}
            renderItem={(mod) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{mod.module_name}</span>
                  <span className="text-xs font-mono text-cortex-muted">{mod.module_code}</span>
                </div>
                {mod.description && (
                  <div className="text-xs text-cortex-muted">{mod.description}</div>
                )}
              </div>
            )}
          />

          {/* Request Types with nested Case Types */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-cortex-accent" />
                Request Types
              </h4>
              <button 
                onClick={() => openModal('requestType', null, { solution_id: solution.id })}
                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            
            {requestTypes && requestTypes.length > 0 ? (
              <div className="space-y-2">
                {requestTypes.map(rt => (
                  <RequestTypeCard
                    key={rt.id}
                    requestType={rt}
                    solutionId={solution.id}
                    isExpanded={expandedRequestTypes[rt.id]}
                    onToggle={() => toggleRequestType(rt.id)}
                    openModal={openModal}
                    queryClient={queryClient}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-cortex-muted">No request types added yet</p>
            )}
          </div>

          {/* KPIs */}
          <ConfigSection
            title="KPIs"
            icon={BarChart3}
            items={kpis}
            onAdd={() => openModal('kpi', null, { solution_id: solution.id })}
            onEdit={(item) => openModal('kpi', item, { solution_id: solution.id })}
            onDelete={(item) => {
              if (confirm(`Delete KPI "${item.kpi_name}"?`)) {
                deleteKPI(item.id).then(() => queryClient.invalidateQueries())
              }
            }}
            renderItem={(kpi) => (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{kpi.kpi_name}</span>
                  <span className="text-xs font-mono text-cortex-muted">{kpi.kpi_code}</span>
                </div>
                <div className="text-xs text-cortex-muted">
                  Target: {kpi.target_value} {kpi.unit}
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

// Request Type Card with nested Case Types
function RequestTypeCard({ requestType, solutionId, isExpanded, onToggle, openModal, queryClient }) {
  const { data: caseTypes } = useQuery({
    queryKey: ['case-types', requestType.id],
    queryFn: () => getCaseTypes(solutionId, requestType.id),
    enabled: isExpanded
  })

  return (
    <div className="border border-cortex-border/50 rounded p-2 bg-cortex-bg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <button onClick={onToggle} className="p-1 hover:bg-cortex-border rounded">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{requestType.request_type}</span>
              {requestType.sla_applicable && (
                <span className="badge bg-cortex-success/10 text-cortex-success text-xs">SLA</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => openModal('requestType', requestType, { solution_id: solutionId })}
            className="p-1 hover:bg-cortex-border rounded"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button 
            onClick={() => {
              if (confirm(`Delete request type "${requestType.request_type}"?`)) {
                deleteRequestType(requestType.id).then(() => queryClient.invalidateQueries())
              }
            }}
            className="p-1 hover:bg-cortex-border rounded text-cortex-danger"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Case Types (nested) */}
      {isExpanded && (
        <div className="ml-6 mt-2 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-cortex-muted">Case Types</span>
            <button 
              onClick={() => openModal('caseType', null, { solution_id: solutionId, request_type_id: requestType.id })}
              className="btn-secondary text-xs px-1 py-0.5"
            >
              <Plus className="w-2 h-2" />
            </button>
          </div>
          
          {caseTypes && caseTypes.length > 0 ? (
            caseTypes.map(ct => (
              <div key={ct.id} className="flex items-center justify-between p-2 bg-cortex-surface rounded text-xs">
                <div>
                  <span className="font-medium">{ct.case_type}</span>
                  {ct.default_priority && (
                    <span className="ml-2 text-cortex-muted">({ct.default_priority})</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => openModal('caseType', ct, { solution_id: solutionId, request_type_id: requestType.id })}
                    className="p-1 hover:bg-cortex-border rounded"
                  >
                    <Edit className="w-2 h-2" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Delete case type "${ct.case_type}"?`)) {
                        deleteCaseType(ct.id).then(() => queryClient.invalidateQueries())
                      }
                    }}
                    className="p-1 hover:bg-cortex-border rounded text-cortex-danger"
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-cortex-muted">No case types</p>
          )}
        </div>
      )}
    </div>
  )
}

// Reusable Config Section Component
function ConfigSection({ title, icon: Icon, items, onAdd, onEdit, onDelete, renderItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <Icon className="w-4 h-4 text-cortex-accent" />
          {title}
        </h4>
        <button onClick={onAdd} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
          <Plus className="w-3 h-3" />
        </button>
      </div>
      
      {items && items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map(item => (
            <div key={item.id} className="p-2 bg-cortex-bg rounded border border-cortex-border/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {renderItem(item)}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(item)} className="p-1 hover:bg-cortex-border rounded">
                    <Edit className="w-3 h-3" />
                  </button>
                  <button onClick={() => onDelete(item)} className="p-1 hover:bg-cortex-border rounded text-cortex-danger">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-cortex-muted">No items added yet</p>
      )}
    </div>
  )
}

// ===== MODALS =====

function CompanyModal({ isOpen, onClose, data, onSave }) {
  const [form, setForm] = useState(data || {
    company_code: '',
    company_name: '',
    description: '',
    domain: '',
    is_active: true
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ company_code: '', company_name: '', description: '', domain: '', is_active: true })
  }, [data])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Company' : 'Add Company'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave(form)
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Company Code *</label>
            <input
              type="text"
              value={form.company_code}
              onChange={(e) => setForm({ ...form, company_code: e.target.value })}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Company Name *</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="input w-full"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input w-full"
            rows="2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Domain</label>
          <input
            type="text"
            value={form.domain || ''}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            className="input w-full"
            placeholder="example.com"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            id="is_active"
          />
          <label htmlFor="is_active" className="text-sm">Active</label>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function POCModal({ isOpen, onClose, data, company_id, onSave }) {
  const [form, setForm] = useState(data || {
    company_id: company_id,
    email: '',
    name: '',
    phone: '',
    role: '',
    status: 'active',
    is_primary: false
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ company_id, email: '', name: '', phone: '', role: '', status: 'active', is_primary: false })
  }, [data, company_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit POC' : 'Add POC'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, company_id })
      }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Name *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Email *</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Phone</label>
            <input type="tel" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <input type="text" value={form.role || ''} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function SolutionModal({ isOpen, onClose, data, company_id, onSave }) {
  const defaults = {
    company_id: company_id,
    solution_code: '',
    solution_name: '',
    description: '',
    clickup_space_id: '',
    clickup_list_id: '',
    business_hours_start: '08:00',
    business_hours_end: '20:00',
    timezone: 'Asia/Dubai',
    is_active: true
  }
  const [form, setForm] = useState(data || defaults)

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ ...defaults, company_id })
  }, [data, company_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Solution' : 'Add Solution'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, company_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Solution Code *</label>
            <input type="text" value={form.solution_code} onChange={(e) => setForm({ ...form, solution_code: e.target.value })} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Solution Name *</label>
            <input type="text" value={form.solution_name} onChange={(e) => setForm({ ...form, solution_name: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" rows="2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Business Hours Start</label>
            <input type="time" value={form.business_hours_start} onChange={(e) => setForm({ ...form, business_hours_start: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Business Hours End</label>
            <input type="time" value={form.business_hours_end} onChange={(e) => setForm({ ...form, business_hours_end: e.target.value })} className="input w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function SLAConfigModal({ isOpen, onClose, data, solution_id, onSave }) {
  const defaults = {
    solution_id,
    priority: '',
    priority_name: '',
    priority_description: '',
    response_hours: '',
    resolution_hours: '',
    resolution_type: 'hours'
  }
  const [form, setForm] = useState(data || defaults)

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ ...defaults, solution_id })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit SLA Config' : 'Add SLA Config'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Priority *</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input w-full" required>
              <option value="">Select</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
              <option value="P5">P5</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Priority Name *</label>
            <input type="text" value={form.priority_name} onChange={(e) => setForm({ ...form, priority_name: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Response Hours *</label>
            <input type="number" step="0.01" value={form.response_hours} onChange={(e) => setForm({ ...form, response_hours: e.target.value })} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Resolution Hours *</label>
            <input type="number" step="0.01" value={form.resolution_hours} onChange={(e) => setForm({ ...form, resolution_hours: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function EscalationConfigModal({ isOpen, onClose, data, solution_id, onSave }) {
  const defaults = {
    solution_id,
    level: '',
    threshold_percent: '',
    level_name: '',
    notify_roles: [],
    action_description: ''
  }
  const [form, setForm] = useState(data || defaults)

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ ...defaults, solution_id })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Escalation' : 'Add Escalation'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
          <label className="block text-sm font-medium mb-2">Level *</label>
          <input type="number" min="1" max="10" value={form.level} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) || '' })} className="input w-full" required />
          </div>
          <div>
          <label className="block text-sm font-medium mb-2">Threshold % *</label>
          <input type="number" min="0" max="100" step="1" value={form.threshold_percent} onChange={(e) => setForm({ ...form, threshold_percent: parseFloat(e.target.value) || '' })} className="input w-full" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Level Name *</label>
          <input type="text" value={form.level_name} onChange={(e) => setForm({ ...form, level_name: e.target.value })} className="input w-full" required />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function AssigneeModal({ isOpen, onClose, data, solution_id, onSave }) {
  const [form, setForm] = useState(data || {
    solution_id,
    role_code: '',
    role_name: '',
    person_name: '',
    email: '',
    clickup_user_id: '',
    is_active: true
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ solution_id, role_code: '', role_name: '', person_name: '', email: '', clickup_user_id: '', is_active: true })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Assignee' : 'Add Assignee'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Role Code *</label>
            <input type="text" value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role Name *</label>
            <input type="text" value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Person Name *</label>
          <input type="text" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Email *</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" required />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function ModuleModal({ isOpen, onClose, data, solution_id, onSave }) {
  const [form, setForm] = useState(data || {
    solution_id,
    module_code: '',
    module_name: '',
    description: ''
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ solution_id, module_code: '', module_name: '', description: '' })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Module' : 'Add Module'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Module Code *</label>
            <input type="text" value={form.module_code} onChange={(e) => setForm({ ...form, module_code: e.target.value })} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Module Name *</label>
            <input type="text" value={form.module_name} onChange={(e) => setForm({ ...form, module_name: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" rows="2" />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function RequestTypeModal({ isOpen, onClose, data, solution_id, onSave }) {
  const [form, setForm] = useState(data || {
    solution_id,
    request_type: '',
    description: '',
    sla_applicable: true
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ solution_id, request_type: '', description: '', sla_applicable: true })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Request Type' : 'Add Request Type'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Request Type *</label>
          <input type="text" value={form.request_type} onChange={(e) => setForm({ ...form, request_type: e.target.value })} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" rows="2" />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.sla_applicable}
            onChange={(e) => setForm({ ...form, sla_applicable: e.target.checked })}
            id="sla_applicable"
          />
          <label htmlFor="sla_applicable" className="text-sm">SLA Applicable</label>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function CaseTypeModal({ isOpen, onClose, data, solution_id, request_type_id, onSave }) {
  const [form, setForm] = useState(data || {
    solution_id,
    request_type_id,
    case_type: '',
    description: '',
    default_priority: 'P3'
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ solution_id, request_type_id, case_type: '', description: '', default_priority: 'P3' })
  }, [data, solution_id, request_type_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit Case Type' : 'Add Case Type'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id, request_type_id })
      }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Case Type *</label>
          <input type="text" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })} className="input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Default Priority</label>
          <select value={form.default_priority} onChange={(e) => setForm({ ...form, default_priority: e.target.value })} className="input w-full">
            <option value="P1">P1 - Critical</option>
            <option value="P2">P2 - High</option>
            <option value="P3">P3 - Medium</option>
            <option value="P4">P4 - Low</option>
            <option value="P5">P5 - Very Low</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

function KPIModal({ isOpen, onClose, data, solution_id, onSave }) {
  const [form, setForm] = useState(data || {
    solution_id,
    kpi_code: '',
    kpi_name: '',
    description: '',
    calculation_method: '',
    target_value: '',
    unit: '',
    report_frequency: 'monthly'
  })

  useEffect(() => {
    if (data) setForm(data)
    else setForm({ solution_id, kpi_code: '', kpi_name: '', description: '', calculation_method: '', target_value: '', unit: '', report_frequency: 'monthly' })
  }, [data, solution_id])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data ? 'Edit KPI' : 'Add KPI'}>
      <form onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...form, solution_id })
      }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">KPI Code *</label>
            <input type="text" value={form.kpi_code} onChange={(e) => setForm({ ...form, kpi_code: e.target.value })} className="input w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">KPI Name *</label>
            <input type="text" value={form.kpi_name} onChange={(e) => setForm({ ...form, kpi_name: e.target.value })} className="input w-full" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Target Value</label>
            <input type="number" step="0.01" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Unit</label>
            <input type="text" value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input w-full" placeholder="%" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}