/**
 * ToolResultCard — Router that dispatches to the correct service card by toolName.
 *
 * V2 cards are now the default (graduated from feature flag in v3.4.0).
 * RootCauseCard, GitHubPRCardV2, and HousekeepingCardV2 render unconditionally.
 */

import { ChatMessage } from '../../../hooks/useAICopilot';

// Service cards
import JiraIssueCard from '../cards/JiraIssueCard';
import JiraSearchCard from '../cards/JiraSearchCard';
import GitHubCommitCard from '../cards/GitHubCommitCard';
import JenkinsStatusCard from '../cards/JenkinsStatusCard';
import ConfluenceDocCard from '../cards/ConfluenceDocCard';
import MetricsCard from '../cards/MetricsCard';
import PredictionCard from '../cards/PredictionCard';
import GenericResultCard from '../cards/GenericResultCard';
import GiphyEmbedCard from '../cards/GiphyEmbedCard';
import RetryCard from '../cards/RetryCard';

// V2 cards (graduated — now the only card variants)
import RootCauseCard from '../cards/RootCauseCard';
import GitHubPRCardV2 from '../cards/v2/GitHubPRCardV2';
import HousekeepingCardV2 from '../cards/v2/HousekeepingCardV2';

// Xray cards (v3.4)
import XraySearchCard from '../cards/XraySearchCard';
import XrayHistoryCard from '../cards/XrayHistoryCard';

interface ToolResultCardProps {
    message: ChatMessage;
    userRole: string;
    onAction?: (prompt: string, sourceMessageId: string) => void;
}

export default function ToolResultCard({ message, userRole, onAction }: ToolResultCardProps) {
    const { toolName, toolData, content, id, cardState } = message;

    const handleAction = (prompt: string) => {
        onAction?.(prompt, id);
    };

    // If no structured data, fall back to generic
    if (!toolData) {
        return <GenericResultCard toolName={toolName} summary={content} />;
    }

    switch (toolName) {
        // V2 cards (graduated)
        case 'rca_identify':
            return <RootCauseCard data={toolData} />;
        case 'github_get_pr':
            return <GitHubPRCardV2 data={toolData} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        case 'jira_link_issues':
        case 'jira_add_label':
            return <HousekeepingCardV2 data={toolData} toolName={toolName || ''} userRole={userRole} onAction={handleAction} cardState={cardState} />;

        // Xray cards
        case 'xray_search':
            return <XraySearchCard data={toolData} />;
        case 'xray_test_case_history':
            return <XrayHistoryCard data={toolData} />;

        // Standard cards
        case 'jira_get':
            return <JiraIssueCard data={toolData} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        case 'jira_search':
            return <JiraSearchCard results={toolData as unknown as Record<string, unknown>[]} userRole={userRole} onAction={handleAction} />;
        case 'github_get_commit':
            return <GitHubCommitCard data={toolData} />;
        case 'confluence_search':
            return <ConfluenceDocCard results={toolData as unknown as Record<string, unknown>[]} />;
        case 'jenkins_get_status':
            return <JenkinsStatusCard data={toolData} />;
        case 'dashboard_metrics':
            return <MetricsCard data={toolData} />;
        case 'failure_predictions':
            return <PredictionCard data={toolData} />;
        case 'giphy_search':
            return <GiphyEmbedCard data={toolData} />;
        case 'testrun_retry':
            return <RetryCard data={toolData} userRole={userRole} onAction={handleAction} cardState={cardState} />;
        default:
            return <GenericResultCard toolName={toolName} summary={content} data={toolData} />;
    }
}
