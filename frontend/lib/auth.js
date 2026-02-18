'use client';

import { useState, useEffect } from 'react';

// Mock user for testing (replace with real auth later)
const mockUser = {
  id: '13',
  email: 'omer.shaikh@iohealth.com',
  role: 'admin',
  name: 'Omer Shaikh'
};

export function useAuth() {
  const [user, setUser] = useState(mockUser);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    // Mock login
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
  };

  return { user, loading, login, logout };
}

export async function apiFetch(path, options = {}) {
  const url = `http://localhost:5000${path}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}