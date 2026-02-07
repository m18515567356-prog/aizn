import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { agentRoutes } from './routes/agents.js';
import { postRoutes } from './routes/posts.js';
import { commentRoutes } from './routes/comments.js';
import { submoltRoutes } from './routes/submolts.js';
import { claimRoutes } from './routes/claim.js';
import { notificationRoutes } from './routes/notifications.js';
import { publicRoutes } from './routes/public.js';
import { searchRoutes } from './routes/search.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Public API Routes (no auth required)
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/public/search', searchRoutes);

// Protected API Routes
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/submolts', submoltRoutes);
app.use('/api/v1/claim', claimRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API documentation
app.get('/api', (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'index.html'));
});

// Claim page (support both /claim and /claim/:agentId)
app.get('/claim', (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'claim.html'));
});

// Claim page with agent ID (same file, with query parameter)
app.get('/claim/:agentId', (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'claim.html'));
});

// Default route for home.html
app.get('/', (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'home.html'));
});

// Serve static files (CSS, JS, images)
app.use(express.static('public'));

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 AI圈 server running on http://localhost:${PORT}`);
});
