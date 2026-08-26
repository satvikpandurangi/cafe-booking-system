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
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.VERCEL) {
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

// Health Check (Always returns 200 OK and reports Turso config status)
app.get(['/api/health', '/health'], (req, res) => {
  const hasTurso = Boolean(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: hasTurso ? 'turso_configured' : 'turso_missing',
    message: hasTurso 
      ? 'Database configured with Turso.' 
      : 'API is running. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel settings to activate database storage.'
  });
});

// Auto-initialize DB before API routes
app.use(async (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }
  try {
    await initDatabase();
    next();
  } catch (err: any) {
    console.error('[DB Initialization Error]:', err);
    res.status(503).json({
      error: 'Database not connected',
      message: err.message || 'Please configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel Environment Variables.'
    });
  }
});

// Mount API Modules (support both /api/* and /* paths on Vercel Functions)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/table', tableRoutes);
app.use('/table', tableRoutes);

app.use('/api/menu', menuRoutes);
app.use('/menu', menuRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

// In standalone local server mode, serve static client files if available
if (!process.env.VERCEL) {
  const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
  app.use(express.static(clientDistPath));

  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    const indexPath = path.join(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Cafe Booking & Ordering API</title></head>
            <body style="font-family: system-ui; padding: 2rem; background: #fdfbf7; color: #342218;">
              <h1>☕ Cafe Booking & Ordering API Server</h1>
              <p>API is running on port ${PORT}.</p>
            </body>
          </html>
        `);
      }
    });
  });
}

// Central Global Error Handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]:', err);
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: 'An unexpected server error occurred.', message });
});

// Export app for testing (Supertest) and Vercel Functions
export default app;

if (require.main === module && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`☕ Cafe Ordering Server running at http://localhost:${PORT}`);
  });
}
