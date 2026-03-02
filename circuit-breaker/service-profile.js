import express from 'express';
import axios from 'axios';
import CircuitBreaker from './circuit-breaker.js';

const app = express();
const PORT = 3001;

const cb = new CircuitBreaker('profile-to-post', {
    failureThreshold: 3,
    timeout: 5000
});

app.get('/profile/:id', async (req, res) => {
    const userId = req.params.id;

    const result = await cb.call(
        async () => {
            const response = await axios.get('http://localhost:3002/posts');
            return response.data;
        },
        () => {
            return { posts: [], note: 'Fallback: Posts service currently unavailable' };
        }
    );

    console.log(`[ProfileService] Returning profile for user ${userId}`);
    res.json({
        user: { id: userId, name: 'Adarsh' },
        feed: result.posts,
        source: result.note ? 'fallback' : 'post-service'
    });
});

app.listen(PORT, () => {
    console.log(`Profile Service running on port ${PORT}`);
});
