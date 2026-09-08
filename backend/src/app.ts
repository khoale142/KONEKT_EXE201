import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

export function createApp() {
  const app = express();

  // crossOriginResourcePolicy: false cho phép frontend (vd: localhost:5173) load ảnh từ backend (localhost:3000)
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use("/uploads", express.static("uploads"));
  app.use(morgan("dev"));

  // Serve uploaded files as static
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}