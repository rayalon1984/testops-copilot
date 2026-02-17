/**
 * AICopilot — Agentic Command Center Sidebar
 *
 * A premium, always-visible sidebar that demonstrates the agentic capabilities:
 * - Root Cause Analysis (Insights)
 * - Automated Fixes (Actions)
 * - Integration Management (Jira/GitHub)
 *
 * SIMULATION MODE: Renders static "Smart Cards" to demonstrate the Agentic Flow.
 */

import { useState, useRef, KeyboardEvent } from 'react';
import { Box } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import './AICopilot.css';

export default function AICopilot() {
    const [input, setInput] = useState('');
    const { user } = useAuth(); // Ready for dynamic role-based logic

    // Placeholder for interaction
    const handleSend = () => {
        if (!input.trim()) return;
        // In a real implementation, this would trigger the ReAct loop
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <aside className="copilot-sidebar">
            <header className="copilot-header">
                <h3>✨ TestOps Copilot</h3>
                {user?.role === 'ADMIN' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                        ADMIN MODE
                    </span>
                )}
            </header>

            <div className="chat-stream">
                {/* Simulated User Message */}
                <div className="message user" style={{ alignSelf: 'flex-end', marginBottom: '10px', maxWidth: '85%' }}>
                    <div style={{ background: '#333', padding: '8px 16px', borderRadius: '16px', color: '#fff', fontSize: '0.9rem' }}>
                        Analyze the failure in payment-service
                    </div>
                </div>

                {/* Smart Cards Stack (Simulation) */}
                <div className="cards-stack">

                    {/* Insight Card */}
                    <div className="smart-card type-insight">
                        <div className="card-left-strip"></div>
                        <div className="card-content">
                            <div className="card-header">
                                <span>🧠</span> <span>Root Cause Analysis</span>
                            </div>
                            <p className="card-body">
                                The <strong>tax_calculation_test</strong> failed due to a timeout (2000ms exceeded). This matches a known flaky pattern in the Staging environment.
                            </p>
                        </div>
                    </div>

                    {/* Action Card */}
                    <div className="smart-card type-action">
                        <div className="card-left-strip"></div>
                        <div className="card-content">
                            <div className="card-header">
                                <span>🛠️</span> <span>Fix Proposed: PR #402</span>
                            </div>
                            <div className="code-preview">
                                config/timeout.js<br />
                                <span style={{ color: '#ef4444' }}>- timeout: 2000</span><br />
                                <span style={{ color: '#10b981' }}>+ timeout: 5000 // Increased for stability</span>
                            </div>
                            <div className="card-actions">
                                <button className="btn btn-secondary">Review Diff</button>
                                <button className="btn btn-primary">Merge PR</button>
                            </div>
                        </div>
                    </div>

                    {/* Integration Card */}
                    <div className="smart-card type-integration">
                        <div className="card-left-strip"></div>
                        <div className="card-content">
                            <div className="card-header">
                                <span>⚡</span> <span>Jira Housekeeping</span>
                            </div>
                            <p className="card-body">
                                Linked 3 duplicate tickets to <strong>PROJ-1247</strong>.
                            </p>
                            <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '4px' }}>
                                IN PROGRESS
                            </span>
                        </div>
                    </div>

                </div>
            </div>

            <div className="input-area">
                <input
                    className="input-box"
                    type="text"
                    placeholder="Ask Copilot to fix, deploy, or analyze..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </aside>
    );
}
