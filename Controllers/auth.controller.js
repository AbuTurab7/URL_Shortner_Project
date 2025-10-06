// src/controllers/auth.controller.js
import {
  authenticateUser,
} from "../middlewares/verify-auth-middleware.js";
import {
  createUser,
  getUserByEmail,
  getHashPassword,
  comparePassword,
  deleteCurrentSession,
  findUserById,
  generateRandomToken,
  createVerifyLink,
  insertVerifyEmailToken,
  clearVerifyEmailToken,
  verifyUserEmailAndUpdateToken,
  findVerificationEmailToken,
  updateProfile,
  updateUserPassword,
  findUserByEmail,
  getForgetPasswordLink,
  getResetPasswordData,
  deleteUserTokenData,
  getUserWithOauthId,
  linkUserWithOauth,
  createUserWithOauth,
} from "../services/auth.services.controller.js";
import { getShortLinkByUserId } from "../services/services.controller.js";
import {
  forgetPasswordVerification,
  loginValidation,
  passwordVerification,
  registrationValidation,
  resetPasswordVerification,
  verifyEmailValidation,
  verifyUserValidation,
} from "../validation/auth-validation.js";
import { sendEmail } from "../lib/resendEmail.js";
import fs from "fs/promises";
import { join } from "path";
import ejs from "ejs";
import mjml2html from "mjml";
import { asc } from "drizzle-orm"; // if unused, remove — left in case of sorting usage
import { OAUTH_EXCHANGE_EXPIRY } from "../config/constant.js";
import { decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { google } from "../lib/oauth/google.js";
import { github } from "../lib/oauth/github.js";

// registration page
export const getRegister = (req, res) => {
  return res.render("auth/register", { errors: req.flash("errors") });
};

// post register
export const postRegister = async (req, res) => {
  const { data, error } = registrationValidation.safeParse(req.body);

  if (error) {
    const errors = error.issues[0].message;
    req.flash("errors", errors);
    return res.redirect("/register");
  }

  const { name, email, password } = data;
  const existing = await findUserByEmail(email);
  if (existing) {
    req.flash("errors", "User already exists");
    return res.redirect("/register");
  }

  const hashedPassword = await getHashPassword(password);
  const user = await createUser({ name, email, password: hashedPassword });

  // createUser now returns user object with id
  await authenticateUser({ req, res, user, name, email });

  return res.redirect("/verify-email");
};

// get login page
export const getLogin = (req, res) => {
  return res.render("auth/login", {
    errors: req.flash("errors"),
    success: req.flash("success"),
  });
};

// post login
export const postlogin = async (req, res) => {
  const { data, error } = loginValidation.safeParse(req.body);

  if (error) {
    const errors = error.issues[0].message;
    req.flash("errors", errors);
    return res.redirect("/login");
  }

  const { email, password } = data;
  const user = await findUserByEmail(email);

  if (!user) {
    req.flash("errors", "Invalid email or password");
    return res.redirect("/login");
  }

  if (!user.password) {
    req.flash(
      "errors",
      "You have created account using social login. Please login with your social account."
    );
    return res.redirect("/login");
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    req.flash("errors", "Invalid email or password");
    return res.redirect("/login");
  }

  await authenticateUser({ req, res, user });

  return res.redirect("/");
};

// profile page
export const getProfile = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);

  const user = await findUserById(req.user.id);

  if (!user) return res.send(`<h1>You are not logged in</h1>`);

  const userShortLinks = await getShortLinkByUserId(user.id);

  res.render("auth/profile", {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url ?? user.avatarUrl,
      isEmailValid: user.is_email_valid ?? user.isEmailValid,
      hasPassword: Boolean(user.password),
      createdAt: user.created_at ?? user.createdAt,
      links: userShortLinks,
    },
    success: req.flash("success"),
  });
};

// logout
export const getLogout = async (req, res) => {
  if (req.user?.sessionId) {
    await deleteCurrentSession(req.user.sessionId);
  } else if (req.user?.session_id) {
    await deleteCurrentSession(req.user.session_id);
  }
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  return res.redirect("/");
};

// verify-email
export const getVerifyEmail = async (req, res) => {
  if (!req.user) return res.redirect("/");
  const user = await findUserById(req.user.id);
  if (!user || user.is_email_valid) return res.redirect("/");
  return res.render("auth/verifyEmail", { email: user.email });
};

// resend verification link
export const postResendVerificationLink = async (req, res) => {
  if (!req.user) return res.redirect("/");
  const user = await findUserById(req.user.id);
  if (!user || user.is_email_valid) return res.redirect("/");
  const randomToken = generateRandomToken();
  
  
  await insertVerifyEmailToken({ userId: user.id, token: randomToken });
  const verifyEmailLink = await createVerifyLink({
    email: user.email,
    token: randomToken,
  });

  const mjmlTemplate = await fs.readFile(
    join(import.meta.dirname, "..", "emails", "verify-email.mjml"),
    "utf-8"
  );
  const filledTemplate = ejs.render(mjmlTemplate, {
    code: randomToken,
    link: verifyEmailLink,
  });

  const htmlOutput = mjml2html(filledTemplate).html;

  sendEmail({
    to: user.email,
    subject: "verify your email",
    html: htmlOutput,
  }).catch(console.error);
  return res.redirect("/verify-email");
};

