export default async function handler(req: any, res: any) {
  try {
    const { default: app } = await import('../server/index');
    return app(req, res);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Vercel Serverless Boot Error',
      message: err?.message || String(err),
      stack: err?.stack
    });
  }
}
