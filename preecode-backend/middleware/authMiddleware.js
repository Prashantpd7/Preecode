const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token.' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password -__v');
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found.' });
    }
    const decodedVersion = Number(decoded.tokenVersion || 0);
    const currentVersion = Number(req.user.tokenVersion || 0);
    if (decodedVersion !== currentVersion) {
      return res.status(401).json({ message: 'Not authorized, token expired.' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid.' });
  }
};
