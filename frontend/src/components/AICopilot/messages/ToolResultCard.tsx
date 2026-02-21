/**
 * ToolResultCard — Router that dispatches to the correct service card by toolName.
 */

import { ChatMessage } from '../../../hooks/useAICopilot';
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
