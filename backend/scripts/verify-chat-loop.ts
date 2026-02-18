
import axios from 'axios';
import { EventSource } from 'eventsource';

const API_URL = 'http://localhost:4000/api/v1';

async function main() {
    try {
        const email = 'verify-loop@testops.ai';
        const password = 'Password123!';
        const firstName = 'Loop';
        const lastName = 'Verifier';

        console.log('Checking backend health...');
        try {
            await axios.get('http://localhost:4000/health');
            console.log('✅ Backend is healthy.');
        } catch (e: any) {
            console.error('❌ Backend is UNHEALTHY:', e.message);
            process.exit(1);
        }

        console.log('0. Registering/Logging in...');
        try {
            await axios.post(`${API_URL}/auth/register`, {
                email, password, firstName, lastName
            });
            console.log('✅ Registered new user.');
        } catch (error: any) {
            console.log('Registration Error Details:', JSON.stringify(error.response?.data || {}, null, 2));
            if (error.response?.status === 409 || error.response?.data?.message?.includes('already registered')) {
                console.log('ℹ️ User already exists, proceeding to login.');
            } else {
                console.warn('⚠️ Registration warning:', error.response?.data?.message || error.message);
            }
        }

        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
        });

        console.log('Login Response Keys:', Object.keys(loginRes.data));
        const token = loginRes.data.token || loginRes.data.accessToken;

        if (!token) {
            throw new Error('No token returned from login');
        }

        const sessionId = 'test-session-' + Date.now();
        console.log(`✅ Logged in. Token: ${token.substring(0, 20)}...`);

        console.log(`2. Connecting to Chat SSE (Session: ${sessionId})...`);
        const es = new EventSource(`${API_URL}/ai/chat?sessionId=${sessionId}&token=${token}`);

        es.onopen = () => {
            console.log('✅ SSE Connected.');
            // Send the message once connected
            sendMessage(token, sessionId);
        };

        es.onmessage = (event) => {
            console.log('📩 Received Event:', event.type, event.data);
            if (event.data.includes('confirmation_request')) {
                console.log('🎉 SUCCESS: Received confirmation request!');
                es.close();
                process.exit(0);
            }
        };

        es.addEventListener('tool_call', (event: any) => {
            console.log('🔧 Tool Call:', event.data);
        });

        es.addEventListener('confirmation_request', (event: any) => {
            console.log('🎉 SUCCESS: Received confirmation request:', event.data);
            es.close();
            process.exit(0);
        });

        es.addEventListener('error', (event: any) => {
            console.log('🚨 SSE Error:', event);
            // Don't exit immediately, might be temporary?
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            console.error('❌ Timeout waiting for confirmation.');
            es.close();
            process.exit(1);
        }, 15000);

    } catch (error: any) {
        console.error('❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

async function sendMessage(token: string, sessionId: string) {
    try {
        console.log('3. Sending Message: "Create a Jira ticket for the last failure"');
        await axios.post(`${API_URL}/ai/chat/message`, {
            message: "Create a Jira ticket for the last failure",
            sessionId
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Message sent.');
    } catch (error: any) {
        console.error('❌ Failed to send message:', error.response?.data || error.message);
    }
}

main();
