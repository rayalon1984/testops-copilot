/**
 * OnboardingWizard — First-run setup experience.
 *
 * Guides new users through:
 * 1. Welcome + overview
 * 2. AI provider configuration
 * 3. Sample queries to try
 *
 * Shows on first login when localStorage has no 'onboardingComplete' flag.
 * Renders as a full-screen dialog overlay.
 */

import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Box, Typography, Button, Stepper, Step, StepLabel,
    Paper, Chip, LinearProgress,
} from '@mui/material';
import {
    AutoAwesome as SparkleIcon,
    Settings as SettingsIcon,
    Chat as ChatIcon,
    CheckCircle as DoneIcon,
    ArrowForward as NextIcon,
    ArrowBack as BackIcon,
} from '@mui/icons-material';

interface OnboardingWizardProps {
    open: boolean;
    onComplete: () => void;
}

const STEPS = ['Welcome', 'AI Setup', 'Try It'];

const SAMPLE_QUERIES = [
    { label: 'Analyze a failure', prompt: 'Analyze the most recent test failure and suggest a fix' },
    { label: 'Check pipeline status', prompt: 'What is the current status of all pipelines?' },
    { label: 'Search Jira issues', prompt: 'Search Jira for open issues related to recent failures' },
    { label: 'Show test trends', prompt: 'Show me failure trends for the past 30 days' },
];

export default function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
    const [activeStep, setActiveStep] = useState(0);

    const handleNext = (): void => {
        if (activeStep === STEPS.length - 1) {
            localStorage.setItem('onboardingComplete', 'true');
            onComplete();
        } else {
            setActiveStep(prev => prev + 1);
        }
    };

    const handleBack = (): void => {
        setActiveStep(prev => prev - 1);
    };

    const handleSkip = (): void => {
        localStorage.setItem('onboardingComplete', 'true');
        onComplete();
    };

    return (
        <Dialog
            open={open}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: 'hidden',
                },
            }}
        >
            {/* Progress bar */}
            <LinearProgress
                variant="determinate"
                value={((activeStep + 1) / STEPS.length) * 100}
                sx={{ height: 3 }}
            />

            <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 0 }}>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
                    {STEPS.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </DialogTitle>

            <DialogContent sx={{ px: 4, py: 2, minHeight: 320 }}>
                {activeStep === 0 && <WelcomeStep />}
                {activeStep === 1 && <AISetupStep />}
                {activeStep === 2 && <TryItStep />}
            </DialogContent>

            <DialogActions sx={{ px: 4, pb: 3, justifyContent: 'space-between' }}>
                <Button
                    size="small"
                    onClick={handleSkip}
                    sx={{ textTransform: 'none', color: 'text.secondary' }}
                >
                    Skip setup
                </Button>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {activeStep > 0 && (
                        <Button
                            onClick={handleBack}
                            startIcon={<BackIcon />}
                            sx={{ textTransform: 'none' }}
                        >
                            Back
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        onClick={handleNext}
                        endIcon={activeStep === STEPS.length - 1 ? <DoneIcon /> : <NextIcon />}
                        sx={{ textTransform: 'none' }}
                    >
                        {activeStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

// ─── Step Components ─────────────────────────────────────────────────

function WelcomeStep(): React.ReactElement {
    return (
        <Box sx={{ textAlign: 'center' }}>
            <SparkleIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
                Welcome to TestOps Copilot
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                Your AI-powered testing companion. Get root cause analysis, manage Jira issues,
                check pipeline health, and more — all from a conversational interface.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mt: 3 }}>
                {[
                    { icon: '22', label: 'AI Tools', desc: 'Jira, GitHub, Jenkins' },
                    { icon: '9', label: 'Personas', desc: 'Specialist routing' },
                    { icon: '3', label: 'Autonomy Tiers', desc: 'Graduated AI control' },
                ].map((item) => (
                    <Paper key={item.label} variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                        <Typography variant="h5" fontWeight={700} color="primary.main">
                            {item.icon}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} display="block">
                            {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {item.desc}
                        </Typography>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
}

function AISetupStep(): React.ReactElement {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                    Configure AI Provider
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                The AI Copilot works with multiple providers. You can start with Demo Mode
                (no API key needed) or connect your own provider.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                    {
                        name: 'Demo Mode',
                        desc: 'Try the copilot with mock responses — no API key required',
                        tag: 'Recommended to start',
                        highlight: true,
                    },
                    {
                        name: 'Anthropic (Claude)',
                        desc: 'Best quality responses with Claude Opus/Sonnet models',
                        tag: 'Best quality',
                        highlight: false,
                    },
                    {
                        name: 'OpenAI (GPT-4)',
                        desc: 'GPT-4o and GPT-4.1 models for fast, capable responses',
                        tag: null,
                        highlight: false,
                    },
                ].map((provider) => (
                    <Paper
                        key={provider.name}
                        variant="outlined"
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            borderColor: provider.highlight ? 'primary.main' : 'divider',
                            bgcolor: provider.highlight ? 'action.hover' : 'transparent',
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    {provider.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {provider.desc}
                                </Typography>
                            </Box>
                            {provider.tag && (
                                <Chip label={provider.tag} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                            )}
                        </Box>
                    </Paper>
                ))}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                You can change the provider anytime from the AI chip in the Copilot header, or in Settings.
            </Typography>
        </Box>
    );
}

function TryItStep(): React.ReactElement {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ChatIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                    Sample Queries
                </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Here are some things you can ask the Copilot. Click any to try it after setup!
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {SAMPLE_QUERIES.map((q) => (
                    <Paper
                        key={q.label}
                        variant="outlined"
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            transition: 'all 0.15s ease',
                            cursor: 'default',
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25 }}>
                            {q.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            &ldquo;{q.prompt}&rdquo;
                        </Typography>
                    </Paper>
                ))}
            </Box>
        </Box>
    );
}
