import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import {
  getRegister,
  postRegister,
  getLogin,
  postlogin,
  getProfile,
  getLogout,
  getVerifyEmail,
  postResendVerificationLink,
  getVerifyEmailToken,
  getEditProfile,
  postEditProfile,
  getChangePassword,
  postChangePassword,
  getForgetPassword,
  postForgetPassword,
  getResetPassword,
  postResetPassword,
  getGoogleLogin,
  getGoogleLoginCallback,
  getGithubLogin,
  getGithubLoginCallback,
  getSetPassword,
  postSetPassword,
} from "../Controllers/auth.controller.js";

const authRouter = Router();

authRouter.route("/register").get(getRegister).post(postRegister);

authRouter.route("/login").get(getLogin).post(postlogin);

authRouter.route("/profile").get(getProfile);

authRouter.route("/verify-email").get(getVerifyEmail);

authRouter.route("/resend-verification-link").post(postResendVerificationLink);

authRouter.route("/verify-email-token").get(getVerifyEmailToken);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    public_id: (req, file) => `${Date.now()}_${Math.round(Math.random() * 1e9)}`,
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed"), false);
};

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
authRouter.route("/edit-profile").get(getEditProfile).post( avatarUpload.single("avatar"), postEditProfile);

authRouter.route("/change-password").get(getChangePassword).post(postChangePassword);

authRouter.route("/forget-password").get(getForgetPassword).post(postForgetPassword);

authRouter.route("/reset-password/:token").get(getResetPassword).post(postResetPassword);

authRouter.route("/google").get(getGoogleLogin);

authRouter.route("/google/callback").get(getGoogleLoginCallback);

authRouter.route("/github").get(getGithubLogin);

authRouter.route("/github/callback").get(getGithubLoginCallback);

authRouter.route("/set-password").get(getSetPassword).post(postSetPassword);

authRouter.route("/logout").get(getLogout);

export default authRouter;
