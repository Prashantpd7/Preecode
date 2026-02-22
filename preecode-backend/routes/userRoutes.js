const express = require('express');
const router = express.Router();
const { createUser, getUser, getStats, loginUser } = require('../controllers/userController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

// Debug logs for route hits
router.post('/login', (req, res, next) => {
	console.log('[users] POST /api/users/login from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return loginUser(req, res, next);
});

router.post('/', (req, res, next) => {
	console.log('[users] POST /api/users (create) from', req.ip, 'bodyKeys=', Object.keys(req.body));
	return createUser(req, res, next);
});
// Return current authenticated user
router.get('/me', auth, checkEarlyAccess, (req, res, next) => {
  return require('../controllers/userController').getMe(req, res, next);
});
router.get('/stats/:id', auth, checkEarlyAccess, validateObjectId, getStats);
router.get('/:id', auth, checkEarlyAccess, validateObjectId, getUser);

module.exports = router;
