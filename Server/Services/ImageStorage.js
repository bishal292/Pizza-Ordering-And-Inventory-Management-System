import fs from "fs";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: function (_, __, callback) {
    const uploadDirectory = path.resolve("uploads");
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }
    callback(null, uploadDirectory);
  },
  filename: function (_, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const allowedImageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedImageTypes.get(extension) !== file.mimetype) {
      return callback(null, false);
    }
    callback(null, true);
  },
});

export const validateUploadedImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const signature = Buffer.alloc(12);
    const file = fs.openSync(req.file.path, "r");
    try {
      fs.readSync(file, signature, 0, signature.length, 0);
    } finally {
      fs.closeSync(file);
    }

    const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = signature.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const isWebp =
      signature.toString("ascii", 0, 4) === "RIFF" &&
      signature.toString("ascii", 8, 12) === "WEBP";

    if (
      (req.file.mimetype === "image/jpeg" && !isJpeg) ||
      (req.file.mimetype === "image/png" && !isPng) ||
      (req.file.mimetype === "image/webp" && !isWebp)
    ) {
      fs.unlinkSync(req.file.path);
      return res.status(400).send("Uploaded file is not a valid image");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (image) => {
  const imagePath = path.join(process.cwd(), "uploads", image);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};