// verify-email-token
export const getVerifyEmailToken = async (req, res) => {
  const { data, error } = verifyEmailValidation.safeParse(req.query);

  if (error) {
    return res.send("verification link invalid or expired!");
  }

  const [token] = await findVerificationEmailToken(data);
  if (!token) return res.send("verification link invalid or expired!");

  await verifyUserEmailAndUpdateToken(token.email);

  await clearVerifyEmailToken(token.user_id ?? token.userId);

  return res.redirect("/profile");
};

// edit profile (get + post)
export const getEditProfile = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);

  const user = await findUserById(req.user.id);
  if (!user) return res.send(`<h1>You are not logged in</h1>`);

  return res.render("auth/editProfile", {
    user: req.user,
    avatarUrl: user.avatar_url,
    errors: req.flash("errors"),
    success: req.flash("success"),
  });
};

export const postEditProfile = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);

  const { data, error } = verifyUserValidation.safeParse(req.body);
  if (error) {
    const errorMessage = error.issues[0].message;
    req.flash("errors", errorMessage);
    return res.redirect("/edit-profile");
  }

  const fileUrl = req.file ? `uploads/avatar/${req.file.filename}` : undefined;

  await updateProfile({ userId: req.user.id, name: data.name, avatarUrl: fileUrl });
  req.flash("success", "Profile updated successfully!");
  return res.redirect("/profile");
};

// change password
export const getChangePassword = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);
  return res.render("auth/changePassword", {
    errors: req.flash("errors"),
  });
};

export const postChangePassword = async (req, res) => {
  const { data, error } = passwordVerification.safeParse(req.body);
  const user = await findUserById(req.user.id);

  if (error) {
    const errorMessage = error.issues[0].message;
    req.flash("errors", errorMessage);
    return res.redirect("/change-password");
  }

  const isPasswordValid = await comparePassword(
    data.currentPassword,
    user.password
  );
  if (!isPasswordValid) {
    req.flash("errors", "Current password does not match!");
    return res.redirect("/change-password");
  }

  const hashedPassword = await getHashPassword(data.confirmPassword);
  await updateUserPassword(user.id, hashedPassword);

  req.flash("success", "Password change successfully!");
  return res.redirect("/profile");
};

// forget password (get + post)
export const getForgetPassword = async (req, res) => {
  return res.render("auth/forgetPassword", {
    formSubmitted: req.flash("formSubmitted")[0],
    errors: req.flash("errors"),
  });
};

export const postForgetPassword = async (req, res) => {
  const { data, error } = forgetPasswordVerification.safeParse(req.body);

  if (error) {
    const errorMessage = error.issues[0].message;
    req.flash("errors", errorMessage);
    return res.redirect("/forget-password");
  }

  const user = await findUserByEmail(data.email);
  if (!user) {
    req.flash("errors", "Cannot find user with this email!");
    return res.redirect("/forget-password");
  }

  const forgetPasswordLink = await getForgetPasswordLink({ userId: user.id });

  const mjmlTemplate = await fs.readFile(
    join(import.meta.dirname, "..", "emails", "forget-password-email.mjml"),
    "utf-8"
  );
  const filledTemplate = ejs.render(mjmlTemplate, {
    name: user.name,
    link: forgetPasswordLink,
  });

  const htmlOutput = mjml2html(filledTemplate).html;

  sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: htmlOutput,
  }).catch(console.error);

  req.flash("formSubmitted", true);
  return res.redirect("/forget-password");
};

// reset password (get + post)
export const getResetPassword = async (req, res) => {
  const { token } = req.params;
  const resetPasswordData = await getResetPasswordData(token);

  if (!resetPasswordData) return res.render("auth/wrongResetPassword");

  return res.render("auth/resetPassword", {
    errors: req.flash("errors"),
    token,
  });
};

export const postResetPassword = async (req, res) => {
  const { token } = req.params;
  const { data, error } = resetPasswordVerification.safeParse(req.body);

  if (error) {
    const errorMessage = error.issues[0].message;
    req.flash("errors", errorMessage);
    return res.redirect(`/reset-password/:${token}`);
  }

  const resetPasswordData = await getResetPasswordData(token);

  if (!resetPasswordData) return res.render("auth/wrongResetPassword");

  await deleteUserTokenData(resetPasswordData.user_id ?? resetPasswordData.userId);

  const hashedPassword = await getHashPassword(data.confirmPassword);
  await updateUserPassword(resetPasswordData.user_id ?? resetPasswordData.userId, hashedPassword);

  req.flash("success", "Password changed successfully!");
  return res.redirect("/login");
};

