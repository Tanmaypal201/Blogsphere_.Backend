const UserProfile = require("../models/userprofile");
const Update = require("../models/updates");
//Controller for setting user profile
const setprofile = async (req, res) => {
  try {
    const { fullName, bio, interests } = req.body;
    const userId = req.user._id;

    console.log("Set profile attempt:", req.body);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!fullName || !bio || !interests) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;
    const interestsArray = Array.isArray(interests)
      ? interests
      : interests.split(",").map((i) => i.trim());

    console.log("User object:", req.user);

    const existingProfile = await UserProfile.findOne({
      userId: userId,
    });

    if (existingProfile) {
      existingProfile.fullName = fullName;
      existingProfile.bio = bio;
      existingProfile.profilePicture =
        profilePicture || existingProfile.profilePicture;
      existingProfile.interests = interestsArray;

      await existingProfile.save();

      return res.status(200).json({
        message: "Profile updated successfully",
        profile: existingProfile,
      });
    }

    const newProfile = new UserProfile({
      userId: userId,
      username: req.user.username,
      fullName,
      bio,
      profilePicture,
      interests: interestsArray,
    });

    const result = await newProfile.save();

    const update = new Update({
      actor: req.user._id,
      receiver: req.user._id,
      type: "profile",
    });

    await update.save();

    return res.status(201).json({
      message: "Profile created successfully",
      profile: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
module.exports = { setprofile };
