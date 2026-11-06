import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const AdminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, required: true,select:false },
  email: { type: String, required: true, unique: true },
  passwordChangedAt: Date,
  resetOTP: String,
  resetOTPExpires: Date,
  resetOTPAttempts: { type: Number, default: 0, min: 0, max: 5 },
});

AdminSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.passwordChangedAt = Date.now() - 1000;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Instance method to create password reset token on Admin instances.
AdminSchema.methods.createPasswordResetOTP = function () {

  const resetToken = crypto.randomInt(100000, 1000000).toString();
  
  this.resetOTP = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetOTPAttempts = 0;
  this.resetOTPExpires = Date.now() + 10 * 60 * 1000 ;
  return resetToken;
};

export const Admin = mongoose.model("Admin", AdminSchema);