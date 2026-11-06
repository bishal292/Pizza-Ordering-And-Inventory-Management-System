import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
    address:{
        type: String,
        trim: true,
    },
    passwordChangedAt: Date,
    resetOTP: String,
    resetOTPExpires: Date,
    resetOTPAttempts: { type: Number, default: 0, min: 0, max: 5 },
});


UserSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.passwordChangedAt = Date.now() - 1000;
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

UserSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    if (update.password) {
        const salt = await bcrypt.genSalt(10);
        update.password = await bcrypt.hash(update.password, salt);
        update.passwordChangedAt = Date.now() - 1000;
    }
    next();
});

UserSchema.methods.createPasswordResetOTP = function () {
    const resetToken = crypto.randomInt(100000, 1000000).toString();
    
    this.resetOTP = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    this.resetOTPAttempts = 0;
    this.resetOTPExpires = Date.now() + 15 * 60 * 1000 ;
    return resetToken;
  };

export const User = mongoose.model("User", UserSchema);