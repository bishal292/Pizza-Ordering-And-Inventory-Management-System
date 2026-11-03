import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import zxcvbn from "zxcvbn";

dotenv.config();

const maxAge = 3 * 24 * 60 * 60;

export const createToken = (email, id) =>
  jwt.sign({ userId: id, email }, process.env.JWT_KEY, {
    expiresIn: maxAge,
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
