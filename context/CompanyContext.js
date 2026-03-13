'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

const CompanyContext = createContext({ company: 'all', setCompany: () => {}, companies: [] })

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState('')
  const [initialised, setInitialised] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('apex_company_filter')
    if (saved) setCompanyState(saved)
    setInitialised(true)
  }, [])

  const setCompany = (code) => {
    setCompanyState(code)
    localStorage.setItem('apex_company_filter', code)
  }

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () =>
      fetch('/api/admin/companies')
        .then(r => r.json())
        .then(d => Array.isArray(d) ? d : (d.companies || [])),
    staleTime: 5 * 60 * 1000,
  })

  // Once companies load, auto-select the first one if nothing is saved in localStorage
  useEffect(() => {
    if (initialised && companies.length > 0 && !company) {
      setCompanyState(companies[0].company_code)
    }
  }, [initialised, companies, company])

  return (
    <CompanyContext.Provider value={{ company: company || 'all', setCompany, companies }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
