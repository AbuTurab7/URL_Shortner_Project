import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import router from "./Routes/shortner.routes.js";
import authRouter from "./Routes/auth.routes.js";
import cookieParser from "cookie-parser";
import { verifyAuthentication } from "./middlewares/verify-auth-middleware.js";
import flash from "connect-flash";
import session from "express-session";
import requestIp from "request-ip";

// 🔥 Debug crash handlers
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

console.log("🚀 Starting app.js...");

// ✅ Print critical env vars (don’t log secrets directly!)
console.log("✅ Node version:", process.version);
console.log("✅ NODE_ENV:", process.env.NODE_ENV || "not set");
console.log("✅ PORT:", process.env.PORT || "not set");
console.log("✅ SESSION_SECRET:", process.env.SESSION_SECRET ? "set ✅" : "❌ MISSING");
console.log("✅ DATABASE_URL:", process.env.DATABASE_URL ? "set ✅" : "❌ MISSING");
console.log("✅ MONGO_URI:", process.env.MONGO_URI ? "set ✅" : "❌ MISSING");
console.log("✅ MYSQL_URL:", process.env.MYSQL_URL ? "set ✅" : "❌ MISSING");
console.log("✅ PGHOST:", process.env.PGHOST ? "set ✅" : "❌ MISSING");

const app = express();
app.set("view engine", "ejs");

// ✅ Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const staticPath = join(__dirname, "public");

app.use(express.static(staticPath));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Ensure SESSION_SECRET always has a fallback
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: true,
    saveUninitialized: false,
  })
);

app.use(flash());
app.use(requestIp.mw());
app.use(verifyAuthentication);

app.use((req, res, next) => {
  res.locals.user = req.user;
  return next();
});

app.use(authRouter);
app.use(router);

// ✅ Test root route
app.get("/", (req, res) => {
  res.send("✅ URL Shortener backend is running");
});

// ✅ Bind to 0.0.0.0 for Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on PORT : ${PORT}`);
});
