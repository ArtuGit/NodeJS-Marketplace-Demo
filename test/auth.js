require('dotenv').config()
const expect = require('chai').expect;
const sinon = require('sinon');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const AuthController = require('../controllers/auth');
const authMiddleware = require('../middleware/is-auth');

describe('Auth middleware', function () {
  it('should redirect to "/login" page if session "isLogin" is not true', function () {
    const req = {
      session: {
        isLoggedIn: false
      }
    };
    const res = {
      testRedirected: null,
      redirect: function (to) {
        this.testRedirected = to
      }
    };
    authMiddleware(req, res, () => {
    });
    expect(res.testRedirected).to.equal('/login');
  });
});

describe('Auth controller', function () {
  before(function (done) {
    mongoose
      .connect(
        process.env.mongoDB_AppTest
      )
      .then(result => {
        const user = new User({
          userName: 'Test',
          email: 'test@test.com',
          password: 'tester',
        });
        return user.save();
      })
      .then(() => {
        done();
      });
  });

  it('The login page should be rendered', function () {
    const validationResult = (param) => {
      return {
        isEmpty: () => true,
      }
    }
    const req = {
      flash: function (type) {
        return [];
      }
    }
    const res = {
      testRenderedPage: null,
      render: function (page, params) {
        this.testRenderedPage = page
      }
    };
    AuthController.getLogin(req, res, () => {
    });
    expect(res.testRenderedPage).to.equal('auth/login');
  });

  it('The user with the WRONG credentials should NOT be logged in', async () => {
    const req = {
      body: {
        email: 'wrong@test.com',
        password: 'nocheck'
      }
    };
    const res = {
      testRenderedPage: null,
      status: function (code) {
        return this;
      },
      render: function (page, params) {
        this.testRenderedPage = page;
      }
    };
    await AuthController.postLogin(req, res, () => {
    })
    expect(res.testRenderedPage).to.equal('auth/login');
  });

  it('The user with the RIGHT credentials should be logged in', async () => {
    sinon.stub(bcrypt, 'compare').resolves(true);

    const req = {
      body: {
        email: 'test@test.com',
        password: 'nocheck'
      },
      session: {
        testSessionSaved: null,
        save: function (func) {
          this.testSessionSaved = true
          func();
        }
      }
    };
    const res = {
      testRenderedPage: null,
      testRedirected: null,
      status: function (code) {
        return this;
      },
      render: function (page, params) {
        this.testRenderedPage = page;
      },
      redirect: function (to) {
        this.testRedirected = to
      }
    };
    await AuthController.postLogin(req, res, () => {
    })
    expect(res.testRenderedPage).to.equal(null);
    expect(req.session.testSessionSaved).to.equal(true);
    expect(res.testRedirected).to.equal('/');
  });

  after(function (done) {
    User.deleteMany({})
      .then(() => {
        return mongoose.disconnect();
      })
      .then(() => {
        done();
      });
  });

});
