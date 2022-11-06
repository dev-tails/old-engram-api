import express from "express";
import Joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import bcryptjs from "bcryptjs";
import { config } from "./config";
import session from "express-session";
import MongoStore from "connect-mongo";
import { Client } from "../../database/client/src/Client";

async function run() {
  if (!config.sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }

  const client = new Client(config.dbUrl);
  const db = await client.connect();
  console.log(`Connected to: ${config.dbUrl}`);

  const User = db.User;
  // const AnalyticsEvent = db.collection("analyticsevents");

  // TODO: migrate notes to blocks
  const Block = db.Note;

  const app = express();

  app.use(express.json());

  // app.use(
  //   session({
  //     secret: config.sessionSecret,
  //     resave: false,
  //     cookie: {
  //       sameSite: "none",
  //       secure: true
  //     },
  //     saveUninitialized: false,
  //     store: MongoStore.create({
  //       client,
  //     }),
  //   })
  // );

  const authOriginMiddleware = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", config.authOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  };

  app.get("/health", (req, res) => {
    res.sendStatus(200);
  });

  app.options("/u/*", authOriginMiddleware, (req, res) => {
    res.sendStatus(200);
  });

  app.post("/u/signup", authOriginMiddleware, async (req, res) => {
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
    const { insertedId } = await User.insertOne({
      email: value.email,
      password: hashedPassword,
    });
    (req.session as any).user = String(insertedId);

    res.sendStatus(200);
  });

  app.post("/u/login", authOriginMiddleware, async (req, res) => {
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
      (req.session as any).user = String(user._id);
      return res.sendStatus(200);
    } else {
      return res.sendStatus(400);
    }
  });

  app.get("/u/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.sendStatus(400);
      }
      res.sendStatus(200);
    });
  });

  const blockOriginMiddleware = (req, res, next) => {
    if (config.blockOrigins.includes(req.headers.origin || "")) {
      res.header("Access-Control-Allow-Origin", req.headers.origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
    }
    next();
  };

  app.options("/blocks", blockOriginMiddleware, (req, res) => {
    res.sendStatus(200);
  });

  app.post("/blocks", blockOriginMiddleware, async (req, res) => {
    const { user } = req.session as any;
    if (!user) {
      return res.sendStatus(400);
    }

    const blockSchema = Joi.object<{
      createdAt: Date;
      localId: string;
      body: string | undefined;
    }>({
      createdAt: Joi.date(),
      localId: Joi.string().required(),
      body: Joi.string(),
    });

    const { value, error } = blockSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error,
      });
    }

    await Block.insertOne({
      ...value,
      user,
    });
    res.sendStatus(200);
  });

  const analyticsOriginMiddleware = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );

    next();
  };

  app.options("/analytics-events", analyticsOriginMiddleware, (req, res) => {
    res.sendStatus(200);
  });

  // app.post("/analytics-events", analyticsOriginMiddleware, async (req, res) => {
  //   const analyticsEventSchema = Joi.object<{
  //     type: string;
  //     data: any;
  //   }>({
  //     type: Joi.string(),
  //     data: Joi.object(),
  //   });

  //   const { value, error } = analyticsEventSchema.validate(req.body);
  //   if (error) {
  //     return res.status(400).json({
  //       error,
  //     });
  //   }

  //   await AnalyticsEvent.insertOne(value);
  //   res.sendStatus(200);
  // });

  const server = app.listen(config.port);
  console.log("Server started on port", config.port);

  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received.");

    server.close(async () => {
      console.log("Server closed");

      console.log("Closing mongo connection");
      await client.close();
      console.log("Mongo connection closed");
    });
  });
}

run();
