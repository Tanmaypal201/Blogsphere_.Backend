const mongoose = require("mongoose");

const updateSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "comment", "post", "profile", "follow", "followrequest", "followaccept"],
      required: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Uploadpost",
      default: null,
    },
  },
  { timestamps: true }
);

// Index for fast lookup of updates by receiver (notification feed)
updateSchema.index({ receiver: 1, createdAt: -1 });

// Prevent duplicate follow requests
updateSchema.index(
  { actor: 1, receiver: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "followrequest" } }
);

const Update = mongoose.model("Update", updateSchema);

module.exports = Update;
