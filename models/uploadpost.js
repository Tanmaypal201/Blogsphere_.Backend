const mongoose = require("mongoose");

const uploadpostSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    username: {
        type: String,
        ref: "User",
        required: true
    },
    title: String,
    content: String,
    status: {
        type: String,
        enum: ["draft", "published"],
        default: "draft"
    },
    imageUrl: {
        url: { type: String, default: "" },
        publicId: { type: String, default: "" },
        fileName: { type: String, default: "" },
        fileSize: { type: Number, default: null },
        mimeType: { type: String, default: "" },
        resourceType: { type: String, default: "" }
    },
    category: {
        type: String,
        default: ""
    },
    tags: {
        type: [String],
        default: []
    },

    likes: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: {
            type: String,
            required: true,
            ref: "User"
        },
    }],

    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: {
            type: String,
            required: true,
            ref: "User"
        },
        text: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
    ,
    saves: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: {
            type: String,
            required: true,
            ref: "User"
        },
    }
    ]

}, { timestamps: true });

uploadpostSchema.set("toJSON", {
  virtuals: true,
  getters: true,
  transform: (doc, ret) => {
    if (ret.imageUrl && typeof ret.imageUrl === 'object' && ret.imageUrl.url) {
      ret.imageUrl = ret.imageUrl.url;
    }
    return ret;
  }
});

uploadpostSchema.set("toObject", {
  virtuals: true,
  getters: true,
  transform: (doc, ret) => {
    if (ret.imageUrl && typeof ret.imageUrl === 'object' && ret.imageUrl.url) {
      ret.imageUrl = ret.imageUrl.url;
    }
    return ret;
  }
});

const UploadPost = mongoose.model("UploadPost", uploadpostSchema);

module.exports = UploadPost;