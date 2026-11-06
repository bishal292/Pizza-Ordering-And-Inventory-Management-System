import mongoose from "mongoose";

const dailyOrderSequenceSchema = new mongoose.Schema({
  _id: { type: String },
  sequence: { type: Number, required: true, default: 0 },
});

export default mongoose.model("DailyOrderSequence", dailyOrderSequenceSchema);
