import passport from 'passport';
import { Strategy as SamlStrategy, type VerifyWithoutRequest } from '@node-saml/passport-saml';
import { UserRole } from '../constants';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

export class PassportService {
    constructor() {
        this.initialize();
    }

    private initialize() {
        if (!config.sso.enabled) {
            logger.info('SSO is disabled');
            return;
        }

        // Serialize user for the session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        passport.serializeUser((user: any, done) => {
            done(null, user.id);
        });

        // Deserialize user from the session
        passport.deserializeUser(async (id: string, done) => {
            try {
                const user = await prisma.user.findUnique({ where: { id } });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                done(null, user as any);
            } catch (error) {
                done(error);
            }
        });

        // Configure SAML Strategy
        if (config.sso.saml) {
            logger.info('Initializing SAML Strategy');

            const verifyCallback: VerifyWithoutRequest = async (profile, done) => {
                try {
                    const email = profile?.email as string | undefined;
                    if (!email) {
                        return done(new Error('SAML profile missing email'));
                    }

                    logger.info(`SAML Login attempt for: ${email}`);

                    // JIT Provisioning
                    let user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user) {
                        logger.info(`Creating JIT user for: ${email}`);
                        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
                        const hashedPassword = await bcrypt.hash(randomPassword, 10);

                        user = await prisma.user.create({
                            data: {
                                email,
                                firstName: (profile?.firstName as string) || (profile?.nameID as string) || 'SSO User',
                                lastName: (profile?.lastName as string) || '',
                                password: hashedPassword,
                                role: UserRole.USER,
                            },
                        });
                    }

                    return done(null, user as Record<string, unknown>);
                } catch (error) {
                    logger.error('SAML verify callback failed', error);
                    return done(error as Error);
                }
            };

            const strategy = new SamlStrategy(
                {
                    callbackUrl: '/api/v1/auth/login/sso/saml/callback',
                    entryPoint: config.sso.saml.entryPoint,
                    issuer: config.sso.saml.issuer,
                    idpCert: config.sso.saml.cert,
                },
                verifyCallback,
                verifyCallback
            );
            // passport.use expects passport.Strategy but @node-saml/passport-saml uses
            // a different @types/express version — the runtime API is compatible
            passport.use(strategy as unknown as passport.Strategy);
        }
    }
}

export const passportService = new PassportService();
