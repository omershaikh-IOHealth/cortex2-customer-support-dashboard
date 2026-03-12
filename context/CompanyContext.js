'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

const CompanyContext = createContext({ company: 'medgulf', setCompany: () => {}, companies: [] })

export function CompanyProvider({ children }) {
  const [company, setCompanyState] = useState('medgulf')

  useEffect(() => {
    const saved = localStorage.getItem('apex_company_filter')
    if (saved) setCompanyState(saved)
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

  return (
    <CompanyContext.Provider value={{ company, setCompany, companies }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => useContext(CompanyContext)
