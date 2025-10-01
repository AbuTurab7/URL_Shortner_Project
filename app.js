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

// 🔥 Debug error handlers
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

console.log("🚀 Starting app.js...");

const app = express();
app.set("view engine", "ejs");

// ✅ Fix dirname issue
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const staticPath = join(__dirname, "public");

app.use(express.static(staticPath));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Ensure SESSION_SECRET is always set
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

console.log("ENV PORT from Railway:", process.env.PORT);
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on PORT : ${PORT}`);
});
