const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

const User = require('../models/User');

// ==================================================
// GET EMAILS DIRECTLY FROM GITHUB API
// Used when profile.emails is missing
// ==================================================

const getGitHubEmail = async (accessToken) => {
  try {
    const response = await fetch(
      'https://api.github.com/user/emails',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Enterprise-Security-Gateway',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      console.error(
        'GitHub email API failed:',
        response.status
      );

      return null;
    }

    const emails = await response.json();

    if (!Array.isArray(emails)) {
      return null;
    }

    // Prefer verified primary GitHub email
    const primaryEmail = emails.find(
      (item) =>
        item.primary === true &&
        item.verified === true
    );

    if (primaryEmail?.email) {
      return primaryEmail.email
        .trim()
        .toLowerCase();
    }

    // Otherwise use any verified email
    const verifiedEmail = emails.find(
      (item) => item.verified === true
    );

    if (verifiedEmail?.email) {
      return verifiedEmail.email
        .trim()
        .toLowerCase();
    }

    return null;
  } catch (error) {
    console.error(
      'GITHUB EMAIL FETCH ERROR:',
      error
    );

    return null;
  }
};

// ==================================================
// GITHUB OAUTH STRATEGY
// ==================================================

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,

      clientSecret:
        process.env.GITHUB_CLIENT_SECRET,

      callbackURL:
        process.env.GITHUB_CALLBACK_URL,

      scope: ['user:email']
    },

    async (
      accessToken,
      refreshToken,
      profile,
      done
    ) => {
      try {
        // ------------------------------------------
        // 1. Existing GitHub account
        // ------------------------------------------

        let user = await User.findOne({
          provider: 'github',
          providerId: profile.id
        });

        if (user) {
          return done(null, user);
        }

        // ------------------------------------------
        // 2. Try email supplied by Passport
        // ------------------------------------------

        let githubEmail = null;

        if (
          profile.emails &&
          Array.isArray(profile.emails)
        ) {
          const profileEmail =
            profile.emails.find(
              (item) => item.value
            );

          if (profileEmail?.value) {
            githubEmail = profileEmail.value
              .trim()
              .toLowerCase();
          }
        }

        // ------------------------------------------
        // 3. Fallback: GitHub /user/emails API
        // ------------------------------------------

        if (!githubEmail) {
          githubEmail =
            await getGitHubEmail(accessToken);
        }

        if (!githubEmail) {
          return done(
            new Error(
              'No verified email address is available from GitHub.'
            ),
            null
          );
        }

        // ------------------------------------------
        // 4. Prevent unsafe automatic account linking
        // ------------------------------------------

        user = await User.findOne({
          email: githubEmail
        });

        if (user) {
          /*
            A local account or another OAuth account already
            owns this email.

            Do not silently convert that account into GitHub.
          */

          return done(
            new Error(
              'An account with this email already exists. Please use the original login method.'
            ),
            null
          );
        }

        // ------------------------------------------
        // 5. Create system account
        // ------------------------------------------

        user = await User.create({
          name:
            profile.displayName ||
            profile.username ||
            'GitHub User',

          email: githubEmail,

          provider: 'github',

          providerId: profile.id,

          // OAuth signup gets lowest privilege
          role: 'Employee'
        });

        console.log(
          `GitHub OAuth user created: ${user.email}`
        );

        return done(null, user);
      } catch (error) {
        console.error(
          'GITHUB PASSPORT ERROR:',
          error
        );

        return done(error, null);
      }
    }
  )
);

module.exports = passport;