'use client';

import React, { createContext, useContext, useState } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (crumbs: BreadcrumbItem[]) => void;
  actions: React.ReactNode | null;
  setActions: (actions: React.ReactNode | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [actions, setActions] = useState<React.ReactNode | null>(null);
  return (
    <HeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs, actions, setActions }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
