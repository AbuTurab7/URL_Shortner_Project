// src/middlewares/verify.auth.js
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from "../config/constant.js";
import {
  createAccessToken,
  createRefreshToken,
  createSession,
  refreshTokens,
  verifyToken,
} from "../services/auth.services.controller.js";

export const verifyAuthentication = async (req, res, next) => {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  req.user = null;

  if (!accessToken && !refreshToken) {
    return next();
  }

  if (accessToken) {
    try {
      const decodedToken = verifyToken(accessToken);
      req.user = decodedToken;
      return next();
    } catch (err) {
      // invalid access token -> try refresh token flow (if present)
    }
  }

  if (refreshToken) {
    try {
      const { newAccessToken, newRefreshToken, user } = await refreshTokens(
        refreshToken
      );
      if (user) {
        req.user = user;
        const baseConfig = { httpOnly: true, secure: true };

        res.cookie("access_token", newAccessToken, {
          ...baseConfig,
          maxAge: ACCESS_TOKEN_EXPIRY,
        });

        res.cookie("refresh_token", newRefreshToken, {
          ...baseConfig,
          maxAge: REFRESH_TOKEN_EXPIRY,
        });
      }
      return next();
    } catch (error) {
      console.log("refreshTokens error:", error?.message ?? error);
    }
  }

  return next();
};

export const authenticateUser = async ({ req, res, user, name, email }) => {
  const session = await createSession(user.id, {
    ip: req.clientIp,
    userAgent: req.headers["user-agent"],
  });

  const accessToken = createAccessToken({
    id: user.id,
    name: name ?? user.name,
    email: email ?? user.email,
    isEmailValid: Boolean(user.is_email_valid ?? user.isEmailValid),
    sessionId: session.id ?? session, // createSession returns object or id depending on impl
  });

  const refreshToken = createRefreshToken(session.id ?? session);

  const baseConfig = { httpOnly: true, secure: true, sameSite: "lax" };

  res.cookie("access_token", accessToken, {
    ...baseConfig,
    maxAge: ACCESS_TOKEN_EXPIRY,
  });

  res.cookie("refresh_token", refreshToken, {
    ...baseConfig,
    maxAge: REFRESH_TOKEN_EXPIRY,
  });
};
