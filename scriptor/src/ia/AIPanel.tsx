import React from 'react';
import { BlankPageTool } from './BlankPageTool';
import { ResumeSessionTool } from './ResumeSessionTool';
import { GlobalSettings } from './GlobalSettings';
import { NarrativeChallengeTool } from './NarrativeChallengeTool';
import { BibleSearchTool } from './BibleSearchTool';
import { CharacterSearchTool } from './CharacterSearchTool';
import { NarrativeAnalysisTool } from './NarrativeAnalysisTool';
import { LexicalAnalysisTool } from './LexicalAnalysisTool';
import { MapVerificationTool } from './MapVerificationTool';
import { StyleProfileTool } from './StyleProfileTool';
import { ChapterSummaryTool } from './ChapterSummaryTool';
import { ForgottenCharacterTool } from './ForgottenCharacterTool';
import { EndBookReviewTool } from './EndBookReviewTool';
import { MapEditorTool } from './MapEditorTool';
import { MapSearchTool } from './MapSearchTool';

interface AIPanelProps {
  editorText: string;
  autoTriggerResume?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ editorText, autoTriggerResume }) => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="flex-shrink-0 border-b border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 transition-colors duration-300">
        <h1 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">STUDIO ROMAN IA</h1>
      </div>
      <div className="ai-panel-tools-scroll space-y-6 p-3">
        <GlobalSettings />
        <BibleSearchTool />
        <CharacterSearchTool />
        <MapSearchTool />
        <BlankPageTool editorText={editorText} />
        <NarrativeChallengeTool editorText={editorText} />
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
