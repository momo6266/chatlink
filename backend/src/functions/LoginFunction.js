const { app } = require('@azure/functions');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

app.http('LoginFunction', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Parse the JSON body
    const { username, password } = await request.json();

    // Log the received username
    context.log('Received username:', username);

    // Retrieve stored credentials from environment variables
    const storedUsername = process.env.APP_USERNAME;
    const storedHashedPassword = process.env.APP_PASSWORD_HASH;

    // Validate credentials
    if (username === storedUsername) {
      const passwordMatch = await bcrypt.compare(password, storedHashedPassword);
      context.log('Password match:', passwordMatch);

      if (passwordMatch) {
        // Generate JWT token
        const token = jwt.sign({ username }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });

        // Log successful authentication
        context.log('Authentication successful');

        // Return success response with token
        return {
          status: 200,
          jsonBody: { token },
        };
      }
    }

    // Log failed authentication
    context.log('Authentication failed');

    // Return unauthorized response
    return {
      status: 401,
      jsonBody: { error: 'Invalid credentials' },
    };
  },
});
