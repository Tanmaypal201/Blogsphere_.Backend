const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  username: {
    type: String,
    ref: "User",
    required: true,
    unique: true
  },
  fullName: { type: String, default: "" },
  bio: { type: String, default: "" },
  profilePicture: {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: "" },
    resourceType: { type: String, default: "" }
  },
  interests: { type: [String], default: [] },
  followers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String
  }],
  following: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String
  }]
});

userProfileSchema.set("toJSON", {
  virtuals: true,
  getters: true,
  transform: (doc, ret) => {
    if (ret.profilePicture) {
      const url = typeof ret.profilePicture === "object" ? ret.profilePicture.url : ret.profilePicture;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        ret.profilePicture = `/uploads/${url}`;
      } else {
        ret.profilePicture = url;
      }
    }
    return ret;
  }
});

userProfileSchema.set("toObject", {
  virtuals: true,
  getters: true,
  transform: (doc, ret) => {
    if (ret.profilePicture) {
      const url = typeof ret.profilePicture === "object" ? ret.profilePicture.url : ret.profilePicture;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        ret.profilePicture = `/uploads/${url}`;
      } else {
        ret.profilePicture = url;
      }
    }
    return ret;
  }
});

const UserProfile = mongoose.model("Userprofile", userProfileSchema);

module.exports = UserProfile;