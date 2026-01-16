import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
// @ts-ignore - Express types issue with ESNext modules
import express from "express";
import rateLimit from "express-rate-limit";
import { connectDatabase } from "./Database/Mongoose";
import dotenv from "dotenv";

// Load .env.local first, then .env (local takes precedence)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); // This will load .env but won't override .env.local values
import { AppConfig, ValidatAppConfig } from "./config/app.config";
import Allversion from "./Router/index";
import crypto from 'crypto'
import  {type Request , type Response , type NextFunction}  from 'express'
import cookieParser from 'cookie-parser'
import http from "http";
import cors from 'cors'
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
 



// import session from "express-session";
// import { SessionEntity } from "./entity/Session";


const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Socket.io authentication and connection handling
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, AppConfig.JwtSecret) as any;
    socket.data.userId = decoded.id;
    socket.data.userRole = decoded.role;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const userRole = socket.data.userRole;

  if (userRole === "supplier") {
    // Join supplier room for notifications
    socket.join(`supplier_${userId}`);
    console.log(`Supplier ${userId} connected to socket`);
  } else if (userRole === "client") {
    // Join client room for notifications
    socket.join(`client_${userId}`);
    console.log(`Client ${userId} connected to socket`);
  } else if (userRole === "admin") {
    // Join admin room for notifications
    socket.join("admin");
    console.log(`Admin ${userId} connected to socket`);
  }

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
});


const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Type", "Authorization"],
};


app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.static('uploads/images'));
app.use(express.static("uploads/pdf"));
app.use(express.static("uploads/video"));
app.use(express.static("uploads/documents"));
app.use(express.static("uploads/excel"));
app.use(express.static("uploads/products/images"));
app.use(express.static("uploads/products/videos"));
app.use(express.static("uploads/payments"));
// Ensure upload directories exist
const uploadDirs = [
  "uploads/images",
  "uploads/pdf",
  "uploads/video",
  "uploads/documents",
  "uploads/excel",
  "uploads/products/images",
  "uploads/products/videos",
  "uploads/profile",
  "uploads/profile-images",
  "uploads/payments",
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

app.use(express.static("uploads/profile"));
app.use(express.static("uploads/profile-images"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({extended:true , limit:'100mb'}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);


// app.get('/test' , (req:Request , res:Response)=>{


//   const newPar = new UAParser(req.headers["user-agent"]);
//   const result = newPar.getResult()
//   logInfo.info({
//     ip : req.ip ,
//     browser : result.browser.name ,
//     device : result.os.name , 
//     date : `${new Date().getHours()}:${new Date().getMinutes() < 10 ?`0${new Date().getMinutes()}`:new Date().getMinutes() }`
//   })
// })





app.use((req: Request, res: Response, next: NextFunction) => {
   res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
   next()
})


app.use(morgan("dev"));
app.use(helmet.hidePoweredBy());
app.use(helmet.ieNoOpen());
app.use(helmet.hsts());



app.use(
  helmet.contentSecurityPolicy({
    directives: {
      default: ["'self'"],
      scriptSrc: [
        "'self'",
        "'strict-dynamic'",
        (req, res) =>
          `'nonce-${(res as Response & { locals: any }).locals.cspNonce}'`,
        "https:",
      ],
    },
  })
);




app.use(
  rateLimit({
    limit: 80,
    windowMs: 60 * 1000,
    message: "Is To mush",
    legacyHeaders: false,
    standardHeaders: false,
  })
);



app.use('/api' , Allversion)


ValidatAppConfig(async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Set Socket.io instance in controllers
    const { setSocketIO: setSocketIOCommande } = await import("./Module/Commande/Commande.controller");
    setSocketIOCommande(io);
    
    const { setSocketIO: setSocketIOClient } = await import("./Module/Client/Client.controller");
    setSocketIOClient(io);

    // Run Server
    server.listen(AppConfig.PORT, () => {
      console.log("server is runing on port ", AppConfig.PORT);
    });
  } catch (err: unknown) {
    console.log('Error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Unknown error occurred');
  }
});
