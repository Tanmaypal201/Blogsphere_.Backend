const UserProfile = require("../models/userprofile");
const User = require("../models/user");
const Update = require("../models/updates");
const { onlineUsers } = require("../socket"); // adjust path if needed

const followUser = async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: "Username is required" });

        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });

        const userId = user._id;
        if (req.user._id.toString() === userId.toString()) {
            return res.status(400).json({ error: "You cannot follow yourself" });
        }

        const io = req.app.get("io");

        const alreadyFollower = await UserProfile.findOne({
            userId,
            "followers.userId": req.user._id,
        });

        if (alreadyFollower) {
            await UserProfile.updateOne(
                { userId },
                { $pull: { followers: { userId: req.user._id } } },
            );
            await UserProfile.updateOne(
                { userId: req.user._id },
                { $pull: { following: { userId } } },
            );
            await Update.deleteMany({
                actor: req.user._id,
                receiver: userId,
                type: { $in: ["follow", "followrequest", "followaccept"] },
            });
            return res.status(200).json({
                action: "unfollowed",
                message: "User unfollowed successfully",
            });
        }

        const pendingRequest = await Update.findOne({
            actor: req.user._id,
            receiver: userId,
            type: "followrequest",
        });
        if (pendingRequest) {
            await Update.deleteOne({ _id: pendingRequest._id });
            return res.status(200).json({
                action: "requested_cancelled",
                message: "Follow request cancelled",
            });
        }

        try {
            await new Update({
                actor: req.user._id,
                receiver: userId,
                type: "followrequest",
            }).save();
        } catch (dupErr) {
            if (dupErr.code !== 11000) throw dupErr;
        }

        // Notify target user directly from server — no longer depends on client socket state
        const receiverSockets = onlineUsers.get(userId.toString());
        if (io && receiverSockets) {
            receiverSockets.forEach((socketId) => {
                io.to(socketId).emit("newNotification", {
                    type: "followrequest",
                    sender: req.user._id.toString(),
                    reciver: userId.toString(),
                });
            });
        }

        return res.status(200).json({
            action: "requested",
            message: "Follow request sent successfully",
            followMessage: `Follow request sent to ${username}`,
        });
    } catch (err) {
        console.error("Error in followUser:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

module.exports = { followUser };