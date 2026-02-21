const express = require('express');
const router = express.Router();
const { createUser, getUser, getStats, loginUser } = require('../controllers/userController');
const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/authMiddleware');
const checkEarlyAccess = require('../middleware/checkEarlyAccess');

router.post('/login', loginUser);
router.post('/', createUser);
router.get('/stats/:id', auth, checkEarlyAccess, validateObjectId, getStats);
router.get('/:id', auth, checkEarlyAccess, validateObjectId, getUser);

module.exports = router;
