/**
 * Share Service
 *
 * Generates shareable links for AI copilot analysis.
 * Recipients can view the analysis without authentication
 * via a time-limited URL-safe token.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/utils/logger';
import { formatShareEmail } from './channels/email-formatter';

// ─── Token Generation ───

/**
 * Generate a URL-safe random token (12 chars, ~72 bits of entropy).
 */
function generateToken(): string {
    return crypto.randomBytes(9).toString('base64url'); // 12 chars
}

// ─── DTOs ───

export interface CreateShareRequest {
    userId: string;
    title: string;
    content: string;       // Markdown of the analysis
    persona?: string;
    toolSummary?: Array<{ name: string; summary: string }>;
    sessionId?: string;
    expiresInDays?: number; // Default 7
}

export interface ShareResponse {
    id: string;
    token: string;
    url: string;
    expiresAt: string;
}

export interface SharedAnalysisView {
    title: string;
    content: string;
    persona?: string;
    toolSummary?: Array<{ name: string; summary: string }>;
    createdAt: string;
    expiresAt: string;
}

// ─── CRUD ───

/**
 * Create a new shared analysis link.
 */
export async function createShare(req: CreateShareRequest): Promise<ShareResponse> {
    const token = generateToken();
    const expiresInDays = req.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const record = await prisma.sharedAnalysis.create({
        data: {
            token,
            userId: req.userId,
            sessionId: req.sessionId,
            title: req.title,
            content: req.content,
            persona: req.persona,
            toolSummary: req.toolSummary ? JSON.stringify(req.toolSummary) : null,
            expiresAt,
        },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const url = `${appUrl}/shared/${token}`;

    logger.info(`[Share] Created share ${record.id} by ${req.userId}, expires ${expiresAt.toISOString()}`);

    return {
        id: record.id,
        token,
        url,
        expiresAt: expiresAt.toISOString(),
    };
}

/**
 * Get a shared analysis by token (public — no auth required).
 * Returns null if expired or not found.
 */
export async function getShareByToken(token: string): Promise<SharedAnalysisView | null> {
    const record = await prisma.sharedAnalysis.findUnique({
        where: { token },
    });

    if (!record) return null;

    // Check expiration
    if (record.expiresAt < new Date()) {
        return null;
    }

    // Increment view count (fire-and-forget)
    prisma.sharedAnalysis.update({
        where: { id: record.id },
        data: { viewCount: { increment: 1 } },
    }).catch(() => { /* non-critical */ });

    return {
        title: record.title,
        content: record.content,
        persona: record.persona || undefined,
        toolSummary: record.toolSummary ? JSON.parse(record.toolSummary) : undefined,
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt.toISOString(),
    };
}

/**
 * Share an analysis via email using existing nodemailer infrastructure.
 */
export async function shareViaEmail(
    shareUrl: string,
    title: string,
    content: string,
    recipientEmail: string,
    senderName?: string,
): Promise<boolean> {
    try {
        // Dynamic import to avoid circular dependency with NotificationService
        const nodemailer = await import('nodemailer');

        const host = process.env.EMAIL_HOST;
        const port = parseInt(process.env.EMAIL_PORT || '587', 10);
        const secure = process.env.EMAIL_SECURE === 'true';
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASSWORD;
        const from = process.env.EMAIL_FROM || 'TestOps Companion <noreply@testops.local>';

        if (!host) {
            logger.warn('[Share] Email not configured (EMAIL_HOST missing)');
            return false;
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined,
        });

        const html = formatShareEmail(title, content, shareUrl, senderName);

        await transporter.sendMail({
            from,
            to: recipientEmail,
            subject: `TestOps Analysis: ${title}`,
            text: `${senderName || 'A teammate'} shared an AI analysis with you: ${shareUrl}`,
            html,
        });

        logger.info(`[Share] Email sent to ${recipientEmail} for "${title}"`);
        return true;
    } catch (error) {
        logger.error('[Share] Email send failed:', error);
        return false;
    }
}

/**
 * Clean up expired shares (call periodically or via cron).
 */
export async function cleanupExpiredShares(): Promise<number> {
    const result = await prisma.sharedAnalysis.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
        logger.info(`[Share] Cleaned up ${result.count} expired shares`);
    }
    return result.count;
}
