'use client';
import { create } from 'zustand';

interface ContentRequestDraft {
  topic: string;
  strategicObjective: string;
  context: string;
  targetAudience: string;
  audienceDescription: string;
  narrativePerspective: string;
  platforms: string[];
  writingStructure: string;
  callToAction: string;
  brandProfileId: string;
  enableHumanization: boolean;
  enableQA: boolean;
  requireApproval: boolean;
  language: string;
  specialInstructions: string;
}

interface ContentStore {
  draft: Partial<ContentRequestDraft>;
  currentStep: number;
  setDraft: (data: Partial<ContentRequestDraft>) => void;
  setStep: (step: number) => void;
  resetDraft: () => void;
}

const defaultDraft: Partial<ContentRequestDraft> = {
  platforms: [],
  enableHumanization: true,
  enableQA: true,
  requireApproval: false,
  language: 'English',
};

export const useContentStore = create<ContentStore>((set) => ({
  draft: defaultDraft,
  currentStep: 1,
  setDraft: (data) => set((s) => ({ draft: { ...s.draft, ...data } })),
  setStep: (step) => set({ currentStep: step }),
  resetDraft: () => set({ draft: defaultDraft, currentStep: 1 }),
}));
