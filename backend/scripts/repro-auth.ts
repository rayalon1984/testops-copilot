
import axios from 'axios';

async function main() {
    console.log('--- Auth Reproduction Script ---');
    const url = 'http://localhost:4000/api/v1/auth/login';
    console.log(`Target: ${url}`);

    try {
        console.log('Attempting login...');
        const response = await axios.post(url, {
            email: 'test-agent@example.com',
            password: 'password'
        }, {
            timeout: 5000
        });

        console.log('Login Success!', response.status);
        console.log('Headers:', response.headers);
    } catch (error: any) {
        console.error('Login Failed!');
        if (error.code) {
            console.error('Error Code:', error.code); // Look for ECONNRESET
        }
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

main();
