import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { APP_TOUR_TOPICS } from '@/data/appTour';

type TourScreen = 'topics' | 'lesson';

interface AppTourContextValue {
  active: boolean;
  minimized: boolean;
  screen: TourScreen;
  topicId: string | null;
  stepIndex: number;
  startTour: () => void;
  selectTopic: (topicId: string) => void;
  showTopics: () => void;
  previousStep: () => void;
  nextStep: () => void;
  minimizeTour: () => void;
  resumeTour: () => void;
  endTour: () => void;
}

const AppTourContext = createContext<AppTourContextValue | null>(null);

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [screen, setScreen] = useState<TourScreen>('topics');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback(() => {
    setTopicId(null);
    setStepIndex(0);
    setScreen('topics');
    setMinimized(false);
    setActive(true);
  }, []);

  const selectTopic = useCallback((nextTopicId: string) => {
    setTopicId(nextTopicId);
    setStepIndex(0);
    setScreen('lesson');
    setMinimized(false);
    setActive(true);
  }, []);

  const showTopics = useCallback(() => {
    setTopicId(null);
    setStepIndex(0);
    setScreen('topics');
    setMinimized(false);
  }, []);

  const previousStep = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(index => index - 1);
    } else {
      setTopicId(null);
      setScreen('topics');
    }
  }, [stepIndex]);

  const nextStep = useCallback(() => {
    const topic = APP_TOUR_TOPICS.find(item => item.id === topicId);
    if (!topic) {
      setTopicId(null);
      setScreen('topics');
      return;
    }
    if (stepIndex < topic.steps.length - 1) {
      setStepIndex(index => index + 1);
    } else {
      setTopicId(null);
      setStepIndex(0);
      setScreen('topics');
    }
  }, [stepIndex, topicId]);

  const minimizeTour = useCallback(() => setMinimized(true), []);
  const resumeTour = useCallback(() => setMinimized(false), []);
  const endTour = useCallback(() => {
    setActive(false);
    setMinimized(false);
    setTopicId(null);
    setStepIndex(0);
    setScreen('topics');
  }, []);

  const value = useMemo(() => ({
    active,
    minimized,
    screen,
    topicId,
    stepIndex,
    startTour,
    selectTopic,
    showTopics,
    previousStep,
    nextStep,
    minimizeTour,
    resumeTour,
    endTour,
  }), [
    active, minimized, screen, topicId, stepIndex, startTour, selectTopic, showTopics,
    previousStep, nextStep, minimizeTour, resumeTour, endTour,
  ]);

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

export function useAppTour() {
  const context = useContext(AppTourContext);
  if (!context) throw new Error('useAppTour must be used inside AppTourProvider');
  return context;
}
