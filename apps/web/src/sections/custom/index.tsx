import type { ComponentType } from "react";
import { Forecaster } from "./Forecaster.tsx";
import { ChannelResult, SearchDemand, PrinciplesCards, Diagnose, LanguageBank, CurrentHeadline, CompetitorMessages } from "./PartOne.tsx";
import { FormQuestions, PageLinks, TrackingEvidence, NurtureMessages, NurtureWrite } from "./PartTwo.tsx";
import { AdIdeas, AdsRunning, Scripts, TalkingPoints } from "./PartThree.tsx";
import { PreLaunch, GoogleKeywords, GoogleAds, GoogleBudgetCheck, AudienceRules, CloseOptions, CallSheet, PracticeCall, Bottlenecks, Playbook, WorkbookComplete } from "./PartFourToSix.tsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CUSTOM: Record<string, ComponentType<any>> = {
  ChannelResult,
  SearchDemand,
  Forecaster,
  PrinciplesCards,
  Diagnose,
  LanguageBank,
  CurrentHeadline,
  CompetitorMessages,
  FormQuestions,
  PageLinks,
  TrackingEvidence,
  NurtureMessages,
  NurtureWrite,
  AdIdeas,
  AdsRunning,
  Scripts,
  TalkingPoints,
  PreLaunch,
  GoogleKeywords,
  GoogleAds,
  GoogleBudgetCheck,
  AudienceRules,
  CloseOptions,
  CallSheet,
  PracticeCall,
  Bottlenecks,
  Playbook,
  WorkbookComplete,
};
