import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const API_BASE_URL = 'http://localhost:5000';

app.use(express.json());
app.use(express.static('public'));

// API middleware for making requests to the Python backend
async function makeRequest(method, endpoint, data = null, params = null) {
    try {
        const config = {
            method,
            url: `${API_BASE_URL}${endpoint}`,
            ...(data && { data }),
            ...(params && { params })
        };
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

// API Routes
app.post('/api/rooms', async (req, res) => {
    try {
        const response = await makeRequest('POST', '/api/enhanced/createRoom');
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { roomId, userName } = req.body;
        const response = await makeRequest('POST', '/api/enhanced/createUser', {
            roomId,
            userName
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const { userId } = req.query;
        const response = await makeRequest('GET', '/api/enhanced/getNextMovie', null, { userId });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/votes', async (req, res) => {
    try {
        const { userId, movieId, vote } = req.body;
        const response = await makeRequest('POST', '/api/enhanced/vote', {
            userId,
            movieId,
            vote
        });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        const { userId } = req.query;
        const response = await makeRequest('GET', '/api/enhanced/getRecommendations', null, { userId });
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
