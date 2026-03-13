import express from 'express';
import axios from 'axios';
import CircuitBreaker from './circuit-breaker.js';

const app = express();
const PORT = 3002;

const cb = new CircuitBreaker('post-to-recommendation', {
    failureThreshold: 3,
    timeout: 5000
});

app.get('/posts', async (req, res) => {
    const result = await cb.call(
        async () => {
            const response = await axios.get('http://localhost:3003/recommendations');
            return response.data;
        },
        () => {
            return { recommendations: [], note: 'Fallback: Recommendations currently unavailable' };
        }
    );

    console.log('[PostService] Returning posts with recommendations');
    res.json({
        posts: [
            { id: 1, content: 'Hello World', recommendations: result.recommendations }
        ],
        source: result.note ? 'fallback' : 'recommendation-service'
    });
});

app.listen(PORT, () => {
    console.log(`Post Service running on port ${PORT}`);
});
