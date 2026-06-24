const mongoose=require("mongoose");

const userProfileSchema=new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    username:{
        type: String,
        ref: "User",
        required: true,
        unique: true
    },
    fullName: { type: String, default: "" },
    bio: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
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

const UserProfile=mongoose.model("Userprofile",userProfileSchema);

module.exports=UserProfile;