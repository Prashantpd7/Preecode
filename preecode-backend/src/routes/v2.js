const express = require('express');
const router = express.Router();

router.use('/interview', require('../modules/interview/routes'));
router.use('/resume',    require('../modules/resume/routes'));
router.use('/readiness', require('../modules/readiness/routes'));

module.exports = router;
