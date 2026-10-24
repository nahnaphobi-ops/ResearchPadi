import api from './api';
import type {
  CareStudy, CareStudySectionRow, CareStudyTemplate, CareStudyVersion, CheckIssue, HelpResult, PrivacyIssue, SectionEntries,
} from '../types/careStudy';

export const careStudyService = {
  templates: () => api.get<{ templates: CareStudyTemplate[]; price: number }>('/care-studies/templates'),
  list: () => api.get<Pick<CareStudy, 'id' | 'template_id' | 'pseudonym' | 'focus' | 'created_at' | 'updated_at'>[]>('/care-studies'),
  create: (data: {
    template_id: string; pseudonym?: string; focus: string; institution_name?: string; supervisor_name?: string;
    consent: boolean; declaration: boolean;
  }) => api.post<{ study: CareStudy; balance: number }>('/care-studies', data),
  get: (id: string) => api.get<{
    study: CareStudy;
    template: CareStudyTemplate;
    sections: Record<string, CareStudySectionRow>;
    status: Record<string, { missing: string[] }>;
  }>(`/care-studies/${id}`),
  saveSection: (id: string, key: string, entries: SectionEntries) =>
    api.put<{ saved: boolean; warnings: PrivacyIssue[]; missing: string[]; updated_at: string | null }>(`/care-studies/${id}/sections/${key}`, { entries }),
  draft: (id: string, key: string) =>
    api.post<{ draft: string; drafted_at: string; flaggedValues: string[]; removedCitations: string[] }>(`/care-studies/${id}/sections/${key}/draft`),
  editDraft: (id: string, key: string, draft: string) =>
    api.put<{ saved: boolean; warnings: PrivacyIssue[] }>(`/care-studies/${id}/sections/${key}/draft`, { draft }),
  versions: (id: string, section?: string) =>
    api.get<CareStudyVersion[]>(`/care-studies/${id}/versions`, { params: section ? { section } : {} }),
  check: (id: string) => api.post<{ issues: CheckIssue[]; note: string }>(`/care-studies/${id}/check`),
  help: (id: string, message: string) => api.post<HelpResult>(`/care-studies/${id}/help`, { message }),
  /** 'clean' is the document to submit; 'supervisor' keeps the student's notes beside the draft. */
  exportStudy: (id: string, name: string, format: 'clean' | 'supervisor' = 'supervisor', file: 'docx' | 'pdf' = 'docx', prefix = 'Care_study') =>
    api.get(`/care-studies/${id}/export`, { responseType: 'blob', params: { format, file } }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${prefix}_${name.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 60)}${format === 'clean' ? '' : '_supervisor_copy'}.${file}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }),
};
