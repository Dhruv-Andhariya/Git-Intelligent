import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  repoPath: string;
  analysisData: any | null;
  isAnalyzing: boolean;
  aiReportText: string;
  handoverText: string;
  knowledgeNarrativeText: string;
  historyData: any[];
  setRepoPath: (path: string) => void;
  setAnalysisData: (data: any) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setAiReportText: (text: string) => void;
  setHandoverText: (text: string) => void;
  setKnowledgeNarrativeText: (text: string) => void;
  setHistoryData: (data: any[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      repoPath: '',
      analysisData: null,
      isAnalyzing: false,
      aiReportText: '',
      handoverText: '',
      knowledgeNarrativeText: '',
      historyData: [],
      setRepoPath: (path) => set({ repoPath: path, aiReportText: '', handoverText: '', knowledgeNarrativeText: '' }),
      setAnalysisData: (data) => set({ analysisData: data, aiReportText: '', handoverText: '', knowledgeNarrativeText: '' }),
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      setAiReportText: (text) => set({ aiReportText: text }),
      setHandoverText: (text) => set({ handoverText: text }),
      setKnowledgeNarrativeText: (text) => set({ knowledgeNarrativeText: text }),
      setHistoryData: (data) => set({ historyData: data }),
    }),
    {
      name: 'gitlens-intelligence-storage',
      partialize: (state) => ({ 
        repoPath: state.repoPath,
        analysisData: state.analysisData,
        aiReportText: state.aiReportText,
        handoverText: state.handoverText,
        knowledgeNarrativeText: state.knowledgeNarrativeText,
        historyData: state.historyData
      }),
    }
  )
);
