const crypto = require('crypto');

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const {validationResult} = require('express-validator');

const User = require('../models/user');

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.sendgridAK
    }
  })
);

exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  let infoMessage = req.flash('info');
  if (infoMessage.length > 0) {
    infoMessage = infoMessage[0];
  } else {
    infoMessage = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    infoMessage: infoMessage,
    errorMessage: message,
    oldInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: '',
      userName: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password
      },
      validationErrors: errors.array()
    });
  }

  return User.findOne({email: email})
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email or password.',
          oldInput: {
            email: email,
            password: password
          },
          validationErrors: []
        });
      }
      bcrypt
        .compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err);
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Invalid email or password.',
            oldInput: {
              email: email,
              password: password
            },
            validationErrors: []
          });
        })
        .catch(err => {
          console.log(err);
          res.redirect('/login');
        });
    })
    .catch(err => {
      console.error(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const userName = req.body.userName;
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        userName: userName,
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword
      },
      validationErrors: errors.array()
    });
  }

  bcrypt
    .hash(password, 12)
    .then(hashedPassword => {
      const user = new User({
        userName: userName,
        email: email,
        password: hashedPassword,
        cart: {items: []}
      });
      return user.save();
    })
    .then(result => {
      req.flash('info', 'You are registered successfully. Please login.');
      res.redirect('/login');
      return transporter.sendMail({
        to: email,
        from: 'demo@itcross.dev',
        subject: 'Signup succeeded!',
        html: `<h1>You (${userName}) successfully signed up!</h1>`
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let errorMessage = req.flash('error');
  if (errorMessage.length > 0) {
    errorMessage = errorMessage[0];
  } else {
    errorMessage = null;
  }
  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'Reset Password',
    errorMessage: errorMessage,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({email: req.body.email})
      .then(user => {
        if (!user) {
          req.flash('error', 'No account with that email found.');
          return res.redirect('/reset');
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then(result => {
        const baseURL = req.protocol + '://' + req.get('host');
        transporter.sendMail({
          to: req.body.email,
          from: 'demo@itcross.dev',
          subject: 'Password reset',
          html: `
            <p>You requested a password reset</p>
            <p>Click this <a href="${baseURL}/reset/${token}">link</a> to set a new password.</p>
          `
        });
        req.flash('info', 'Password has been reset. Check your email.');
        res.redirect('/');
      })
      .catch(err => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({resetToken: token, resetTokenExpiration: {$gt: Date.now()}})
    .then(user => {
      let message = req.flash('error');
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        userId: user._id.toString(),
        passwordToken: token
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: {$gt: Date.now()},
    _id: userId
  })
    .then(user => {
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then(hashedPassword => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then(result => {
      req.flash('info', 'The password has been updated. Please login.');
      res.redirect('/login');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getEditUser = (req, res, next) => {
  if (
    (typeof req.session.isLoggedIn === 'undefined') ||
    (req.session.user._id.toString() !== req.params.userId.toString())
  ) {
    const error = new Error();
    error.httpStatusCode = 401;
    return next(error);
  }
  const userId = req.params.userId
  User.findById(userId)
    .then(user => {
      if (!user) {
        return res.redirect('/');
      }
      user.password = ''
      user.newPassword = ''
      res.render('auth/edit-user', {
        pageTitle: 'Edit User',
        path: `/edit-user/${userId}`,
        input: user,
        hasError: false,
        errorMessage: null,
        validationErrors: []
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditUser = async (req, res, next) => {
  try {
    if (req.body.userId.toString() !== req.user._id.toString()) {
      const error = new Error();
      error.httpStatusCode = 401;
      return next(error);
    }
    const userId = req.body.userId;
    const email = req.body.email
    const userName = req.body.userName;
    const password = req.body.password;
    const newPassword = req.body.newPassword;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render('auth/edit-user', {
        pageTitle: 'Edit User',
        path: `/edit-user/${userId}`,
        input: {
          _id: userId,
          userName: userName,
          email: email,
        },
        errorMessage: errors.array()[0].msg,
        validationErrors: errors.array()
      });
    } else {
      let errorMessage = ''
      let user = await User.findById(userId)
      if (!user) {
        req.flash('error', 'No account with that userID found.');
        return res.redirect('/');
      }
      if (email !== user.email) {
        errorMessage = 'You cannot change the email. This is a demo.';
      }
      if (newPassword) {
        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) {
          errorMessage = 'Wrong existing password.';
        } else {
          if (!password) {
            errorMessage = 'Wrong new password.';
          }
          if (newPassword === password) {
            errorMessage = 'Passwords have to be different!';
          }
        }
        if (errorMessage) {
          return res.status(422).render('auth/edit-user', {
            path: `/edit-user/${userId}`,
            pageTitle: 'Edit User',
            errorMessage: errorMessage,
            input: {
              _id: userId,
              userName: userName,
              email: user.email,
            },
            validationErrors: []
          });
        }
      }
      user.userName = userName;
      user.password = await bcrypt.hash(newPassword, 12);
      await user.save();
      req.session.user = user;
      await req.session.save;
      req.flash('info', `The user "${userName}" has been updated.`);
      res.redirect('/');
    }
  } catch (error) {
    console.error(error);
  }
};