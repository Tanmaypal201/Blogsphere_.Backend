const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    username: {
      type: String,
      required: true,

    }
  },
  receiver: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    username: {
      type: String,
      required: true,
    }
  },
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    content: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      enum: ["text", "audio", "call"],
      default: "text"
    }
  },
  reactions: {
    type: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        emoji: {
          type: String,
          required: true
        }
      }
    ],
    default: []
  },
  type: {
    type: String,
    enum: ["text", "audio", "call", "image", "video", "document"]
  },
  content: {
    type: String,
    required: true
  },
  fileUrl: {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: "" },
    resourceType: { type: String, default: "" }
  },
  fileName: {
    type: String,
    default: ""
  },
  fileSize: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ["sent", "delivered", "seen"],
    default: "sent"
  },
  seenAt: {
    type: Date
  }

}, { timestamps: true })

messageSchema.set("toJSON", {
  virtuals: true,
  getters: true,
    transform: (doc, ret) => {
      if (ret.fileUrl) {
        const url = typeof ret.fileUrl === "object" ? ret.fileUrl.url : ret.fileUrl;
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          ret.fileUrl = url;
        } else if (url && url.startsWith("/")) {
          ret.fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${url}`;
        } else if (url) {
          ret.fileUrl = `${process.env.NEXT_PUBLIC_API_URL}/${url}`;
        }
      }
      return ret;
  }
});

messageSchema.set("toObject", {
  virtuals: true,
  getters: true,
  transform: (doc, ret) => {
    if (ret.fileUrl) {
      const url = typeof ret.fileUrl === "object" ? ret.fileUrl.url : ret.fileUrl;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        ret.fileUrl = url;
      } else if (url) {
        ret.fileUrl = `${process.env.NEXT_PUBLIC_API_URL}/${url}`;
      }
    }
    return ret;
  }
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;