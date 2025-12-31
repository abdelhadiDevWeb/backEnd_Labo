import { DataSource } from "typeorm";
import "reflect-metadata";
import "dotenv/config";

export const AppDataSource = new DataSource({
  type: "mongodb",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "27017"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: "labo",
  synchronize: process.env.NODE_ENV !== "production", // Auto-sync schema in development
  logging: process.env.NODE_ENV === "development",
  entities: [__dirname + "/../entity/**/*.ts", __dirname + "/../entity/**/*.js"],
  migrations: [__dirname + "/../migrations/**/*.ts", __dirname + "/../migrations/**/*.js"],
  subscribers: [__dirname + "/../subscribers/**/*.ts", __dirname + "/../subscribers/**/*.js"],
});

