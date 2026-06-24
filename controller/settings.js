const User = require("../models/user");

const setsettings = async (req, res) => {
  const userId = req.user._id;
  const { theme, notifications, browserNotifications } = req.body;

  try {
    // Map frontend field names to database schema
    const updateData = {
      "setting.theme": theme,
      "setting.notifications.like": notifications?.postLikes || false,
      "setting.notifications.comment": notifications?.comments || false,
      "setting.emailnotifications": browserNotifications || false,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings: user.setting,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
};

module.exports = { setsettings };
