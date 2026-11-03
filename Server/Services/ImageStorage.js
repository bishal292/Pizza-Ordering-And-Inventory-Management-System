import fs from "fs";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (_, __, callback) {
    const uploadDirectory = "uploads/";
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }
    callback(null, uploadDirectory);
  },
  filename: function (_, file, callback) {
    callback(null, `${Date.now()}-${file.originalname}`);
  },
});

export const upload = multer({ storage });

export const deleteImage = async (image) => {
  const imagePath = path.join(process.cwd(), "uploads", image);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};
