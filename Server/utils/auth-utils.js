import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import zxcvbn from "zxcvbn";

dotenv.config();

export const SESSION_MAX_AGE_SECONDS = Number(
  process.env.MAX_AGE ?? 3 * 24 * 60 * 60
);
if (!Number.isSafeInteger(SESSION_MAX_AGE_SECONDS) || SESSION_MAX_AGE_SECONDS < 1) {
  throw new Error("MAX_AGE must be a positive integer number of seconds.");
}
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

export const createToken = (email, id) =>
  jwt.sign({ userId: id, email }, process.env.JWT_KEY, {
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });

export const checkPasswordStrength = (password, res) => {
  const result = zxcvbn(password);
  console.log(result);
  if (result.score < 3) {
    console.log(result.feedback.suggestions);
    return res.status(400).json({
      message: "Weak password. Please try improving your password.",
      suggestions: result.feedback.suggestions,
    });
  }
};
