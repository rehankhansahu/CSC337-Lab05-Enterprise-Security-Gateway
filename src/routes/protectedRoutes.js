const express = require('express');

const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

const User = require('../models/User');

const router = express.Router();

// ==================================================
// EMPLOYEE PROFILE
// GET /api/v1/employee/profile
// Access: SuperAdmin, Manager, Employee
// ==================================================

router.get(
  '/employee/profile',
  protect,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Profile accessed successfully',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        provider: req.user.provider
      }
    });
  }
);

// ==================================================
// APPROVE PAYROLL
// POST /api/v1/payroll/approve
// Access: Manager, SuperAdmin
// ==================================================

router.post(
  '/payroll/approve',
  protect,
  checkRole(['Manager', 'SuperAdmin']),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: 'Payroll approved successfully',
      approvedBy: {
        id: req.user._id,
        name: req.user.name,
        role: req.user.role
      }
    });
  }
);

// ==================================================
// DELETE USER
// DELETE /api/v1/users/:id
// Access: SuperAdmin only
// ==================================================

router.delete(
  '/users/:id',
  protect,
  checkRole(['SuperAdmin']),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      await user.deleteOne();

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully.'
      });
    } catch (error) {
      console.error('DELETE USER ERROR:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID.'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to delete user.'
      });
    }
  }
);

module.exports = router;