import express from 'express';

const app = express();
const PORT = 3003;

let simulateFailure = false;

app.get('/recommendations', (req, res) => {
    if (simulateFailure) {
        console.log('[RecommendationService] Simulating failure...');
        return res.status(500).send('Database Error');
    }
    console.log('[RecommendationService] Returning recommendations');
    res.json({
        recommendations: ['Post 1', 'Post 2', 'Post 3']
    });
});

app.post('/toggle-failure', (req, res) => {
    simulateFailure = !simulateFailure;
    console.log(`[RecommendationService] simulateFailure toggled to: ${simulateFailure}`);
    res.send(`simulateFailure: ${simulateFailure}`);
});

app.listen(PORT, () => {
    console.log(`Recommendation Service running on port ${PORT}`);
});
