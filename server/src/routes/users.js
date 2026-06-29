const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin'), ctrl.list);
router.get('/roles', ctrl.listRoles);
router.get('/:id', ctrl.get);
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
