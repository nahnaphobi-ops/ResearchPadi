import { create } from 'zustand';

interface WorkspaceSession {
  id: string;
  title?: string;
  content: string;
  course?: string;
  institution_type?: string;
  sources_used: any[];
  uploaded_materials: any[];
  created_at: string;
  updated_at: string;
}

interface WorkspaceState {
  sessions: WorkspaceSession[];
  activeSession: WorkspaceSession | null;
  loading: boolean;
  subscription: any;
  setSessions: (sessions: WorkspaceSession[]) => void;
  setActiveSession: (session: WorkspaceSession | null) => void;
  setLoading: (loading: boolean) => void;
  setSubscription: (sub: any) => void;
  updateSessionContent: (content: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  sessions: [],
  activeSession: null,
  loading: false,
  subscription: null,
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (session) => set({ activeSession: session }),
  setLoading: (loading) => set({ loading }),
  setSubscription: (sub) => set({ subscription: sub }),
  updateSessionContent: (content) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, content }
        : null,
    })),
}));
