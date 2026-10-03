const dns = require('dns');
const path = require('path');

// Helps with some MongoDB Atlas DNS issues on local Windows systems
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const passport = require('./src/config/passport');
const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/authRoutes');
const protectedRoutes = require('./src/routes/protectedRoutes');

const app = express();

// ==================================================
// DATABASE
// ==================================================

connectDB();

// ==================================================
// SECURITY HEADERS - HELMET
// ==================================================

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"]
      }
    }
  })
);

// ==================================================
// STRICT CORS
// ==================================================

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman, curl, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Not allowed by CORS')
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  })
);

// ==================================================
// BODY PARSING
// ==================================================

app.use(
  express.json({
    limit: '10kb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10kb'
  })
);

app.use(cookieParser());

// ==================================================
// REQUEST LOGGING
// ==================================================

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==================================================
// SANITIZATION
// ==================================================

const sanitizeNoSQL = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeNoSQL);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const sanitizedObject = {};

    for (
      const [key, nestedValue]
      of Object.entries(value)
    ) {
      // Reject MongoDB operators and dotted keys
      if (
        key.startsWith('$') ||
        key.includes('.')
      ) {
        continue;
      }

      sanitizedObject[key] =
        sanitizeNoSQL(nestedValue);
    }

    return sanitizedObject;
  }

  return value;
};

const sanitizeXSS = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        ''
      )
      .replace(
        /javascript\s*:/gi,
        ''
      )
      .replace(
        /\bon\w+\s*=/gi,
        ''
      );
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeXSS);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const sanitizedObject = {};

    for (
      const [key, nestedValue]
      of Object.entries(value)
    ) {
      sanitizedObject[key] =
        sanitizeXSS(nestedValue);
    }

    return sanitizedObject;
  }

  return value;
};

const sanitizeInput = (value) => {
  return sanitizeXSS(
    sanitizeNoSQL(value)
  );
};

// Body sanitization
app.use((req, res, next) => {
  if (
    req.body &&
    typeof req.body === 'object'
  ) {
    req.body =
      sanitizeInput(req.body);
  }

  next();
});

// Query sanitization
app.use((req, res, next) => {
  const query = req.query;

  if (
    query &&
    typeof query === 'object'
  ) {
    for (
      const key of Object.keys(query)
    ) {
      // Dangerous query keys
      if (
        key.startsWith('$') ||
        key.includes('.')
      ) {
        try {
          delete query[key];
        } catch {
          // Express may expose read-only query values
        }

        continue;
      }

      const sanitizedValue =
        sanitizeInput(query[key]);

      try {
        query[key] =
          sanitizedValue;
      } catch {
        // Express 5 query property may be read-only
      }
    }
  }

  next();
});

// ==================================================
// PASSPORT
// ==================================================

app.use(passport.initialize());

// ==================================================
// API ROUTES
// ==================================================

app.use(
  '/api/v1/auth',
  authRoutes
);

app.use(
  '/api/v1',
  protectedRoutes
);

// ==================================================
// API HEALTH CHECK
// ==================================================

app.get(
  '/api/v1/health',
  (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        'Enterprise Multi-Tenant Security Gateway is running',
      version: '1.0.0',
      environment:
        process.env.NODE_ENV ||
        'development'
    });
  }
);

// ==================================================
// STATIC FRONTEND
// ==================================================

const publicPath =
  path.join(__dirname, 'public');

app.use(
  express.static(publicPath)
);

// ==================================================
// FRONTEND HOME
// ==================================================

app.get('/', (req, res) => {
  return res.sendFile(
    path.join(
      publicPath,
      'index.html'
    )
  );
});

// ==================================================
// 404 HANDLER
// ==================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
  console.error(
    'GLOBAL ERROR:',
    err
  );

  // CORS rejection
  if (
    err.message ===
    'Not allowed by CORS'
  ) {
    return res.status(403).json({
      success: false,
      message:
        'Origin not allowed by CORS'
    });
  }

  // Invalid JSON
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON body'
    });
  }

  return res.status(500).json({
    success: false,
    message:
      'Something went wrong!'
  });
});

// ==================================================
// START SERVER
// ==================================================

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});