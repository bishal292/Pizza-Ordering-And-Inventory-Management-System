import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { Admin } from "../db/models/AdminModel.js";

dotenv.config();

const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_APP_USERNAME,
      pass: process.env.GMAIL_APP_SECRET,
    },
  });

export function sendEmail(option) {
  const emailOptions = {
    from: process.env.GMAIL_APP_USERNAME,
    to: option.email,
    subject: option.subject,
    text: option.message,
  };

  return createTransporter().sendMail(emailOptions);
}

export const sendEmailToAdmins = async (option) => {
  const admins = await Admin.find({}, "email");
  const formattedEmails = admins.map((admin) => admin.email).join(", ");

  const emailOptions = {
    from: process.env.GMAIL_APP_USERNAME,
    to: formattedEmails,
    subject: option.subject,
    text: option.message,
  };

  return createTransporter().sendMail(emailOptions);
};
