// ChatHandler.js

const { app } = require('@azure/functions');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Optional: If you plan to store attachments locally
// const uploadDirectory = path.join(__dirname, '..', 'uploads');

app.http('ChatHandler', {
  methods: ['POST'],
  authLevel: 'function',
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

      // Extract the messages and model from the request body
      const { messages, model } = await request.json();

      if (!Array.isArray(messages) || messages.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'Invalid or missing messages array' },
        };
      }

      if (!model || typeof model !== 'string') {
        return {
          status: 400,
          jsonBody: { error: 'Invalid or missing model' },
        };
      }

      context.log('Received Messages:', messages);
      context.log('Requested Model:', model);

      // Validate and sanitize messages
      let sanitizedMessages = messages.map(msg => {
        return {
          role: ['user', 'assistant', 'system', 'function'].includes(msg.role) ? msg.role : 'user',
          content: typeof msg.content === 'string' ? msg.content : '',
          attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
        };
      });

      // Process attachments: Decode Base64 and (optionally) store them
      sanitizedMessages = sanitizedMessages.map(msg => {
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments = msg.attachments.map(attachment => {
            // Decode the Base64 string
            const buffer = Buffer.from(attachment.data, 'base64');
            const filePath = path.join(__dirname, '..', 'uploads', decoded.username, attachment.name);

            // Optional: Store the file locally
            // Ensure the directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Write the file to the server
            fs.writeFileSync(filePath, buffer);

            // Optionally, you can generate a URL or path to access the file

            // Modify the attachment object to include the file path or URL
            return {
              name: attachment.name,
              type: attachment.type,
              path: filePath, // Or generate a URL if serving files
            };
          });
        }
        return msg;
      });

      // Limit the number of messages to prevent exceeding context window
      const MAX_MESSAGES = 20;
      if (sanitizedMessages.length > MAX_MESSAGES) {
        sanitizedMessages = [sanitizedMessages[0], ...sanitizedMessages.slice(- (MAX_MESSAGES - 1))];
      }

      // Call OpenAI Chat API
      let openAIResponse;
      try {
        openAIResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: model,
            messages: sanitizedMessages,
            // Remove functions if not using them
            // functions: functions,
            // function_call: 'auto',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          }
        );
        context.log('OpenAI API Response:', JSON.stringify(openAIResponse.data, null, 2));
      } catch (apiError) {
        context.log('OpenAI API call failed:', apiError.message);

        // Handle specific error cases
        if (apiError.response && apiError.response.status === 404) {
          return {
            status: 400,
            jsonBody: { error: 'Model not found or unauthorized' },
          };
        }

        return {
          status: 500,
          jsonBody: { error: 'OpenAI API call failed', details: apiError.message },
        };
      }

      // Process the assistant's response
      const assistantReply = openAIResponse.data.choices[0].message.content;

      return {
        status: 200,
        jsonBody: { response: assistantReply },
      };
    } catch (error) {
      // General error handling
      context.log('Unexpected error:', error.message);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error', details: error.message },
      };
    }
  },
});
