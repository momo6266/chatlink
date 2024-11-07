const { app } = require('@azure/functions');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// In-memory cache for models
let cachedModels = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // Cache for 1 hour

app.http('GetAvailableModels', {
  methods: ['GET'],
  authLevel: 'function', // Require function-level authorization
  handler: async (request, context) => {
    try {
      // Get the token from the Authorization header
      const authHeader = request.headers.get('authorization');

      if (!authHeader) {
        return {
          status: 401,
          jsonBody: { error: 'Authorization Header not found!' },
        };
      }

      const token = authHeader.split(' ')[1];

      if (!token) {
        return {
          status: 401,
          jsonBody: { error: 'Token missing' },
        };
      }

      // Verify the JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        context.log('Token verification successful:', decoded);
      } catch (tokenError) {
        context.log('Token verification failed:', tokenError.message);
        return {
          status: 401,
          jsonBody: { error: 'Invalid token', details: tokenError.message },
        };
      }

      const currentTime = Date.now();

      // Check if cached models are available and not expired
      if (cachedModels && (currentTime - lastFetchTime) < CACHE_DURATION_MS) {
        context.log('Returning cached models');
        return {
          status: 200,
          jsonBody: { models: cachedModels },
        };
      }

      // Fetch models from OpenAI API
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      // Extract and filter model data
      const models = response.data.data
        .map(model => model.id)
        .filter(modelId => {
          // Include only chat completion models
          return modelId.startsWith('gpt-');
        });

      // Update cache
      cachedModels = models;
      lastFetchTime = currentTime;

      context.log('Models fetched and cached');

      // Return the list of models
      return {
        status: 200,
        jsonBody: { models: models },
      };
    } catch (error) {
      context.log('Error fetching models:', error.message);
      return {
        status: 500,
        jsonBody: { error: 'Failed to retrieve models', details: error.message },
      };
    }
  },
});
