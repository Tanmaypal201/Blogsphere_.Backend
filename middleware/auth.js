const { getuser } = require('../server/auth');

const checkauthentication = (req, res, next) => {
    const token = req.cookies.token;
    console.log("Cookies:", req.cookies);
    console.log("Token:", req.cookies.token);
    if (!token) {
        req.user = null;
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const user = getuser(token);
        if (!user) {
            req.user = null;
            return res.status(401).json({ message: "Unauthorized" });
        }
        req.user = user;
        next();
    } catch (err) {
        req.user = null;
        return res.status(401).json({ message: "Unauthorized" });
    }
};

module.exports = checkauthentication;