import React from 'react';
import { BlankPageTool } from './BlankPageTool';
import { ResumeSessionTool } from './ResumeSessionTool';
import { GlobalSettings } from './GlobalSettings';
import { NarrativeChallengeTool } from './NarrativeChallengeTool';
import { BibleSearchTool } from './BibleSearchTool';
import { NarrativeAnalysisTool } from './NarrativeAnalysisTool';
import { LexicalAnalysisTool } from './LexicalAnalysisTool';
import { MapVerificationTool } from './MapVerificationTool';
import { StyleProfileTool } from './StyleProfileTool';
import { ChapterSummaryTool } from './ChapterSummaryTool';
import { ForgottenCharacterTool } from './ForgottenCharacterTool';
import { EndBookReviewTool } from './EndBookReviewTool';
import { MapEditorTool } from './MapEditorTool';

interface AIPanelProps {
  editorText: string;
  autoTriggerResume?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ editorText, autoTriggerResume }) => {
  return (
    <div className="w-96 h-screen bg-gray-50 dark:bg-slate-950 flex flex-col border-l border-gray-200 dark:border-slate-800 transition-colors duration-300">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">SCRIPTOR IA</h1>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <GlobalSettings />
        <BibleSearchTool />
        <BlankPageTool editorText={editorText} />
        <NarrativeChallengeTool />
        <ChapterSummaryTool editorText={editorText} />
        <NarrativeAnalysisTool editorText={editorText} />
        <LexicalAnalysisTool editorText={editorText} />
        <ForgottenCharacterTool editorText={editorText} />
        <MapEditorTool />
        <MapVerificationTool editorText={editorText} />
        <ResumeSessionTool editorText={editorText} autoTrigger={autoTriggerResume} />
        <StyleProfileTool />
        <EndBookReviewTool editorText={editorText} />
      </div>
    </div>
  );
};
