import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import brandRoutes from './routes/brand';
import projectRoutes from './routes/projects';
import analyticsRoutes from './routes/analytics';
import teamRoutes from './routes/team';
import campaignRoutes from './routes/campaigns';
import departmentRoutes from './routes/departments';
import { initWebSocket } from './services/websocket';
import { connectDB } from './db/connection';
import { startContentWorker } from './jobs/workers/contentWorker';

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (auth is applied inside each router)
app.use('/api/content', contentRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/departments', departmentRoutes);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  initWebSocket(httpServer);

  if (process.env.RUN_WORKERS !== 'false') {
    startContentWorker();
  }

  httpServer.listen(PORT, () => {
    console.log(`MCAP API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
