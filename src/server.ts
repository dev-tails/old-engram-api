import express from "express";
import Joi from "joi";
import { MongoClient } from "mongodb";
import bcryptjs from "bcryptjs";
import { config } from "./config";

async function run() {
  const client = new MongoClient(config.dbUrl);
  await client.connect();
  const db = client.db("engram");
  const User = db.collection("users");

  const app = express();

  app.use(express.json());

  app.options("/u/*", async(req, res) => {
    res.header("Access-Control-Allow-Origin", config.authOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.sendStatus(200);
  })

  app.post("/u/signup", async (req, res) => {
    const signupSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(64),
    });

    const { value, error } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error,
      });
    }

    const user = await User.findOne({
      email: value.email,
    });
    if (user) {
      return res.status(400).json({
        error: "User already exists with this email",
      });
    }

    const hashedPassword = await bcryptjs.hash(value.password, 10);
    await User.insertOne({
      email: value.email,
      password: hashedPassword,
    });

    res.sendStatus(200);
  });

  app.post("/u/login", async (req, res) => {
    const loginSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });

    const { value, error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error,
      });
    }

    const user = await User.findOne({
      email: value.email,
    });

    if (!user) {
      return res.sendStatus(400);
    }

    const passwordsMatch = await bcryptjs.compare(
      value.password,
      user.password
    );
    if (passwordsMatch) {
      return res.sendStatus(200);
    } else {
      return res.sendStatus(400);
    }
  });

  app.listen(config.port);
}

run();
