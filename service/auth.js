const jwt = require('jsonwebtoken');
const secretkey = process.env.JWT_SECRET;

//Setuser -generate token
const setuser = (user) => {
    if (!user) {
        throw new Error('User object is required');
    }
    return jwt.sign({
        _id: user._id,
        username: user.username,
        email: user.email
    }, secretkey);
}

//Getuser -verify token
const getuser = (token) => {
    try {
        return jwt.verify(token, secretkey);
    }
    catch (error) {
        return null;
    }
}

console.log('Auth module loaded - setuser:', typeof setuser, 'getuser:', typeof getuser);
module.exports = { setuser, getuser };