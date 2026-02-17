import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { PrismaClient } from '@prisma/client';
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
        passport.serializeUser((user: any, done) => {
            done(null, user.id);
        });

        // Deserialize user from the session
        passport.deserializeUser(async (id: string, done) => {
            try {
                const user = await prisma.user.findUnique({ where: { id } });
                done(null, user as any);
            } catch (error) {
                done(error);
            }
        });

        // Configure SAML Strategy
        if (config.sso.saml) {
            logger.info('Initializing SAML Strategy');
            passport.use(
                new SamlStrategy(
                    {
                        path: '/api/v1/auth/login/sso/saml/callback',
                        entryPoint: config.sso.saml.entryPoint,
                        issuer: config.sso.saml.issuer,
                        cert: config.sso.saml.cert,
                        // Optional: map attributes if needed
                    },
                    async (profile: any, done: (error: any, user?: any, info?: any) => void) => {
                        try {
                            if (!profile.email) {
                                return done(new Error('SAML profile missing email'));
                            }

                            logger.info(`SAML Login attempt for: ${profile.email}`);

                            // JIT Provisioning
                            let user = await prisma.user.findUnique({
                                where: { email: profile.email },
                            });

                            if (!user) {
                                logger.info(`Creating JIT user for: ${profile.email}`);
                                // Basic JIT - Create user with default role
                                // Password is required by schema, but won't be used for SSO.
                                // We generate a random one securely or handle it otherwise.
                                // ideally SSO users shouldn't have a password or it should be nullable.
                                // For now, we'll generate a random unguessable string.
                                const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
                                const hashedPassword = await bcrypt.hash(randomPassword, 10);

                                user = await prisma.user.create({
                                    data: {
                                        email: profile.email,
                                        firstName: profile.firstName || profile.nameID || 'SSO User',
                                        lastName: profile.lastName || '',
                                        password: hashedPassword, // Dummy password
                                        role: UserRole.USER, // Default role
                                    },
                                });
                            }

                            return done(null, user as any);
                        } catch (error) {
                            logger.error('SAML verify callback failed', error);
                            return done(error);
                        }
                    }
                ) as any
            );
        }
    }
}

export const passportService = new PassportService();
