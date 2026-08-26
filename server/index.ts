import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './db/database';

import authRoutes from './routes/authRoutes';
import tableRoutes from './routes/tableRoutes';
import menuRoutes from './routes/menuRoutes';
import orderRoutes from './routes/orderRoutes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust first proxy hop when behind Nginx / Caddy / Cloudflare / Vercel
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible SPA inline styles and image assets
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, same-origin, curl) or if origin is in whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-table-session']
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure database tables and initial records exist before handling API requests
app.use('/api', async (req, res, next) => {
  try {
    await initDatabase();
  } catch (err) {
    console.warn('[DB AutoInit Note]:', err);
  }
  next();
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount API Modules
app.use('/api/auth', authRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// In production standalone mode, serve frontend client build
const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
app.use(express.static(clientDistPath));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If client build doesn't exist yet (in dev), return friendly status
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Cafe Booking & Ordering API</title></head>
          <body style="font-family: system-ui; padding: 2rem; background: #fdfbf7; color: #342218;">
            <h1>☕ Cafe Booking & Ordering API Server</h1>
            <p>API is running on port ${PORT}.</p>
            <p>Frontend development server runs on <a href="http://localhost:5173">http://localhost:5173</a>.</p>
          </body>
        </html>
      `);
    }
  });
});

// Central Global Error Handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]:', err);
  const isProd = process.env.NODE_ENV === 'production';
  const message = !isProd && err instanceof Error ? err.message : undefined;
  res.status(500).json({ error: 'An unexpected server error occurred.', ...(message ? { message } : {}) });
});

// Export app for testing (Supertest) and Vercel Functions
export default app;

if (require.main === module && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`☕ Cafe Ordering Server running at http://localhost:${PORT}`);
  });
}
