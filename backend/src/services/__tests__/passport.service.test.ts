import { passportService } from '../passport.service';
import { prisma } from '../../lib/prisma';
import passport from 'passport';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}));

jest.mock('../../config', () => ({
    config: {
        sso: {
            enabled: true,
            saml: {
                entryPoint: 'http://mock-idp',
                issuer: 'mock-issuer',
                cert: 'mock-cert',
            },
        },
        log: {
            level: 'info',
        },
    },
}));

jest.mock('passport', () => ({
    use: jest.fn(),
    serializeUser: jest.fn(),
    deserializeUser: jest.fn(),
}));

jest.mock('@node-saml/passport-saml', () => ({
    Strategy: jest.fn().mockImplementation((options, verify) => {
        return { options, verify };
    }),
}));

const prismaMock = prisma as any;

describe('PassportService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Re-initialize to trigger strategy configuration
        (passportService as any).initialize();
    });

    it('should initialize SAML strategy if SSO is enabled', () => {
        expect(passport.use).toHaveBeenCalled();
    });

    describe('SAML Verify Callback', () => {
        let verifyCallback: (profile: any, done: (err: any, user?: any) => void) => void;

        beforeEach(() => {
            // Extract the verify callback passed to the Strategy constructor
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const StrategyMock = require('@node-saml/passport-saml').Strategy;
            const call = StrategyMock.mock.calls[0];
            if (call) {
                verifyCallback = call[1];
            }
        });

        it('should provision a new user (JIT) if they do not exist', async () => {
            const profile = {
                email: 'newuser@example.com',
                firstName: 'New',
                lastName: 'User',
            };
            const done = jest.fn();

            // Mock user not found
            prismaMock.user.findUnique.mockResolvedValue(null);
            // Mock user creation
            const newUser = { id: '123', email: profile.email, role: 'USER' };
            prismaMock.user.create.mockResolvedValue(newUser);

            if (verifyCallback) {
                await verifyCallback(profile, done);
            }

            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: profile.email } });
            expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    email: profile.email,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    role: 'USER',
                }),
            }));
            expect(done).toHaveBeenCalledWith(null, newUser);
        });

        it('should return existing user if they allow exist', async () => {
            const profile = { email: 'existing@example.com' };
            const done = jest.fn();
            const existingUser = { id: '456', email: profile.email };

            prismaMock.user.findUnique.mockResolvedValue(existingUser);

            if (verifyCallback) {
                await verifyCallback(profile, done);
            }

            expect(prismaMock.user.create).not.toHaveBeenCalled();
            expect(done).toHaveBeenCalledWith(null, existingUser);
        });
    });
});