// Google OAuth login
export const getGoogleLogin = async (req, res) => {
  if (req.user) return res.redirect("/");

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);

  const cookieConfig = {
    httpOnly: true,
    secure: true,
    maxAge: OAUTH_EXCHANGE_EXPIRY,
    sameSite: "lax",
  };

  res.cookie("google_oauth_state", state, cookieConfig);
  res.cookie("google_code_verifier", codeVerifier, cookieConfig);

  return res.redirect(url.toString());
};

export const getGoogleLoginCallback = async (req, res) => {
  const { code, state } = req.query;

  const {
    google_oauth_state: storedState,
    google_code_verifier: codeVerifier,
  } = req.cookies;

  if (
    !code ||
    !state ||
    !storedState ||
    !codeVerifier ||
    state !== storedState
  ) {
    req.flash(
      "errors",
      "Couldn't login with Google because of invalid login attempt. Please try again!"
    );
    return res.redirect("/login");
  }

  let tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch {
    req.flash(
      "errors",
      "Couldn't login with Google because of invalid login attempt. Please try again!"
    );
    return res.redirect("/login");
  }

  const claims = decodeIdToken(tokens.idToken());
  const { sub: googleUserId, name, email, picture } = claims;

  let user = await getUserWithOauthId({
    provider: "google",
    email,
  });

  if (user && !user.provider_account_id) {
    await linkUserWithOauth({
      userId: user.id,
      provider: "google",
      providerAccountId: googleUserId,
      avatarUrl: picture,
    });
  }

  if (!user) {
    user = await createUserWithOauth({
      name,
      email,
      provider: "google",
      providerAccountId: googleUserId,
      avatarUrl: picture,
    });
  }

  await authenticateUser({ req, res, user, name, email });

  return res.redirect("/");
};

// Github OAuth
export const getGithubLogin = async (req, res) => {
  if (req.user) return res.redirect("/");

  const state = generateState();

  const url = github.createAuthorizationURL(state, ["user:email"]);

  const cookieConfig = {
    httpOnly: true,
    secure: true,
    maxAge: OAUTH_EXCHANGE_EXPIRY,
    sameSite: "lax",
  };

  res.cookie("github_oauth_state", state, cookieConfig);

  return res.redirect(url.toString());
};

export const getGithubLoginCallback = async (req, res) => {
  const { code, state } = req.query;
  const { github_oauth_state: storedState } = req.cookies;

  function handleFailedLogin() {
    req.flash(
      "errors",
      "Couldn't login with GitHub because of invalid login attempt. Please try again!"
    );
    return res.redirect("/login");
  }

  if (!code || !state || !storedState || state !== storedState) {
    return handleFailedLogin();
  }

  let tokens;
  try {
    tokens = await github.validateAuthorizationCode(code);
  } catch {
    return handleFailedLogin();
  }

  const githubUserResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
    },
  });
  if (!githubUserResponse.ok) return handleFailedLogin();
  const githubUser = await githubUserResponse.json();
  const { id: githubUserId, name, avatar_url } = githubUser;

  const githubEmailResponse = await fetch(
    "https://api.github.com/user/emails",
    {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    }
  );
  if (!githubEmailResponse.ok) return handleFailedLogin();

  const emails = await githubEmailResponse.json();
  const primary = emails.filter((e) => e.primary)[0];
  const email = primary?.email;
  if (!email) return handleFailedLogin();

  let user = await getUserWithOauthId({
    provider: "github",
    email,
  });

  if (user && !user.provider_account_id) {
    await linkUserWithOauth({
      userId: user.id,
      provider: "github",
      providerAccountId: githubUserId,
      avatarUrl: avatar_url,
    });
  }

  if (!user) {
    user = await createUserWithOauth({
      name,
      email,
      provider: "github",
      providerAccountId: githubUserId,
      avatarUrl: avatar_url,
    });
  }

  await authenticateUser({ req, res, user, name, email });

  return res.redirect("/");
};

// set password (get + post)
export const getSetPassword = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);
  return res.render("auth/setPassword", {
    errors: req.flash("errors"),
  });
};

export const postSetPassword = async (req, res) => {
  if (!req.user) return res.send(`<h1>You are not logged in</h1>`);

  const { data, error } = resetPasswordVerification.safeParse(req.body);

  if (error) {
    const errorMessage = error.issues[0].message;
    req.flash("errors", errorMessage);
    return res.redirect(`/set-password`);
  }

  const user = await findUserById(req.user.id);

  if (user.password) {
    req.flash("errors", "You already have your Password, Instead Change your password");
    return res.redirect("/set-password");
  }

  const hashedPassword = await getHashPassword(data.confirmPassword);
  await updateUserPassword(req.user.id, hashedPassword);

  req.flash("success", "Password set successfully!");
  return res.redirect("/profile");
};
