import express from 'express';
import cors from 'cors';
import router from './routes';

const app = express();
const PORT = process.env.PORT;

const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(router);

app.listen(PORT, () =>
  console.log(`[SSE] Сервер событий стартовал на http://localhost:${PORT}`)
);
