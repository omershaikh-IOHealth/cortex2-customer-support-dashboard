'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, UserX, UserCheck, Users, Phone, AlertTriangle } from 'lucide-react'
import { getUsers } from '@/lib/api'

function validatePassword(pw) {
  if (!pw) return null // blank = no change (edit mode)
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)) return 'Password must contain at least one number or symbol'
  return null
}
import Modal from './Modal'


export default function UserManagementSection() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    refetchInterval: 60000,
  })

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openCreate() { setEditUser(null); setModalOpen(true) }
  function openEdit(u) { setEditUser(u); setModalOpen(true) }

  async function handleSave(formData) {
    setSaving(true)
    try {
      const url = editUser ? `/api/users/${editUser.id}` : '/api/users'
      const method = editUser ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      showToast(editUser ? 'User updated' : 'User created')
      setModalOpen(false)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(user) {
    const action = user.is_active ? 'deactivate' : 'reactivate'
    if (!confirm(`${action} ${user.full_name}?`)) return
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: user.is_active ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(user.is_active ? {} : { body: JSON.stringify({ is_active: true }) }),
      })
      if (!res.ok) throw new Error('Failed')
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      showToast(`User ${action}d`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const agents = users.filter(u => u.role === 'agent')

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cortex-accent/10 rounded-lg">
            <Users className="w-5 h-5 text-cortex-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cortex-text">User Management</h2>
            <p className="text-xs text-cortex-muted">
              {users.filter(u => u.is_active).length} active · {users.length} total
            </p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'error'
            ? 'bg-cortex-danger text-white'
            : 'bg-cortex-success text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-cortex-surface animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">ZIWO Email</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-cortex-muted py-8">
                    No users found. Run the seed script to create initial users.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className={`border-b border-cortex-border ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="table-cell font-medium text-cortex-text">{u.full_name}</td>
                    <td className="table-cell text-cortex-muted font-mono text-xs">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${
                        u.role === 'admin'
                          ? 'text-cortex-accent bg-cortex-accent/10'
                          : 'text-cortex-success bg-cortex-success/10'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="table-cell">
                      {u.ziwo_email ? (
                        <span className="flex items-center gap-1 text-xs text-cortex-muted font-mono">
                          <Phone className="w-3 h-3" />
                          {u.ziwo_email}
                        </span>
                      ) : (
                        <span className="text-cortex-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge text-xs ${
                        u.is_active
                          ? 'text-cortex-success bg-cortex-success/10'
                          : 'text-cortex-muted bg-cortex-border/50'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-cortex-muted hover:text-cortex-accent transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`transition-colors ${
                            u.is_active
                              ? 'text-cortex-muted hover:text-cortex-danger'
                              : 'text-cortex-muted hover:text-cortex-success'
                          }`}
                          title={u.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* User Modal */}
      <UserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={editUser}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}

function UserModal({ isOpen, onClose, user, onSave, saving }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'agent',
    ziwo_email: '',
    ziwo_password: '',
  })
  const [pwError, setPwError] = useState('')

  // Sync form when user changes
  useEffect(() => {
    setPwError('')
    if (user) {
      setForm({
        full_name: user.full_name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'agent',
        ziwo_email: user.ziwo_email || '',
        ziwo_password: '',
      })
    } else {
      setForm({ full_name: '', email: '', password: '', role: 'agent', ziwo_email: '', ziwo_password: '' })
    }
  }, [user])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); if (k === 'password') setPwError('') }

  function handleSubmit(e) {
    e.preventDefault()
    // Validate password if provided (always required for new users)
    const pwErr = !user ? validatePassword(form.password) : (form.password ? validatePassword(form.password) : null)
    if (pwErr) { setPwError(pwErr); return }
    const payload = { ...form }
    if (!payload.password) delete payload.password
    if (!payload.ziwo_password) delete payload.ziwo_password
    onSave(payload)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={user ? 'Edit User' : 'Create User'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name *</label>
            <input
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role *</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input w-full"
              required
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="input w-full"
            required
            disabled={!!user}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Password {user ? '(leave blank to keep current)' : '*'}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            className={`input w-full ${pwError ? 'border-cortex-danger' : ''}`}
            required={!user}
            placeholder={user ? '••••••••' : ''}
          />
          {pwError ? (
            <p className="text-xs text-cortex-danger mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />{pwError}
            </p>
          ) : (
            <p className="text-xs text-cortex-muted mt-1">Min 8 chars · uppercase · lowercase · number or symbol</p>
          )}
        </div>

        <div className="border-t border-cortex-border pt-4">
          <p className="text-xs text-cortex-muted mb-3 font-mono uppercase tracking-wide">
            ZIWO Credentials (Agent accounts only)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">ZIWO Email</label>
              <input
                type="email"
                value={form.ziwo_email}
                onChange={e => set('ziwo_email', e.target.value)}
                className="input w-full"
                placeholder="agent@iohealth.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">ZIWO Password</label>
              <input
                type="text"
                value={form.ziwo_password}
                onChange={e => set('ziwo_password', e.target.value)}
                className="input w-full"
                placeholder="ZIWO login password"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : user ? 'Update User' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
