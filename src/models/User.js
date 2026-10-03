const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: true
    },

    role: {
      type: String,
      enum: ['SuperAdmin', 'Manager', 'Employee'],
      default: 'Employee'
    },

    provider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local'
    },

    providerId: {
      type: String,
      default: null
    },

    refreshToken: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ==========================================
// HASH PASSWORD BEFORE SAVING
// ==========================================

userSchema.pre('save', async function () {
  // Refresh token waghera save karte waqt password
  // dobara hash nahi hona chahiye.
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(12);

  this.password = await bcrypt.hash(this.password, salt);
});

// ==========================================
// COMPARE LOGIN PASSWORD
// ==========================================

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);