import api from '@/lib/api';

export interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  isChecked: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  issueId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
}

export const checklistsApi = {
  // ── Checklists ─────────────────────────────────────────────────────────
  list: (issueId: string) =>
    api.get<Checklist[]>(`/issues/${issueId}/checklists`).then((r) => r.data),

  create: (issueId: string, title: string) =>
    api
      .post<Checklist>(`/issues/${issueId}/checklists`, { title })
      .then((r) => r.data),

  update: (issueId: string, checklistId: string, title: string) =>
    api
      .patch<Checklist>(`/issues/${issueId}/checklists/${checklistId}`, {
        title,
      })
      .then((r) => r.data),

  delete: (issueId: string, checklistId: string) =>
    api.delete(`/issues/${issueId}/checklists/${checklistId}`),

  // ── Items ──────────────────────────────────────────────────────────────
  addItem: (checklistId: string, text: string) =>
    api
      .post<ChecklistItem>(`/checklists/${checklistId}/items`, { text })
      .then((r) => r.data),

  updateItem: (
    checklistId: string,
    itemId: string,
    data: { text?: string; isChecked?: boolean; order?: number },
  ) =>
    api
      .patch<ChecklistItem>(`/checklists/${checklistId}/items/${itemId}`, data)
      .then((r) => r.data),

  deleteItem: (checklistId: string, itemId: string) =>
    api.delete(`/checklists/${checklistId}/items/${itemId}`),
};
