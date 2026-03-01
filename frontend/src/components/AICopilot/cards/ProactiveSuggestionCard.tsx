/**
 * ProactiveSuggestionCard — AI-in-the-Loop suggestion card.
 *
 * Displays a proactive suggestion from the AI with primary + secondary
 * action buttons. The AI anticipates the user's next action and pre-fills
 * the tool arguments.
 *
 * Examples:
 *   - "No Jira issue found → [Create Issue] [Edit First]"
 *   - "Transient failure detected → [Retry Now] [Skip]"
 *   - "Related issues found → [Link Issues] [Dismiss]"
 *
 * For: proactive_suggestion SSE event (Sprint 6 — Autonomous AI)
 */

import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import {
    AutoFixHigh as SuggestionIcon,
    PlayArrow as ActionIcon,
    Close as DismissIcon,
} from '@mui/icons-material';

export interface ProactiveSuggestionData {
    suggestionId: string;
    tool: string;
    preparedArgs: Record<string, unknown>;
    reason: string;
    confidence: number;
    tier: 1 | 2;
    actionLabel: string;
    secondaryLabel?: string;
}

interface ProactiveSuggestionCardProps {
    suggestion: ProactiveSuggestionData;
    onAccept: (suggestion: ProactiveSuggestionData) => void;
    onDismiss: (suggestionId: string) => void;
    dismissed?: boolean;
    accepted?: boolean;
}

/** Tool-to-accent color mapping */
function getToolAccent(tool: string): string {
    if (tool.startsWith('jira_')) return '#0052CC';
    if (tool.startsWith('github_')) return '#238636';
    if (tool.startsWith('jenkins_')) return '#EF3D25';
    if (tool.startsWith('testrun_')) return '#FF9800';
    return '#58a6ff';
}

/** Tool name → human-readable label */
function getToolLabel(tool: string): string {
    const map: Record<string, string> = {
        jira_create_issue: 'Jira',
        jira_link_issues: 'Jira',
        jira_add_label: 'Jira',
        testrun_retry: 'Test Run',
        jenkins_trigger_build: 'Jenkins',
        github_merge_pr: 'GitHub',
        github_rerun_workflow: 'GitHub Actions',
    };
    return map[tool] || 'Action';
}

export default function ProactiveSuggestionCard({
    suggestion,
    onAccept,
    onDismiss,
    dismissed,
    accepted,
}: ProactiveSuggestionCardProps) {
    const accent = getToolAccent(suggestion.tool);
    const isResolved = dismissed || accepted;

    return (
        <Paper sx={{
            mb: 2,
            borderRadius: 2,
            overflow: 'hidden',
            border: 1,
            borderColor: 'divider',
            borderLeft: 3,
            borderLeftColor: accent,
            opacity: isResolved ? 0.6 : 1,
            transition: 'opacity 0.2s',
        }}>
            <Box sx={{ p: 1.5 }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                    <SuggestionIcon sx={{ fontSize: 16, color: accent }} />
                    <Typography variant="caption" fontWeight={600} sx={{ color: accent }}>
                        AI Suggestion
                    </Typography>
                    <Chip
                        label={getToolLabel(suggestion.tool)}
                        size="small"
                        sx={{
                            fontSize: '0.55rem',
                            height: 18,
                            bgcolor: `${accent}20`,
                            color: accent,
                            fontWeight: 600,
                        }}
                    />
                    {suggestion.confidence >= 0.8 && (
                        <Chip
                            label="High confidence"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.5rem', height: 16, color: 'text.secondary', borderColor: 'divider' }}
                        />
                    )}
                </Box>

                {/* Reason */}
                <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem', lineHeight: 1.5, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                    {suggestion.reason}
                </Typography>

                {/* Pre-filled args preview (for Jira create) */}
                {suggestion.tool === 'jira_create_issue' && !!suggestion.preparedArgs.summary && (
                    <Box sx={{
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        p: 1,
                        mb: 1,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                    }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                            Summary:
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {String(suggestion.preparedArgs.summary)}
                        </Typography>
                        {Array.isArray(suggestion.preparedArgs.labels) && (
                            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                                {(suggestion.preparedArgs.labels as string[]).map((label: string) => (
                                    <Chip
                                        key={label}
                                        label={label}
                                        size="small"
                                        sx={{ fontSize: '0.5rem', height: 16 }}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                )}

                {/* Status messages */}
                {accepted && (
                    <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5 }}>
                        Action accepted — executing...
                    </Typography>
                )}
                {dismissed && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Dismissed
                    </Typography>
                )}

                {/* Action buttons */}
                {!isResolved && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
                        {suggestion.secondaryLabel && (
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<DismissIcon sx={{ fontSize: 12 }} />}
                                onClick={() => onDismiss(suggestion.suggestionId)}
                                sx={{ fontSize: '0.65rem', textTransform: 'none' }}
                            >
                                {suggestion.secondaryLabel}
                            </Button>
                        )}
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<ActionIcon sx={{ fontSize: 14 }} />}
                            onClick={() => onAccept(suggestion)}
                            sx={{
                                fontSize: '0.65rem',
                                textTransform: 'none',
                                bgcolor: accent,
                                '&:hover': { bgcolor: accent, filter: 'brightness(1.15)' },
                            }}
                        >
                            {suggestion.actionLabel}
                        </Button>
                    </Box>
                )}
            </Box>
        </Paper>
    );
}
