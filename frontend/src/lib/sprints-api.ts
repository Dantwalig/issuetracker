import api from '@/lib/api';
import { Sprint, Issue, CreateSprintPayload, UpdateSprintPayload } from '@/types';

export const sprintsApi = {
  /** List all sprints for a project */
  list: (projectId: string) =>
    api.get<Sprint[]>(`/projects/${projectId}/sprints`).then((r) => r.data),

  /** Get a single sprint */
  get: (projectId: string, sprintId: string) =>
    api
      .get<Sprint>(`/projects/${projectId}/sprints/${sprintId}`)
      .then((r) => r.data),

  /** Create a sprint */
  create: (projectId: string, data: CreateSprintPayload) =>
    api
      .post<Sprint>(`/projects/${projectId}/sprints`, data)
      .then((r) => r.data),

  /** Update name / dates */
  update: (projectId: string, sprintId: string, data: UpdateSprintPayload) =>
    api
      .patch<Sprint>(`/projects/${projectId}/sprints/${sprintId}`, data)
      .then((r) => r.data),

  /** Transition DRAFT → ACTIVE */
  start: (projectId: string, sprintId: string) =>
    api
      .post<Sprint>(`/projects/${projectId}/sprints/${sprintId}/start`)
      .then((r) => r.data),

  /** Transition ACTIVE → COMPLETED (unfinished issues move to backlog) */
  complete: (projectId: string, sprintId: string) =>
    api
      .post<Sprint>(`/projects/${projectId}/sprints/${sprintId}/complete`)
      .then((r) => r.data),

  /** List all issues in a sprint */
  getIssues: (projectId: string, sprintId: string) =>
    api
      .get<Issue[]>(`/projects/${projectId}/sprints/${sprintId}/issues`)
      .then((r) => r.data),

  /** Move a backlog issue into a sprint */
  addIssue: (projectId: string, sprintId: string, issueId: string) =>
    api
      .post<Issue>(
        `/projects/${projectId}/sprints/${sprintId}/issues/${issueId}`,
      )
      .then((r) => r.data),

  /** Remove an issue from a sprint back to the backlog */
  removeIssue: (projectId: string, sprintId: string, issueId: string) =>
    api
      .delete<Issue>(
        `/projects/${projectId}/sprints/${sprintId}/issues/${issueId}`,
      )
      .then((r) => r.data),
};
