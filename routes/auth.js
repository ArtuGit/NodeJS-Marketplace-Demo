const express = require('express');
const {check, body} = require('express-validator');

const authController = require('../controllers/auth');
const User = require('../models/user');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .normalizeEmail(),
    body('password', 'Password has to be valid.')
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim()
  ],
  authController.postLogin
);

router.post(
  '/signup',
  [
    check('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        // if (value === 'test@test.com') {
        //   throw new Error('This email address if forbidden.');
        // }
        // return true;
        return User.findOne({email: value}).then(userDoc => {
          if (userDoc) {
            return Promise.reject(
              'E-Mail exists already, please pick a different one.'
            );
          }
        });
      }),
    body(
      'password',
      'Please enter a password with only numbers and text and at least 5 characters.'
    )
      .isLength({min: 5})
      .isAlphanumeric()
      .trim(),
    body('confirmPassword')
      .trim()
      .custom((value, {req}) => {
        if (value !== req.body.password) {
          throw new Error('Passwords have to match!');
        }
        return true;
      })
  ],
  authController.postSignup
);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

router.get('/user/:userId', authController.getEditUser);

router.post(
  '/edit-user/:userId',
  [
    body('newPassword')
      .trim(),
    body('newPassword')
      .custom((value, {req}) => {
        if (value && !req.body.password) {
          throw new Error('Please enter the existing password.');
        }
        return true;
      }),
    body('newPassword')
      .custom((value, {req}) => {
        if (!value && req.body.password) {
          throw new Error('Please enter a new password.');
        }
        return true;
      }),
    body('newPassword')
      .custom((value, {req}) => {
        if (value) {
          let error = null;
          if (
                (value.length<5) ||
                ((!value.match(/^[a-z0-9]+$/i)))
             ) {
            error = true;
          }
          if (error) {
            throw new Error('Please enter a password with only numbers and text and at least 5 characters.');
          }
        }
        return true;
      })
  ],
  isAuth,
  authController.postEditUser
);

module.exports = router;
