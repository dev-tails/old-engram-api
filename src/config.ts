import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  dbUrl: process.env.DB_URL || "mongodb://localhost:27017/engram",
  authOrigin: process.env.AUTH_ORIGIN || "http://localhost:8080"
}