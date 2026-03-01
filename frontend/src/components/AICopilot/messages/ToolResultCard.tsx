/**
 * ToolResultCard — Router that dispatches to the correct service card by toolName.
 *
 * V2 card variants are currently hardcoded ON for testing.
 * To revert: change `const isV2 = true` back to `useFeatureFlag('copilot-cards-v2')`.
 * The rca_identify tool always renders RootCauseCard (no V1 equivalent).
 */

import { ChatMessage } from '../../../hooks/useAICopilot';
// V2 hardcoded ON for testing — to revert: uncomment and use in place of `const isV2 = true`
// import { useFeatureFlag } from '../../../hooks/useFeatureFlag';

// V1 cards
import JiraIssueCard from '../cards/JiraIssueCard';
import JiraSearchCard from '../cards/JiraSearchCard';
import GitHubCommitCard from '../cards/GitHubCommitCard';
import GitHubPRCard from '../cards/GitHubPRCard';
import JenkinsStatusCard from '../cards/JenkinsStatusCard';
import ConfluenceDocCard from '../cards/ConfluenceDocCard';
import MetricsCard from '../cards/MetricsCard';
import PredictionCard from '../cards/PredictionCard';
import GenericResultCard from '../cards/GenericResultCard';
import GiphyEmbedCard from '../cards/GiphyEmbedCard';
import RetryCard from '../cards/RetryCard';
import HousekeepingCard from '../cards/HousekeepingCard';

// New + V2 cards
import RootCauseCard from '../cards/RootCauseCard';
import GitHubPRCardV2 from '../cards/v2/GitHubPRCardV2';
import HousekeepingCardV2 from '../cards/v2/HousekeepingCardV2';

interface ToolResultCardProps {
    message: ChatMessage;
    userRole: string;
    onAction?: (prompt: string, sourceMessageId: string) => void;
}

export default function ToolResultCard({ message, userRole, onAction }: ToolResultCardProps) {
    // Hardcoded ON for testing — to revert: const isV2 = useFeatureFlag('copilot-cards-v2');
    const isV2 = true;
    const { toolName, toolData, content, id, cardState } = message;

    const handleAction = (prompt: string) => {
        onAction?.(prompt, id);
    };

    // If no structured data, fall back to generic
    if (!toolData) {
        return <GenericResultCard toolName={toolName} summary={content} />;
    }

    // rca_identify always uses RootCauseCard (no V1 equivalent)
    if (toolName === 'rca_identify') {
        return <RootCauseCard data={toolData} />;
    }

    // V2 feature-flagged overrides
    if (isV2) {
        switch (toolName) {
            case 'github_get_pr':
                return <GitHubPRCardV2 data={toolData} onAction={handleAction} cardState={cardState} />;
            case 'jira_link_issues':
            case 'jira_add_label':
                return <HousekeepingCardV2 data={toolData} toolName={toolName || ''} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        }
    }

    // V1 switch (unchanged)
    switch (toolName) {
        case 'jira_get':
            return <JiraIssueCard data={toolData} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        case 'jira_search':
            return <JiraSearchCard results={toolData as unknown as Record<string, unknown>[]} userRole={userRole} onAction={handleAction} />;
        case 'github_get_commit':
            return <GitHubCommitCard data={toolData} />;
        case 'github_get_pr':
            return <GitHubPRCard data={toolData} onAction={handleAction} cardState={cardState} />;
        case 'confluence_search':
            return <ConfluenceDocCard results={toolData as unknown as Record<string, unknown>[]} />;
        case 'jenkins_get_status':
            return <JenkinsStatusCard data={toolData} />;
        case 'dashboard_metrics':
            return <MetricsCard data={toolData} />;
        case 'failure_predictions':
            return <PredictionCard data={toolData} />;
        // Sprint 7: New card types
        case 'giphy_search':
            return <GiphyEmbedCard data={toolData} />;
        case 'testrun_retry':
            return <RetryCard data={toolData} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        case 'jira_link_issues':
        case 'jira_add_label':
            return <HousekeepingCard data={toolData} toolName={toolName || ''} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        default:
            return <GenericResultCard toolName={toolName} summary={content} data={toolData} />;
    }
}
