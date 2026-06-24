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
        type: String,
        default: ""
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

const UploadPost = mongoose.model("UploadPost", uploadpostSchema);

module.exports = UploadPost;