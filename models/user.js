const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    googleId: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpiry: { type: Date },
    setting: {
        theme: { type: String, default: "light", enum: ["light", "dark"] },
        notifications: {
            like: { type: Boolean, default: true },
            comment: { type: Boolean, default: true },
        },
        emailnotifications: {
            type: Boolean,
            default: true
        }
    },
}, { timestamps: true });

userSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 300,
        partialFilterExpression: {
            isVerified: false
        }
    }
);


const User = mongoose.model('User', userSchema);
module.exports = User;