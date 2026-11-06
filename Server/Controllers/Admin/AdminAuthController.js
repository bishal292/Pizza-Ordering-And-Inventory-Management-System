import { Admin } from "../../db/models/AdminModel.js";
import bcrypt from "bcrypt";
import { sendEmail } from "../../Services/EmailService.js";
import {
  checkPasswordStrength,
  createToken,
  SESSION_MAX_AGE_MS,
} from "../../utils/auth-utils.js";
import validator from "validator";
import { configDotenv } from "dotenv";
import crypto from "crypto";
import BlockedCookies from "../../db/models/BlockedCookies.js";

configDotenv();

export const logIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Please provide email and password");

    if (!validator.isEmail(email))
      return res.status(400).send("Please provide a valid email");

    //Check if user exists in database.
    const user = await Admin.findOne({ email }).select("+password");
    // if (!user) return res.status(401).send("No Admin Exists with this email");
    if (!user) return res.status(401).send("Invalid Credentials.");

    const auth = await bcrypt.compare(password, user.password);

    if (!auth) return res.status(401).send("Invalid Credentials");

    res.cookie("pds", createToken(user.email, user._id), {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: SESSION_MAX_AGE_MS,
    });

    res.status(200).json({
      message: "Logged In as Admin",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: "admin",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const signUp = async (req, res, next) => {
  try {
    const { name, email, password, secretKey } = req.body;
    if (!name || !email || !password || !secretKey)
      return res.status(400).send("Please provide all fields");

    if (!validator.isEmail(email))
      return res
        .status(400)
        .send("Entered Email is not valid, Please provide a valid email");
    const user = await Admin.findOne({ email });
    if (user)
      return res
        .status(400)
        .send(
          "User already exists with this email, Please login, or use another email for signup."
        );

    if (secretKey !== process.env.ADMIN_CREATION_SECRET_KEY)
      return res.status(401).send("Invalid Secret Key");

    // checkPasswordStrength(password); // If password strength is less secure then simply respond with a message to improve password and try again.

    const newUser = await Admin.create({ name, email, password });
    if (!newUser) return res.status(500).send("Internal Server Error");

    res.cookie("pds", createToken(newUser.email, newUser._id), {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: SESSION_MAX_AGE_MS,
    });

    res.status(201).json({
      message: "Admin Created Successfully",
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: "admin",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const logOut = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(400).send("You are not logged in");
    await BlockedCookies.create({ cookie: req.cookies.pds });
    res.clearCookie("pds");
    res.status(200).send("Logged Out Successfully");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { oldPassword, newPassword } = req.body;

    if (!userId) return res.status(400).send("You are not logged in");

    if (!oldPassword || !newPassword)
      return res.status(400).send("Please provide old and new password");

    const user = await Admin.findById(userId).select("+password");

    if (!user) return res.status(400).send("User not found");

    if (oldPassword === newPassword)
      return res.status(400).send("Old and New Passwords Cannot be same.");

    const auth = await bcrypt.compare(oldPassword, user.password);

    if (!auth) return res.status(401).send("Old Password didnot match");

    // checkPasswordStrength(newPassword); // If password strength is less secure then simply respond with a message to improve password and try again.
    user.password = newPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.resetOTPAttempts = 0;

    await user.save();

    res.cookie("pds", createToken(user.email, user._id), {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.status(200).send("Password Changed Successfully");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const updateProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.userId);
    if (!admin) return res.status(404).send("Admin not found");

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length !== 1 ||
      typeof req.body.name !== "string"
    ) {
      return res.status(400).send("Only a profile name can be updated");
    }

    const name = req.body.name.trim();
    if (name.length < 2 || name.length > 100) {
      return res
        .status(400)
        .send("Name must contain between 2 and 100 characters");
    }

    admin.name = name;
    await admin.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Failed to update admin profile:", error.message);
    return res.status(500).send("Internal Server Error");
  }
};

export const forgotpassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).send("Please provide email");
    if (!validator.isEmail(email))
      return res
        .status(400)
        .send("Entered Email is not valid, Please provide a valid email");
    const user = await Admin.findOne({ email });
    if (!user)
      return res
        .status(400)
        .send("User not found with this email please provide a valid email");

    if (user.resetOTP && Date.now() < user.resetOTPExpires) {
      return res
        .status(409)
        .send(
          "Password Reset OTP is already sent to your email , Please check your email"
        );
    }

    // instance method to create reset password token.
    const resetToken = user.createPasswordResetOTP();
    await user.save();

    const message = `We have received a password reset request for your account, Please use the below OTP to reset your password : \n\n${resetToken}\n\nThid reset OTP is valid till next 10 minutes only. If you are not trying to reset your password, please ignore this email!`;
    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset Request",
        message,
      });

      res
        .status(200)
        .send("Reset Password OTP Sent to your email, please check your email");
    } catch (error) {
      console.error(error.message);
      user.resetOTP = undefined;
      user.resetOTPExpires = undefined;
      user.resetOTPAttempts = 0;
      await user.save();
      return res
        .status(500)
        .send("Error in sending email, Please try again later");
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const resetpassword = async (req, res, next) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword)
      return res
        .status(400)
        .send("Please provide email, OTP, password and confirm password");
    if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return res.status(400).send("Invalid OTP, Please try again");
    }

    if (!validator.isEmail(email))
      return res
        .status(400)
        .send("Entered Email is not valid, Please provide a valid email");
    const user = await Admin.findOne({ email }).select("+password");
    if (!user)
      return res
        .status(400)
        .send("Admin not found with this email please provide a valid email");

    if (!user.resetOTP || Date.now() > user.resetOTPExpires)
      return res.status(400).send("Invalid or Expired OTP, Please try again");
    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");
    if (
      user.resetOTPAttempts >= 5 ||
      !crypto.timingSafeEqual(Buffer.from(hashedOTP, "hex"), Buffer.from(user.resetOTP, "hex"))
    ) {
      const attempt = await Admin.findOneAndUpdate(
        {
          _id: user._id,
          resetOTP: user.resetOTP,
          resetOTPExpires: { $gt: new Date() },
          $or: [
            { resetOTPAttempts: { $lt: 5 } },
            { resetOTPAttempts: { $exists: false } },
          ],
        },
        { $inc: { resetOTPAttempts: 1 } },
        { new: true }
      ).select("resetOTPAttempts");
      if (attempt?.resetOTPAttempts >= 5) {
        await Admin.updateOne(
          { _id: user._id, resetOTP: user.resetOTP, resetOTPAttempts: { $gte: 5 } },
          { $unset: { resetOTP: 1, resetOTPExpires: 1 } }
        );
      }
      return res.status(400).send("Invalid OTP, Please try again");
    }

    if (password !== confirmPassword)
      return res
        .status(400)
        .send("Password and Confirm Password must be same.");

    if (await bcrypt.compare(password, user.password))
      return res
        .status(409)
        .send("New Password cannot be same as old password");
    // checkPasswordStrength(password); // If password strength is less secure then simply respond with a message to improve password and try again.

    const consumedOTP = await Admin.updateOne(
      {
        _id: user._id,
        resetOTP: user.resetOTP,
        resetOTPExpires: { $gt: new Date() },
        $or: [
          { resetOTPAttempts: { $lt: 5 } },
          { resetOTPAttempts: { $exists: false } },
        ],
      },
      {
        $unset: { resetOTP: 1, resetOTPExpires: 1 },
        $set: { resetOTPAttempts: 0 },
      }
    );
    if (consumedOTP.modifiedCount !== 1) {
      return res.status(400).send("Invalid or Expired OTP, Please try again");
    }

    user.password = password;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.resetOTPAttempts = 0;
    await user.save();

    // res.status(200).send("Password Reset Successfully! Please login with your new password");

    res.cookie("pds", createToken(user.email, user._id), {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge,
    });

    res.status(200).json({
      message: "Password Reset Successfull! You are logged in.",
      _id: user._id,
      name: user.name,
      email: user.email,
      role: "user",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

export const AdminInfo = async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId)
      return res
        .status(400)
        .send("You are not Authenticated, Try logging in or signing up");

    const user = await Admin.findById(userId).select("_id name email");
    if (!user) return res.status(400).send("User not found");

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: "admin",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};
