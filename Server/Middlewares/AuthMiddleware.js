import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../db/models/UserModel.js";
import { Admin } from "../db/models/AdminModel.js";
import BlockedCookies from "../db/models/BlockedCookies.js";
import { isValidObjectId } from "mongoose";
dotenv.config();

export const verifyToken = async (req, res, next) => {
    try {
        const token = req.cookies.pds;
        if (!token) return res.status(401).send("You are not Authenticated.");
        const cookiee = await BlockedCookies.findOne({ cookie: token });
        if (cookiee) {
            return res.status(401).send("Your session expired, Please Login Again.");
        }
        const claims = jwt.verify(token, process.env.JWT_KEY);
        if (!isValidObjectId(claims.userId) || !claims.iat) {
            return res.status(403).send("token not valid!");
        }
        let account = await User.findById(claims.userId).select("passwordChangedAt");
        let role = "user";
        if (!account) {
            account = await Admin.findById(claims.userId).select("passwordChangedAt");
            role = "admin";
        }
        if (
            !account ||
            (account.passwordChangedAt &&
                claims.iat * 1000 < account.passwordChangedAt.getTime())
        ) {
            return res.status(403).send("token not valid!");
        }
        req.userId = claims.userId;
        req.userRole = role;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(403).send("token not valid!");
        }
        console.error(error.message);
        res.status(500).send("Internal Server Error");
    }
}

export const verifyAdmin = async (req, res, next) => {
    try {
        if (req.userRole !== "admin") {
            return res.status(403).send("Admin access required");
        }
        next();
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal Server Error");
    }
}

export const verifyTrustedRequestOrigin = (req, res, next) => {
    const allowedOrigins = process.env.CLIENT_URLS
        ? process.env.CLIENT_URLS.split(",").map((url) => url.trim())
        : [];
    const origin = req.get("origin");
    const referer = req.get("referer");
    let requestOrigin = origin;

    if (!requestOrigin && referer) {
        try {
            requestOrigin = new URL(referer).origin;
        } catch {
            return res.status(403).send("Untrusted request origin");
        }
    }

    if (
        (requestOrigin && !allowedOrigins.includes(requestOrigin)) ||
        (!requestOrigin && req.get("sec-fetch-site") === "cross-site")
    ) {
        return res.status(403).send("Untrusted request origin");
    }
    next();
}


export const getUserInfo =async(req,res,next)=>{
    try {
        const userId = req.userId;
        if (!userId) return res.status(400).send("You are not logged in");

        const user = await User.findById(userId);
        if (!user){
            const admin = await Admin.findById(userId);
            if(!admin) return res.status(404).send("No Such User Found");
            return res.status(200).json({
                message: "Admin Info",
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: 'admin'
            });
        }
        return res.status(200).json({
            message: "User Info",
            _id: user._id,
            name: user.name,
            email: user.email,
            role: 'user'
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send("Internal Server Error");
    }
}